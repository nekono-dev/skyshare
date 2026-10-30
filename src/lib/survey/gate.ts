/**
 * 常駐する入口（SurveyGate）の判定・画面の状態・送信と辞退の振る舞い（React に依存しない純粋な部分）。
 *
 * 責務と処理概要:
 * - 判定の順序は、ページの除外 → アクティブなアカウントの取得 → 設定の取得と開催中の判定 → このタブの辞退 → 起動時の判定。
 *   除外ページは何もせず `skipped` を返す（判定済みにしないため、呼び出し側が区別する）。
 *   途中で何もしないと決まった時点で後続の依存を呼ばない（未ログインなら設定も取得しない）。
 *   辞退の確認は、アンケートの識別子が設定から分かった後に行う（印がその識別子で保存されるため）。
 * - ダイアログの状態（表示中のアンケート・送信中・失敗・判定済みの鍵）は `gateReducer` だけが変える。
 * - 画面の効果（状態の更新・端末の記録・辞退の印・判定の世代）は `GateRuntime` 経由で呼ぶ。
 *   React の配線は、この `GateRuntime` を組み立てて各関数に渡すだけにする。
 * - 辞退の経路は `handleDecline` → `applyDecline` だけで、回答の送信も回答済みの記録も行わない。
 */
import type { Survey } from "@/lib/survey/definition"
import type { SubmitResult } from "@/lib/survey/client"
import {
    isSurveyPageExcluded,
    type LaunchOutcome,
} from "@/lib/survey/launchCheck"
import { markDeclinedInTab, rememberAnswered } from "@/lib/survey/deviceRecord"

/** 判定の結果。`skipped` は判定を行わなかった（判定済みにしない） */
export type GateCheckResult =
    | { kind: "skipped" }
    | { kind: "none" }
    | { kind: "ask"; survey: Survey; did: string }

/** 判定の順序で呼ぶ依存。すべて例外を投げうる前提で呼び出し側が包む */
export type GateDeps = {
    /** 配信用の設定を取得し、開催中のアンケートを返す。無ければ undefined */
    loadSurvey: () => Promise<Survey | undefined>
    /** このタブで「回答しない」により辞退済みか */
    isDeclined: (surveyId: string) => boolean
    /** アクティブなアカウントの識別子。無ければ null */
    getDid: () => Promise<string | null>
    /** 起動時の判定（端末の記録とサーバーへの確認） */
    decide: (surveyId: string, did: string) => Promise<LaunchOutcome>
}

/** 送信の呼び出し口（`surveyApi.submitAnswers` と同じ形） */
export type SubmitAnswers = (
    surveyId: string,
    answers: Record<string, string | string[]>,
) => Promise<SubmitResult>

/**
 * 1 回の判定を、既定の順序で行う。例外は投げず、途中の失敗は `none` にする。
 *
 * Input:
 * - `pathname`・`search`: 現在のページの位置
 * - `deps`: 判定の依存
 *
 * Output:
 * - `skipped`: 除外ページ（依存は呼ばない）
 * - `ask`: 回答が必要と判定された（ダイアログを出す）
 * - `none`: 何もしない（設定なし・開催中なし・辞退・アカウントなし・判定の結果や例外）
 *
 * 例: `/privacy/` は `{ kind: "skipped" }`、未ログインは `loadSurvey` を呼ばず `{ kind: "none" }`。
 */
export const runGateCheck = async (input: {
    pathname: string
    search: string
    deps: GateDeps
}): Promise<GateCheckResult> => {
    const { pathname, search, deps } = input
    if (isSurveyPageExcluded(pathname, search)) return { kind: "skipped" }
    try {
        // 未ログインは追加の通信なしで判明するため、設定の取得より先に確かめる
        const did = await deps.getDid()
        if (!did) return { kind: "none" }
        const survey = await deps.loadSurvey()
        if (!survey) return { kind: "none" }
        // 辞退の印はアンケートの識別子で引くため、開催中のアンケートが分かった後に確かめる
        if (deps.isDeclined(survey.id)) return { kind: "none" }
        const outcome = await deps.decide(survey.id, did)
        return outcome === "ask"
            ? { kind: "ask", survey, did }
            : { kind: "none" }
    } catch {
        // 想定外の例外でも、利用者の操作を妨げずに何もしない
        return { kind: "none" }
    }
}

