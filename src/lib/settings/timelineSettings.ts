/**
 * 「タイムラインを表示しない」設定（一覧を取得せず、投稿フォームだけを表示する）を保持する。
 *
 * - SSR や localStorage の利用不可時、または読み書きの失敗時は呼び出し側の既定値を使う。
 */

const TIMELINE_HIDDEN_KEY = "timelineHidden"

/**
 * 「タイムラインを表示しない」設定を localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定/不正値時に返す既定値
 *
 * Output:
 * - 保存済みの設定値。未設定/不正/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `false`
 * - 出力: `true`（保存済み値が "true" の場合）
 */
export const readTimelineHiddenSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(TIMELINE_HIDDEN_KEY)
        if (rawValue === "true") return true
        if (rawValue === "false") return false
        return defaultValue
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「タイムラインを表示しない」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし（保存失敗時は UI 動作を優先し、例外を握りつぶす）
 *
 * 例:
 * - 入力: `true`
 * - 出力: localStorage に `timelineHidden=true` を保存
 */
export const writeTimelineHiddenSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(TIMELINE_HIDDEN_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}
