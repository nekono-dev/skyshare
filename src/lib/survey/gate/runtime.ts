/**
 * 入口（SurveyGate）の画面の効果と、送信・辞退・入口の振る舞い（React に依存しない）。
 *
 * 責務と処理概要:
 * - 画面の効果（状態の更新・端末の記録・辞退の印・判定の世代）は `GateRuntime` 経由で呼ぶ。
 *   React の配線は、この `GateRuntime` を組み立てて各関数に渡すだけにする。
 * - ダイアログの状態は `state.ts` の `gateReducer` だけが変える（ここでは `dispatch` で送る）。
 * - 除外ページの判定は `enterPage` が行い、結果を `planGateEntry` の `excluded` に渡す。
 * - 辞退の経路は `handleDecline` → `applyDecline` だけで、回答の送信も回答済みの記録も行わない。
 */
import type { SubmitResult } from "@/lib/survey/client"
import { isSurveyPageExcluded } from "@/lib/survey/launchCheck"
import { markDeclinedInTab, rememberAnswered } from "@/lib/survey/deviceRecord"
import {
    planGateEntry,
    resolveSubmitOutcome,
    type GateAction,
    type GateState,
} from "./state"
import { runGateCheck, type GateDeps } from "./check"

/** 送信の呼び出し口（`surveyApi.submitAnswers` と同じ形） */
export type SubmitAnswers = (
    surveyId: string,
    answers: Record<string, string | string[]>,
) => Promise<SubmitResult>

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
    const plan = planGateEntry({
        pathname: input.pathname,
        search: input.search,
        judgedKey: input.judgedKey,
        excluded: isSurveyPageExcluded(input.pathname, input.search),
    })
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
    rt.dispatch({ type: "hide" })
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