/** 送信の結果に対する振る舞い。`remember` は回答済みとして端末に記録するか */
export type SubmitOutcome =
    { kind: "close"; remember: boolean } | { kind: "failed" }

/**
 * 送信の分類を、画面の振る舞いへ振り分ける。
 *
 * Input: 送信の分類（`SubmitResult`）
 * Output:
 * - 保存・重複: 回答済みとして記録して閉じる
 * - 終了・未認証: 記録せず閉じる
 * - それ以外の失敗: 閉じずに失敗を示す
 *
 * 例: `resolveSubmitOutcome("duplicate")` は `{ kind: "close", remember: true }`。
 */
export const resolveSubmitOutcome = (result: SubmitResult): SubmitOutcome => {
    switch (result) {
        case "saved":
        case "duplicate":
            return { kind: "close", remember: true }
        case "gone":
        case "unauthenticated":
            return { kind: "close", remember: false }
        default:
            return { kind: "failed" }
    }
}

/**
 * 画面の位置が変わったとき（初回・ページ遷移）に行うことを決める。通信も判定も行わない。
 *
 * Input:
 * - `pathname`・`search`: 新しい画面の位置
 * - `judgedKey`: 判定済みの画面の鍵（パスと検索の組）。無ければ null
 *
 * Output:
 * - `reset`: 除外ページ。表示中のダイアログを閉じ、判定済みを消す（次の画面で判定し直す）
 * - `same`: 判定済みの同じ画面。何もしない
 * - `judge`: 新しい画面。`key` を判定済みにして判定する
 *
 * 例: `/privacy/` は `{ kind: "reset", judgedKey: null, closeDialog: true }`。
 */
export type GateEntryPlan =
    | { kind: "reset"; judgedKey: null; closeDialog: true }
    | { kind: "same" }
    | { kind: "judge"; key: string }

export const planGateEntry = (input: {
    pathname: string
    search: string
    judgedKey: string | null
}): GateEntryPlan => {
    const { pathname, search, judgedKey } = input
    if (isSurveyPageExcluded(pathname, search)) {
        return { kind: "reset", judgedKey: null, closeDialog: true }
    }
    const key = `${pathname}${search}`
    if (judgedKey === key) return { kind: "same" }
    return { kind: "judge", key }
}

/** ダイアログの状態。表示中のアンケートと、送信・失敗・判定済みの鍵を持つ */
export type GateState = {
    /** 表示中のアンケートとアカウント。表示していなければ null */
    pending: { survey: Survey; did: string } | null
    /** 送信中。質問と操作を押せなくする */
    busy: boolean
    /** 直近の送信が失敗したか */
    failed: boolean
    /** 判定済みの画面の鍵（パスと検索の組）。同じ画面の間は再判定しない */
    judgedKey: string | null
}

export const initialGateState: GateState = {
    pending: null,
    busy: false,
    failed: false,
    judgedKey: null,
}

/** ダイアログの状態を変える動作。`gateReducer` だけが解釈する */
export type GateAction =
    /** 除外ページ: 表示・送信中・失敗・判定済みをすべて消す */
    | { type: "reset" }
    /** 「聞く」と判定された: 表示し、判定済みの鍵を設定する */
    | { type: "ask"; survey: Survey; did: string; key: string }
    /** 送信を始める: 失敗の表示を消して送信中にする */
    | { type: "submitStart" }
    /** 送信が失敗した: 表示は残し、失敗を示して送信中を解く */
    | { type: "submitFailed" }
    /** 閉じる（保存・重複・終了・未認証・辞退）: 表示を消す。判定済みは残す */
    | { type: "close" }
    /** 画面を判定済みにする */
    | { type: "judged"; key: string }

