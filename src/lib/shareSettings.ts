/**
 * 投稿共有設定の永続化ユーティリティ。
 *
 * 責務と処理概要:
 * - 投稿フォームが参照する共有設定を localStorage で管理する。
 * - SSR/プライベートモードなどで localStorage が利用不可でも安全に既定値へフォールバックする。
 */

const OPEN_X_POPUP_KEY = "openXPopup"
const CROSSPOST_TO_TAITTSUU_KEY = "crosspostToTaittsuu"
/**
 * 「Xをポップアップで開く」設定を localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定時に返す既定値
 *
 * Output:
 * - 保存済み設定値。未設定/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `false`
 * - 出力: `true`（保存済み値が true の場合）
 */
export const readOpenXPopupSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(OPEN_X_POPUP_KEY)
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「Xをポップアップで開く」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `true`
 * - 出力: localStorage に `openXPopup=true` を保存
 */
export const writeOpenXPopupSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(OPEN_X_POPUP_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * 「タイッツーにクロスポスト」設定を localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定時に返す既定値
 *
 * Output:
 * - 保存済み設定値。未設定/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `false`
 * - 出力: `true`（保存済み値が true の場合）
 */
export const readCrosspostToTaittsuuSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(CROSSPOST_TO_TAITTSUU_KEY)
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「タイッツーにクロスポスト」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `true`
 * - 出力: localStorage に `crosspostToTaittsuu=true` を保存
 */
export const writeCrosspostToTaittsuuSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(CROSSPOST_TO_TAITTSUU_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}
