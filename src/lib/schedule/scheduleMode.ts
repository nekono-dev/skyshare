/**
 * 投稿フォームの予約の状態と、その状態から決まる送信先・ボタンの文言・キャンセルの動作。
 *
 * 責務と処理概要:
 * - 状態は次の4つで、React に依存しない純粋な関数で遷移と判定を行う。
 *   - plain: 予約の日時が設定されていない通常の入力
 *   - new: 新規の予約として日時を設定した入力（まだ予約していない）
 *   - editing: 予約のタブから選んだ待機中の予約を編集している
 *   - detached: 編集中に日時を解除して予約を取り消した後（内容はフォームに残る）
 * - 状態の保持と API の呼び出しは投稿フォームが行う。
 */
import type { PlainMessageKey } from "@/lib/i18n/translate"

export type ScheduleMode =
    | { kind: "plain" }
    | { kind: "new"; runAt: Date }
    | { kind: "editing"; id: string; runAt: Date }
    | { kind: "detached" }

export const initialScheduleMode: ScheduleMode = { kind: "plain" }

/**
 * 実行日時の設定・解除を状態に反映する。
 *
 * Input:
 * - `mode`: 現在の状態
 * - `next`: 設定した日時、または解除（null）
 *
 * Output:
 * - `mode`: 次の状態
 * - `cancelScheduleId`: 呼び出し側がただちに取り消す予約の識別子（編集中の解除のときだけ）
 *
 * Example:
 * - `applyRunAtChange({ kind: "plain" }, d)` → `{ mode: { kind: "new", runAt: d }, cancelScheduleId: null }`
 * - `applyRunAtChange({ kind: "editing", id: "s1", runAt }, null)` → `{ mode: { kind: "detached" }, cancelScheduleId: "s1" }`
 */
export const applyRunAtChange = (
    mode: ScheduleMode,
    next: Date | null,
): { mode: ScheduleMode; cancelScheduleId: string | null } => {
    if (mode.kind === "editing") {
        // 編集中の解除は予約の取消。日時の変更は識別子を保ったまま日時だけを変える
        return next === null
            ? { mode: { kind: "detached" }, cancelScheduleId: mode.id }
            : { mode: { ...mode, runAt: next }, cancelScheduleId: null }
    }
    if (next !== null) {
        return { mode: { kind: "new", runAt: next }, cancelScheduleId: null }
    }
    // 新規の日時の解除は通常の入力へ戻る。取消後（detached）は日時が無いまま変わらない
    return {
        mode: mode.kind === "new" ? { kind: "plain" } : mode,
        cancelScheduleId: null,
    }
}

/**
 * 予約の選択をフォームに反映した後の状態を作る。
 *
 * Example: `editScheduleMode("s1", runAt)` → `{ kind: "editing", id: "s1", runAt }`
 */
export const editScheduleMode = (id: string, runAt: Date): ScheduleMode => ({
    kind: "editing",
    id,
    runAt,
})

/** 状態に設定されている実行日時。日時の無い状態では null。 */
export const runAtOf = (mode: ScheduleMode): Date | null =>
    mode.kind === "new" || mode.kind === "editing" ? mode.runAt : null

/**
 * 送信ボタンを押したときの送信先を決める。
 *
 * Output: 通常の投稿は `post`、新規の予約は `create`、編集中の予約は `update`
 * Example: `submitTarget({ kind: "editing", id: "s1", runAt })` → `{ kind: "update", id: "s1", runAt }`
 */
export const submitTarget = (
    mode: ScheduleMode,
):
    | { kind: "post" }
    | { kind: "create"; runAt: Date }
    | { kind: "update"; id: string; runAt: Date } => {
    if (mode.kind === "new") return { kind: "create", runAt: mode.runAt }
    if (mode.kind === "editing") {
        return { kind: "update", id: mode.id, runAt: mode.runAt }
    }
    return { kind: "post" }
}

/**
 * 送信ボタンの文言キーを決める。
 *
 * Example: `submitLabelKey({ kind: "new", runAt }, true)` → `"schedule.submitAll"`（すべて予約）
 */
export const submitLabelKey = (
    mode: ScheduleMode,
    isThread: boolean,
): PlainMessageKey => {
    if (submitTarget(mode).kind === "post") {
        return isThread ? "post.composer.submitAll" : "post.composer.submit"
    }
    return isThread ? "schedule.submitAll" : "schedule.submit"
}

/**
 * キャンセルを押したときの動作を決める。
 *
 * Input:
 * - `mode`: 現在の状態
 * - `hasUnsavedChanges`: 開いている下書きからの変更があるか（本文が空なら偽）
 * - `hasText`: 本文が1件でもあるか
 *
 * Output:
 * - `close`: そのまま閉じる（フォームを初期化する）
 * - `draftConfirm`: 下書きの保存・破棄・編集を続けるの確認を出す
 * - `editChoice`: 予約を取り消す・予約を残して閉じる・編集を続けるの3択を出す
 *
 * Example: `cancelAction({ kind: "detached" }, false, true)` → `"draftConfirm"`（変更がなくても確認する）
 */
export const cancelAction = (
    mode: ScheduleMode,
    hasUnsavedChanges: boolean,
    hasText: boolean,
): "close" | "draftConfirm" | "editChoice" => {
    if (mode.kind === "editing") return "editChoice"
    if (mode.kind === "detached") return hasText ? "draftConfirm" : "close"
    return hasUnsavedChanges ? "draftConfirm" : "close"
}
