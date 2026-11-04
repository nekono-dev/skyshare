/**
 * Mastodon・Misskey のインスタンスドメインの既定値・検証・保存を扱う。
 *
 * 責務と処理概要:
 * - 保存値から実際に使うドメインを決める（空白は既定値、不正な形式は `null`）。
 * - Mastodon・Misskey のドメインを localStorage から読み書き・削除する。
 */
import { isValidInstanceDomain } from "@/lib/share/intent"
import type { AutoPopupTarget } from "@/lib/share/autoPopupTarget"

const MASTODON_INSTANCE_DOMAIN_KEY = "mastodonInstanceDomain"
const MISSKEY_INSTANCE_DOMAIN_KEY = "misskeyInstanceDomain"

/** Mastodonインスタンスドメインが未設定の場合に使う既定値。 */
export const DEFAULT_MASTODON_INSTANCE_DOMAIN = "mastodon.social"

/** Misskeyインスタンスドメインが未設定の場合に使う既定値。 */
export const DEFAULT_MISSKEY_INSTANCE_DOMAIN = "misskey.io"

/**
 * 保存されているインスタンスドメインから、実際に投稿先として使うドメインを決める。
 *
 * Input:
 * - `rawDomain`: 保存値（未設定は空文字）
 * - `defaultDomain`: 空白のみの場合に使う既定ドメイン
 *
 * Output:
 * - 空白のみなら既定ドメイン、妥当な形式ならそのドメイン（前後の空白は除去）、
 *   不正な形式なら `null`
 */
const resolveInstanceDomain = (
    rawDomain: string,
    defaultDomain: string,
): string | null => {
    const trimmed = rawDomain.trim()
    if (trimmed === "") {
        return defaultDomain
    }
    return isValidInstanceDomain(trimmed) ? trimmed : null
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
): string | null =>
    resolveInstanceDomain(rawDomain, DEFAULT_MASTODON_INSTANCE_DOMAIN)

/**
 * 保存されているMisskeyインスタンスドメインから、実際に投稿先として使うドメインを決める。
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
 * - 出力: `"misskey.io"`
 * - 入力: `"https://example.com/"`
 * - 出力: `null`
 */
export const resolveMisskeyInstanceDomain = (
    rawDomain: string,
): string | null =>
    resolveInstanceDomain(rawDomain, DEFAULT_MISSKEY_INSTANCE_DOMAIN)

/**
 * 共有先が投稿先インスタンスを要する場合に、実際に使うドメインを決める。
 *
 * 処理の趣旨:
 * - Mastodon・Misskey は利用者が設定したインスタンスへ共有するため、保存値から
 *   投稿先ドメインを決める。それ以外の共有先はインスタンスを持たない。
 *
 * Input:
 * - `target`: 共有先（自動ポップアップ先を含む）
 * - `saved.mastodonInstanceDomain`/`saved.misskeyInstanceDomain`: 各保存値（未設定は空文字）
 *
 * Output:
 * - インスタンスを持たない共有先なら `undefined`、持つ共有先なら使うドメイン。
 *   保存値が不正な形式なら `null`
 *
 * 例:
 * - 入力: `"misskey"`, `{ mastodonInstanceDomain: "", misskeyInstanceDomain: "" }`
 * - 出力: `"misskey.io"`
 * - 入力: `"x"`, `{ ... }`
 * - 出力: `undefined`
 */
export const resolveInstanceDomainFor = (
    target: AutoPopupTarget,
    saved: { mastodonInstanceDomain: string; misskeyInstanceDomain: string },
): string | null | undefined => {
    switch (target) {
        case "mastodon":
            return resolveMastodonInstanceDomain(saved.mastodonInstanceDomain)
        case "misskey":
            return resolveMisskeyInstanceDomain(saved.misskeyInstanceDomain)
        default:
            return undefined
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
 * Misskeyインスタンスのドメインを localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定時に返す既定値
 *
 * Output:
 * - 保存済みドメイン文字列。未設定/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `""`
 * - 出力: `"misskey.io"`（保存済み値がある場合）
 */
export const readMisskeyInstanceDomainSetting = (defaultValue: string) => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(
            MISSKEY_INSTANCE_DOMAIN_KEY,
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
 * Misskeyインスタンスのドメインを localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したいドメイン文字列
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: `"misskey.io"`
 * - 出力: localStorage に `misskeyInstanceDomain=misskey.io` を保存
 */
export const writeMisskeyInstanceDomainSetting = (value: string) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(MISSKEY_INSTANCE_DOMAIN_KEY, value)
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * Misskeyインスタンスのドメイン設定を localStorage から削除する。
 *
 * 処理の趣旨:
 * - 入力欄が空に戻されたとき、空文字での上書きではなく明示的に削除して既定値へ戻す。
 *
 * Input:
 * - なし
 *
 * Output:
 * - なし
 */
export const removeMisskeyInstanceDomainSetting = () => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.removeItem(MISSKEY_INSTANCE_DOMAIN_KEY)
    } catch (error) {
        // 削除失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}
