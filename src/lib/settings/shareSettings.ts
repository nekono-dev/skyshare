/**
 * 投稿共有設定の永続化ユーティリティ。
 *
 * 責務と処理概要:
 * - 投稿フォームが参照する共有設定を localStorage で管理する。
 * - SSR/プライベートモードなどで localStorage が利用不可でも安全に既定値へフォールバックする。
 */

const POPUP_INTENT_INSTEAD_OF_WEBSHARE_KEY = "popupIntentInsteadOfWebshare"
const CROSSPOST_TO_TAITTSUU_KEY = "crosspostToTaittsuu"
const SHOW_CROSSPOST_X_BUTTON = "showCrosspostXButton"
const PINNED_FORM_DISABLED_KEY = "pinnedFormDisabled"
const NO_AUTO_POPUP_AFTER_POST_KEY = "noAutoPopupAfterPost"
const MANUAL_IMAGE_ATTACH_KEY = "manualImageAttach"
const TEXTAREA_ROWS_KEY = "textareaRows"
const MASTODON_INSTANCE_DOMAIN_KEY = "mastodonInstanceDomain"
const CROSSPOST_TO_MASTODON_KEY = "crosspostToMastodon"
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

/**
 * 「タイッツークロスポスト時も X 投稿ボタンを表示する」設定を localStorage から読み取る。
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
export const readShowCrosspostXButtonSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(SHOW_CROSSPOST_X_BUTTON)
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「タイッツークロスポスト時も X 投稿ボタンを表示する」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `true`
 * - 出力: localStorage に `showCrosspostXButton=true` を保存
 */
export const writeShowCrosspostXButtonSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(SHOW_CROSSPOST_X_BUTTON, String(value))
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
 * 「投稿後に自動ポップアップをOFFにする」設定を localStorage から読み取る。
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
export const readNoAutoPopupAfterPostSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(
            NO_AUTO_POPUP_AFTER_POST_KEY,
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
 * 「投稿後に自動ポップアップをOFFにする」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `true`
 * - 出力: localStorage に `noAutoPopupAfterPost=true` を保存
 */
export const writeNoAutoPopupAfterPostSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(NO_AUTO_POPUP_AFTER_POST_KEY, String(value))
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

/**
 * Mastodonインスタンスのドメインを localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定時に返す既定値
 *
 * Output:
 * - 保存済みドメイン文字列。未設定/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `""`
 * - 出力: `"mastodon.social"`（保存済み値がある場合）
 */
export const readMastodonInstanceDomainSetting = (defaultValue: string) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(
            MASTODON_INSTANCE_DOMAIN_KEY,
        )
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue
    } catch (error) {
        return defaultValue
    }
}

/**
 * Mastodonインスタンスのドメインを localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したいドメイン文字列
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `"mastodon.social"`
 * - 出力: localStorage に `mastodonInstanceDomain=mastodon.social` を保存
 */
export const writeMastodonInstanceDomainSetting = (value: string) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(MASTODON_INSTANCE_DOMAIN_KEY, value)
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * Mastodonインスタンスのドメイン設定を localStorage から削除する。
 *
 * 処理の趣旨:
 * - 「Mastodon連携を有効にする」トグルをOFFにしたとき、設定値そのものを
 *   削除するために使う（空文字での上書きではなく明示的な削除）。
 *
 * Input:
 * - なし
 *
 * Output:
 * - なし
 */
export const removeMastodonInstanceDomainSetting = () => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.removeItem(MASTODON_INSTANCE_DOMAIN_KEY)
    } catch (error) {
        // 削除失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * 「Mastodonにクロスポスト」設定を localStorage から読み取る。
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
export const readCrosspostToMastodonSetting = (defaultValue: boolean) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(CROSSPOST_TO_MASTODON_KEY)
        if (rawValue === null) {
            return defaultValue
        }
        return rawValue === "true"
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「Mastodonにクロスポスト」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `true`
 * - 出力: localStorage に `crosspostToMastodon=true` を保存
 */
export const writeCrosspostToMastodonSetting = (value: boolean) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(CROSSPOST_TO_MASTODON_KEY, String(value))
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}
