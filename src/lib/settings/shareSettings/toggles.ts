/**
 * 共有時の表示や投稿フォームに関する設定を保持する。
 */

const POPUP_INTENT_INSTEAD_OF_WEBSHARE_KEY = "popupIntentInsteadOfWebshare"
const TRUNCATE_INTENT_TEXT_KEY = "truncateIntentText"
const PINNED_FORM_DISABLED_KEY = "pinnedFormDisabled"
const MANUAL_IMAGE_ATTACH_KEY = "manualImageAttach"
const LINK_CARD_PRIORITY_KEY = "preferSkyshareLinkCard"

/** 「Skyshareのリンクカードを優先表示」が未設定の場合に使う既定値。 */
export const DEFAULT_LINK_CARD_PRIORITY = true

/**
 * 「WebShareAPIの代わりにインテントポップアップを開く」設定を localStorage から読み取る。
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
export const readPopupIntentInsteadOfWebshareSetting = (
    defaultValue: boolean,
) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(
            POPUP_INTENT_INSTEAD_OF_WEBSHARE_KEY,
        )
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「WebShareAPIの代わりにインテントポップアップを開く」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `true`
 * - 出力: localStorage に `popupIntentInsteadOfWebshare=true` を保存
 */
export const writePopupIntentInsteadOfWebshareSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(
            POPUP_INTENT_INSTEAD_OF_WEBSHARE_KEY,
            String(value),
        )
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * 「X/タイッツー向け共有文の長文を省略する」設定を localStorage から読み取る。
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
export const readTruncateIntentTextSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(TRUNCATE_INTENT_TEXT_KEY)
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「X/タイッツー向け共有文の長文を省略する」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `true`
 * - 出力: localStorage に `truncateIntentText=true` を保存
 */
export const writeTruncateIntentTextSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(TRUNCATE_INTENT_TEXT_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * 「投稿フォームを固定表示しない」設定を localStorage から読み取る。
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
export const readPinnedFormDisabledSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(PINNED_FORM_DISABLED_KEY)
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「投稿フォームを固定表示しない」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `true`
 * - 出力: localStorage に `pinnedFormDisabled=true` を保存
 */
export const writePinnedFormDisabledSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(PINNED_FORM_DISABLED_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * 「画像を自分で添付する」設定を localStorage から読み取る。
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
export const readManualImageAttachSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(MANUAL_IMAGE_ATTACH_KEY)
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「画像を自分で添付する」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `true`
 * - 出力: localStorage に `manualImageAttach=true` を保存
 */
export const writeManualImageAttachSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(MANUAL_IMAGE_ATTACH_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * 「Skyshareのリンクカードを優先表示」設定を localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定時に返す既定値
 *
 * Output:
 * - 保存済み設定値。未設定/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `true`
 * - 出力: `false`（保存済み値が false の場合）
 */
export const readLinkCardPrioritySetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(LINK_CARD_PRIORITY_KEY)
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「Skyshareのリンクカードを優先表示」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `false`
 * - 出力: localStorage に `preferSkyshareLinkCard=false` を保存
 */
export const writeLinkCardPrioritySetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(LINK_CARD_PRIORITY_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * 共有の時点で使う「Skyshareのリンクカードを優先表示」の実効値を読み取る。
 *
 * 処理の趣旨:
 * - 「画像を自分で添付する」がONの間は skyshare entry のURLを共有文に含めないため、
 *   設定値によらず適用しない（false）。タイムラインのカードのように `useShareToggles` を
 *   持たない共有の経路が、共有の操作のたびに最新の保存値を読むために使う。
 *
 * Output:
 * - 適用するなら `true`
 */
export const readEffectiveLinkCardPriority = () =>
    !readManualImageAttachSetting(false) &&
    readLinkCardPrioritySetting(DEFAULT_LINK_CARD_PRIORITY)