/**
 * ダイアログの状態を、動作に応じて次の状態にする（純粋関数）。
 *
 * Input: 現在の状態と動作
 * Output: 新しい状態（入力は書き換えない）
 *
 * 例: `gateReducer(shown, { type: "submitFailed" })` は表示を残して `failed` を真にする。
 */
export const gateReducer = (
    state: GateState,
    action: GateAction,
): GateState => {
    switch (action.type) {
        case "reset":
            return {
                pending: null,
                busy: false,
                failed: false,
                judgedKey: null,
            }
        case "ask":
            return {
                pending: { survey: action.survey, did: action.did },
                busy: false,
                failed: false,
                judgedKey: action.key,
            }
        case "submitStart":
            return { ...state, busy: true, failed: false }
        case "submitFailed":
            return { ...state, busy: false, failed: true }
        case "close":
            return { ...state, pending: null, busy: false, failed: false }
        case "judged":
            return { ...state, judgedKey: action.key }
    }
}

/**
 * 画面の効果の集まり。React の配線はこれを組み立てて関数に渡すだけにする。
 *
 * - `dispatch`: ダイアログの状態を変える（`gateReducer` に渡す）
 * - `remember`: 回答済みとして端末に記録する（送信が保存・重複だったときだけ）
 * - `markDeclinedInTab`: このタブで辞退した印を残す
 * - `beginJudgement`: 新しい判定を始め、その世代を返す。古い世代の結果は捨てられる
 * - `isCurrent`: その世代がまだ最新で、購読中か
 */
export type GateRuntime = {
    dispatch: (action: GateAction) => void
    remember: (surveyId: string, did: string) => void
    markDeclinedInTab: (surveyId: string) => void
    beginJudgement: () => number
    isCurrent: (generation: number) => boolean
}

/**
 * 辞退の経路に渡す効果。`remember` を含まないため、辞退から回答済みの記録は型の上で届かない。
 */
export type DeclineRuntime = Pick<GateRuntime, "dispatch" | "markDeclinedInTab">

/**
 * 画面の位置が変わったときの処理。除外ページはダイアログを閉じて判定済みを消し、
 * 新しい画面は判定済みにしてから判定し、「聞く」ならダイアログを設定する。
 *
 * Input:
 * - `input`: 新しい画面の位置と、判定済みの鍵
 * - `rt`: 画面の効果
 * - `deps`: 判定の依存（除外・同じ画面のときは呼ばない）
 *
 * Output: 判定が終わったら解決する Promise（結果は `rt` に渡される）
 *
 * 例: `/privacy/` へ移ると `dispatch({ type: "reset" })` だけが呼ばれ、依存は呼ばれない。
 */
export const enterPage = async (
    input: { pathname: string; search: string; judgedKey: string | null },
    rt: GateRuntime,
    deps: GateDeps,
): Promise<void> => {
    const plan = planGateEntry(input)
    if (plan.kind === "same") return
    if (plan.kind === "reset") {
        // 進行中の判定の結果は捨て、表示中のダイアログを閉じる（通信しない）
        rt.beginJudgement()
        rt.dispatch({ type: "reset" })
        return
    }
    rt.dispatch({ type: "judged", key: plan.key })
    const generation = rt.beginJudgement()
    const result = await runGateCheck({
        pathname: input.pathname,
        search: input.search,
        deps,
    })
    if (!rt.isCurrent(generation)) return
    if (result.kind === "ask") {
        rt.dispatch({
            type: "ask",
            survey: result.survey,
            did: result.did,
            key: plan.key,
        })
    }
}

/**
 * 送信の結果を振り分ける。保存・重複は記録してから閉じ、終了・未認証は記録せず閉じ、
 * それ以外は失敗を示して開き続ける。
 *
 * Input: 送信の分類、送信先のアンケートとアカウント、画面の効果
 * Output: なし（効果を呼ぶ）
 *
 * 例: `applySubmitResult("gone", target, rt)` は `dispatch({ type: "close" })` だけを呼ぶ。
 */
