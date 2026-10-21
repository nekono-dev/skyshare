/**
 * 投稿共有設定の永続化ユーティリティ。
 *
 * 責務と処理概要:
 * - 投稿フォームが参照する共有設定を localStorage で管理する。
 * - SSR/プライベートモードなどで localStorage が利用不可でも安全に既定値へフォールバックする。
 * - 「自動ポップアップするSNS」の読み取り時に、公開済みの旧共有設定からの引き継ぎ
 *   （`legacyShareSettings.ts`）を先に実行する。
 */
import { migrateLegacyShareSettings } from "@/lib/settings/legacyShareSettings"
import { isValidMastodonInstanceDomain } from "@/util/share/intent"

const POPUP_INTENT_INSTEAD_OF_WEBSHARE_KEY = "popupIntentInsteadOfWebshare"
const AUTO_POPUP_TARGET_KEY = "autoPopupTarget"
const TRUNCATE_INTENT_TEXT_KEY = "truncateIntentText"
const PINNED_FORM_DISABLED_KEY = "pinnedFormDisabled"
const MANUAL_IMAGE_ATTACH_KEY = "manualImageAttach"
const TEXTAREA_ROWS_KEY = "textareaRows"
const MASTODON_INSTANCE_DOMAIN_KEY = "mastodonInstanceDomain"

/** Mastodonインスタンスドメインが未設定の場合に使う既定値。 */
export const DEFAULT_MASTODON_INSTANCE_DOMAIN = "mastodon.social"

/** 投稿後に自動でポップアップするSNS（"ask" は投稿先選択ダイアログを開く）。 */
export const AUTO_POPUP_TARGETS = ["ask", "x", "taittsuu", "mastodon"] as const
export type AutoPopupTarget = (typeof AUTO_POPUP_TARGETS)[number]

/** 「自動ポップアップするSNS」が未設定の場合に使う既定値。 */
export const DEFAULT_AUTO_POPUP_TARGET: AutoPopupTarget = "x"

/**
 * 値が `AutoPopupTarget` かを判定する。
 *
 * Input:
 * - `value`: 判定対象（外部入力を想定。文字列以外も受け付ける）
 *
 * Output:
 * - `AUTO_POPUP_TARGETS` のいずれかなら `true`
 *
 * 例:
 * - 入力: `"taittsuu"`
 * - 出力: `true`
 */
export const isAutoPopupTarget = (value: unknown): value is AutoPopupTarget =>
    AUTO_POPUP_TARGETS.some(target => target === value)

/**
 * 「自動ポップアップするSNS」設定を localStorage から読み取る。
 *
 * 処理の趣旨:
 * - 公開済みの旧共有設定が残っている場合に備え、読み取りの前に引き継ぎ
 *   （`migrateLegacyShareSettings`）を実行する。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合・未設定時・不正な値の場合に返す既定値
 *
 * Output:
 * - 保存済み設定値。未設定/不正/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `"x"`
 * - 出力: `"taittsuu"`（保存済み値が taittsuu の場合）
 */
export const readAutoPopupTargetSetting = (
    defaultValue: AutoPopupTarget,
): AutoPopupTarget => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    migrateLegacyShareSettings()

    try {
        const rawValue = window.localStorage.getItem(AUTO_POPUP_TARGET_KEY)
        return isAutoPopupTarget(rawValue) ? rawValue : defaultValue
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「自動ポップアップするSNS」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし（保存失敗時は UI 動作を優先し、例外を握りつぶす）
 *
 * 例:
 * - 入力: `"ask"`
 * - 出力: localStorage に `autoPopupTarget=ask` を保存
 */
export const writeAutoPopupTargetSetting = (value: AutoPopupTarget) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(AUTO_POPUP_TARGET_KEY, value)
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * 保存されているMastodonインスタンスドメインから、実際に投稿先として使うドメインを決める。
 *
 * Input:
 * - `rawDomain`: 保存値（未設定は空文字）
 *
 * Output:
 * - 空白のみなら既定ドメイン、妥当な形式ならそのドメイン（前後の空白は除去）、
 *   不正な形式なら `null`
 *
 * 例:
 * - 入力: `""`
 * - 出力: `"mastodon.social"`
 * - 入力: `"https://example.com/"`
 * - 出力: `null`
 */
export const resolveMastodonInstanceDomain = (
    rawDomain: string,
): string | null => {
    const trimmed = rawDomain.trim()
    if (trimmed === "") {
        return DEFAULT_MASTODON_INSTANCE_DOMAIN
    }
    return isValidMastodonInstanceDomain(trimmed) ? trimmed : null
}

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
