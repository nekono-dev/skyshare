/**
 * 投稿本文欄の行数設定を保持する。
 *
 * - SSR や localStorage の利用不可時、または読み書きの失敗時は既定値を使う。
 */

const TEXTAREA_ROWS_KEY = "textareaRows"

/**
 * PostForm本文欄のtextarea行数（キーボード表示時に算出したrows）を
 * localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定時に返す既定値
 *
 * Output:
 * - 保存済み行数。未設定/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `undefined`
 * - 出力: `12`（保存済み値が12の場合）
 */
export const readTextareaRowsSetting = (
    defaultValue: number | undefined,
): number | undefined => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(TEXTAREA_ROWS_KEY)
        if (rawValue === null) {
            return defaultValue
        }
        const parsed = Number(rawValue)
        return Number.isFinite(parsed) ? parsed : defaultValue
    } catch (error) {
        return defaultValue
    }
}

/**
 * PostForm本文欄のtextarea行数（キーボード表示時に算出したrows）を
 * localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい行数
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `12`
 * - 出力: localStorage に `textareaRows=12` を保存
 */
export const writeTextareaRowsSetting = (value: number) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(TEXTAREA_ROWS_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}
