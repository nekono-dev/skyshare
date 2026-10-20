/**
 * 予約ダイアログの状態遷移（画面の状態を純粋関数で表す）。
 *
 * 責務と処理概要:
 * - 状態は Editing → (Registering) → Submitting → Done の流れで進む。
 * - Submitting の間は送信の指示を受け付けず、1回の操作で作成される予約を1件以下にする。
 */

export type DialogState = "Editing" | "Registering" | "Submitting" | "Done"

export type DialogEvent =
    | { type: "submit"; credentialRegistered: boolean }
    | { type: "registered" }
    | { type: "registerFailed" }
    | { type: "created" }
    | { type: "createFailed" }
    | { type: "reset" }

export const nextDialogState = (
    state: DialogState,
    event: DialogEvent,
): DialogState => {
    switch (state) {
        case "Editing":
            if (event.type === "submit") {
                return event.credentialRegistered ? "Submitting" : "Registering"
            }
            return state
        case "Registering":
            if (event.type === "registered") return "Submitting"
            if (event.type === "registerFailed") return "Editing"
            return state
        case "Submitting":
            // 送信中の submit は無視する
            if (event.type === "created") return "Done"
            if (event.type === "createFailed") return "Editing"
            return state
        case "Done":
            return event.type === "reset" ? "Editing" : state
    }
}