export const applySubmitResult = (
    result: SubmitResult,
    target: { surveyId: string; did: string },
    rt: GateRuntime,
): void => {
    const outcome = resolveSubmitOutcome(result)
    if (outcome.kind === "failed") {
        rt.dispatch({ type: "submitFailed" })
        return
    }
    if (outcome.remember) rt.remember(target.surveyId, target.did)
    rt.dispatch({ type: "close" })
}

/**
 * 「回答しない」で閉じる。このタブの辞退の印を残してから閉じ、送信も回答済みの記録もしない。
 *
 * Input: アンケートの識別子と画面の効果（送信の呼び出し口は受け取らない）
 * Output: なし。`markDeclinedInTab(surveyId)` を呼び、続けて `dispatch({ type: "close" })`。
 *
 * 例: `applyDecline("survey-2026", rt)` は辞退の印と閉じるだけを行う。
 */
export const applyDecline = (surveyId: string, rt: DeclineRuntime): void => {
    rt.markDeclinedInTab(surveyId)
    rt.dispatch({ type: "close" })
}

/**
 * 「回答しない」の操作。表示中のアンケートが無ければ何もしない。
 *
 * Input: 現在のダイアログの状態と辞退の効果（`remember` は受け取らない）
 * Output: なし（表示中なら `applyDecline` を呼ぶ）
 */
export const handleDecline = (state: GateState, rt: DeclineRuntime): void => {
    if (!state.pending) return
    applyDecline(state.pending.survey.id, rt)
}

/**
 * 送信の操作。表示中で送信中でなければ、送信中にしてから送り、結果を振り分ける。
 *
 * Input: 現在のダイアログの状態、回答、画面の効果、送信の呼び出し口
 * Output: 送信の結果を振り分けたあと解決する Promise
 *
 * 例: 送信中の状態で呼んでも送信しない（二重に送らない）。
 */
export const handleSubmit = async (
    state: GateState,
    answers: Record<string, string | string[]>,
    rt: GateRuntime,
    submit: SubmitAnswers,
): Promise<void> => {
    const { pending, busy } = state
    if (!pending || busy) return
    rt.dispatch({ type: "submitStart" })
    const result = await submit(pending.survey.id, answers)
    applySubmitResult(
        result,
        { surveyId: pending.survey.id, did: pending.did },
        rt,
    )
}

/**
 * 実物の画面の効果を組み立てる。回答済みの記録と辞退の印は、ここで端末の記録の関数につなぐ。
 *
 * Input: 状態の更新・判定の世代の関数（React の参照に依存する部分は呼び出し側が渡す）
 * Output: `GateRuntime`。`remember` は送信の結果からだけ呼ばれ、辞退の経路からは呼ばれない。
 */
export const createLiveRuntime = (host: {
    dispatch: (action: GateAction) => void
    beginJudgement: () => number
    isCurrent: (generation: number) => boolean
}): GateRuntime => ({
    dispatch: host.dispatch,
    remember: (surveyId, did) => rememberAnswered(surveyId, did),
    markDeclinedInTab: surveyId => markDeclinedInTab(surveyId),
    beginJudgement: host.beginJudgement,
    isCurrent: host.isCurrent,
})

/**
 * ダイアログの 2 つの操作（送信・辞退）を、現在の状態と画面の効果に結び付けて作る。
 *
 * Input:
 * - `getState`: 操作の時点の最新の状態
 * - `rt`: 画面の効果
 * - `submit`: 送信の呼び出し口
 *
 * Output: `onSubmit`（回答を送り、結果を振り分ける）と `onDecline`（辞退の印を残して閉じる）
 *
 * 例: `onDecline()` は辞退の印と閉じるだけを行い、送信も回答済みの記録もしない。
 */
export const createDialogHandlers = (
    getState: () => GateState,
    rt: GateRuntime,
    submit: SubmitAnswers,
): {
    onSubmit: (answers: Record<string, string | string[]>) => Promise<void>
    onDecline: () => void
} => ({
    onSubmit: answers => handleSubmit(getState(), answers, rt, submit),
    onDecline: () => handleDecline(getState(), rt),
})
