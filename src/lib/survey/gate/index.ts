/**
 * アンケート表示ゲートの公開入口として各部品を再エクスポートする。
 *
 * - 呼び出し側は `@/lib/survey/gate` を参照する。
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
