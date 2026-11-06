/**
 * 入口（SurveyGate）の状態遷移の純粋な部分。送信の結果の型・送信の結果の振り分け・
 * 画面の位置に応じた計画・ダイアログの状態遷移を持つ。
 *
 * 入出力・通信・端末の記録に依存しない。除外ページかどうかの判定もここでは行わず、
 * 呼び出し側が `excluded` として渡す。
 * ダイアログの状態（表示中のアンケート・送信中・失敗・判定済みの鍵）は `gateReducer` だけが変える。
 */
import type { Survey } from "@/lib/survey/definition"
import type { SubmitResult } from "@/lib/survey/client"

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
 * 画面の位置が変わったとき（初回・ページ遷移）の計画。通信も判定も行わない。
 *
 * - `reset`: 除外ページ。表示中のダイアログを閉じ、判定済みを消す（次の画面で判定し直す）
 * - `same`: 判定済みの同じ画面。何もしない
 * - `judge`: 新しい画面。`key` を判定済みにして判定する
 */
export type GateEntryPlan =
    | { kind: "reset"; judgedKey: null; closeDialog: true }
    | { kind: "same" }
    | { kind: "judge"; key: string }

/**
 * 画面の位置が変わったときの計画を決める。通信も判定も行わない。
 *
 * Input:
 * - `pathname`・`search`: 新しい画面の位置
 * - `judgedKey`: 判定済みの画面の鍵（パスと検索の組）。無ければ null
 * - `excluded`: 除外ページか（`isSurveyPageExcluded` の結果。呼び出し側が計算して渡す）
 *
 * Output: `GateEntryPlan`。`excluded` が真なら `reset`、偽なら鍵が一致すれば `same`、それ以外は `judge`
 *
 * 例: `excluded` が真の `/privacy/` は `{ kind: "reset", judgedKey: null, closeDialog: true }`。
 */
export const planGateEntry = (input: {
    pathname: string
    search: string
    judgedKey: string | null
    excluded: boolean
}): GateEntryPlan => {
    const { pathname, search, judgedKey, excluded } = input
    if (excluded) {
        return { kind: "reset", judgedKey: null, closeDialog: true }
    }
    const key = `${pathname}${search}`
    if (judgedKey === key) return { kind: "same" }
    return { kind: "judge", key }
}

/** ダイアログの状態。表示中のアンケートと、送信・失敗・判定済みの鍵を持つ */
export type GateState = {
    /** 未回答のアンケートとアカウント。無ければ null */
    pending: { survey: Survey; did: string } | null
    /** 回答画面が開いているか */
    open: boolean
    /** 送信中。質問と操作を押せなくする */
    busy: boolean
    /** 直近の送信が失敗したか */
    failed: boolean
    /** 判定済みの画面の鍵（パスと検索の組）。同じ画面の間は再判定しない */
    judgedKey: string | null
}

export const initialGateState: GateState = {
    pending: null,
    open: false,
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
    /** 入口から回答画面を開く */
    | { type: "open" }
    /** 送信を始める: 失敗の表示を消して送信中にする */
    | { type: "submitStart" }
    /** 送信が失敗した: 表示は残し、失敗を示して送信中を解く */
    | { type: "submitFailed" }
    /** 辞退時は画面だけ閉じ、入口を残す */
    | { type: "close" }
    /** 保存・重複による回答済み、または終了・未認証で入口を消す */
    | { type: "hide" }
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
                open: false,
                busy: false,
                failed: false,
                judgedKey: null,
            }
        case "ask":
            return {
                pending: { survey: action.survey, did: action.did },
                open: false,
                busy: false,
                failed: false,
                judgedKey: action.key,
            }
        case "open":
            return state.pending ? { ...state, open: true } : state
        case "submitStart":
            return { ...state, busy: true, failed: false }
        case "submitFailed":
            return { ...state, busy: false, failed: true }
        case "close":
            return { ...state, open: false, busy: false, failed: false }
        case "hide":
            return {
                ...state,
                pending: null,
                open: false,
                busy: false,
                failed: false,
            }
        case "judged":
            return { ...state, judgedKey: action.key }
    }
}
