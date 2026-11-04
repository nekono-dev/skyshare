/**
 * アンケートの回答の促しゲート（`SurveyGate`）の入口。元の `gate.ts` の export をすべて再エクスポートする。
 *
 * 責務と処理概要:
 * - `state.ts`: 送信の結果の型・送信の結果の解釈（`resolveSubmitOutcome`）・ゲートの入場の計画（`planGateEntry`）・
 *   ゲートの状態と遷移（`initialGateState`・`gateReducer`）。入出力を持たない純粋な処理。
 * - `check.ts`: 判定（`runGateCheck`）。判定に必要な依存（`GateDeps`）を引数で受け取り、結果（`GateCheckResult`）を返す。
 * - `runtime.ts`: 画面の効果と送信・辞退の振る舞い（`enterPage`・`handleSubmit`・`handleDecline` など）と、
 *   実環境に接続する生成関数（`createLiveRuntime`・`createDialogHandlers`）。
 *
 * 呼び出し側（`components/timeline/Timeline/SurveyGate`）は、この `index.ts`（`@/lib/survey/gate`）だけを参照する。
 */
export type { GateCheckResult, GateDeps } from "./check"
export { runGateCheck } from "./check"
export type {
    GateEntryPlan,
    GateAction,
    GateState,
    SubmitOutcome,
} from "./state"
export {
    gateReducer,
    initialGateState,
    planGateEntry,
    resolveSubmitOutcome,
} from "./state"
export type { DeclineRuntime, GateRuntime, SubmitAnswers } from "./runtime"
export {
    applyDecline,
    applySubmitResult,
    createDialogHandlers,
    createLiveRuntime,
    enterPage,
    handleDecline,
    handleSubmit,
} from "./runtime"
