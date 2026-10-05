/**
 * 外部SNS（x.com / タイッツー / Mastodon）向け intent 共通処理。
 *
 * 責務と処理概要:
 * - intent 本文の組み立て、intent URL の組み立て、ポップアップの起動
 *   （実処理は `openIntentPopup` に委譲）を対象SNS共通で担う。
 */
import type { IntentMeasure } from "@/util/share/intentLength"
import { openIntentPopup } from "@/util/share/openIntentPopup"
import {
    INTENT_TRAILING_MARGIN,
    INTENT_WEIGHTED_LIMIT,
    truncateBodyWithSuffix,
} from "@/util/share/truncateText"

export type IntentTarget = "x" | "taittsuu" | "mastodon"

// ドメイン名（ホスト名）のみを許可する。ラベルは英数字とハイフンのみ・先頭/末尾ハイフン不可・
// 1〜63文字、ラベルを`.`で1つ以上連結する（最低2ラベル＝ドット必須）。
// この形式チェックにより、サブパス（`/`を含む）やスキーム付き（`http://`等、`:`を含む）の
// 入力は自然に弾かれる。
const MASTODON_DOMAIN_PATTERN =
    /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))+$/

/**
 * Mastodonインスタンスのドメインとして妥当な形式かを判定する。
 *
 * Input:
 * - `value`: 検証対象の文字列
 *
 * Output:
 * - ドメイン名として妥当なら `true`
 *
 * 例:
 * - 入力: "mastodon.social"
 * - 出力: `true`
 * - 入力: "https://mastodon.social/"
 * - 出力: `false`（スキーム・サブパスを含むため）
 */
export const isValidMastodonInstanceDomain = (value: string): boolean => {
    return MASTODON_DOMAIN_PATTERN.test(value.trim())
}

export type BuildIntentTextOptions = {
    /** 指定時のみ、本文を重み付き長 limit 以内へ省略する */
    truncateLimit?: number
    /** 省略時の長さ換算（宛先別。未指定ならX＝twitter-text） */
    measure?: IntentMeasure
}

/**
 * 宛先と設定から、本文の省略上限を決める。
 *
 * 処理の趣旨:
 * - 文字数制限が厳しいX・タイッツーに限り、設定ONの場合のみ上限を返す。
 *   Mastodonは制限が緩いため対象外とする。
 *
 * Input:
 * - `target`: 共有先SNS
 * - `truncateEnabled`: 「長文を省略して共有」設定
 *
 * Output:
 * - 重み付き長の上限（intent先が末尾へ足す空白ぶんの余裕を引いた値）。
 *   省略しない場合は `undefined`
 *
 * 例:
 * - 入力: `"x"`, `true`
 * - 出力: `279`
 */
export const resolveTruncateLimit = (
    target: IntentTarget,
    truncateEnabled: boolean,
): number | undefined =>
    truncateEnabled && (target === "x" || target === "taittsuu")
        ? INTENT_WEIGHTED_LIMIT - INTENT_TRAILING_MARGIN
        : undefined

/**
 * 本文の後ろに付ける末尾文字列（skyshare URL・本文に無いリンクカードURL）を組み立てる。
 *
 * 処理の趣旨:
 * - リンクカードURLは、本文に既に含まれていなければ追加する
 *   （本文側はスキーム省略表記もあり得るため、スキームを除いた形で比較する）。
 * - 文字数カウンタの上限補正と、実際の共有文の組み立てで同じ判定を使うために公開する。
 *
 * Input:
 * - `body`: 本文（前後の空白は除去済みの想定）
 * - `skyshareUri`: skyshare entry URL（無ければ空文字）
 * - `linkCardUrl`: リンクカードの元URL（無ければ省略可）
 *
 * Output:
 * - 改行区切りの末尾文字列（何も付けない場合は空文字）
 *
 * 例:
 * - 入力: `"本文"`, `"https://s/entries/a"`, `"https://example.com"`
 * - 出力: `"https://s/entries/a\nhttps://example.com"`
 */
export const buildIntentSuffix = (
    body: string,
    skyshareUri: string,
    linkCardUrl?: string,
): string => {
    const trimmedLinkCardUrl = linkCardUrl?.trim() ?? ""
    const linkCardUrlWithoutScheme = trimmedLinkCardUrl.replace(
        /^https?:\/\//i,
        "",
    )
    const needsLinkCardUrl =
        linkCardUrlWithoutScheme.length > 0 &&
        !body.includes(linkCardUrlWithoutScheme)
    return [skyshareUri, needsLinkCardUrl ? trimmedLinkCardUrl : ""]
        .filter(part => part.length > 0)
        .join("\n")
}

/**
 * intent に渡す投稿文を組み立てる。
 *
 * 処理の趣旨:
 * - 本文・skyshareUri・リンクカードURLを1つの文字列にまとめる。
 * - リンクカードURLは、本文に既に含まれていなければ末尾に追加する
 *   （本文側はスキーム省略表記もあり得るため、スキームを除いた形で比較する）。
 * - `options.truncateLimit` 指定時のみ、URL部分を削らず
 *   本文を「...」付きで省略して重み付き長を上限以内に収める。
 *
 * Input:
 * - `text`: 元の投稿本文
 * - `skyshareUri`: SkyShare の投稿 URI（無ければ空文字）
 * - `linkCardUrl`: 投稿に添付されたリンクカードの元URL（無ければ省略可）
 * - `options.truncateLimit`: 本文を省略する場合の重み付き長の上限（未指定なら省略しない）
 *
 * Output:
 * - intent に渡す 1 つの文字列
 *
 * 例:
 * - 入力: `"こんにちは"`, `"at://..."`
 * - 出力: `"こんにちは\nat://..."`
 */
export const buildIntentText = (
    text: string,
    skyshareUri: string,
    linkCardUrl?: string,
    options: BuildIntentTextOptions = {},
): string => {
    const normalizedText = text.trim()
    const suffix = buildIntentSuffix(normalizedText, skyshareUri, linkCardUrl)

    if (options.truncateLimit !== undefined) {
        return truncateBodyWithSuffix({
            body: normalizedText,
            suffix,
            limit: options.truncateLimit,
            measure: options.measure,
        }).text
    }
    if (normalizedText.length === 0) {
        return suffix
    }
    if (suffix.length === 0) {
        return normalizedText
    }
    return `${normalizedText}\n${suffix}`
}

export type IntentUrlOptions = {
    /** `target` が "mastodon" の場合のみ必須。ユーザが設定したインスタンスドメイン。 */
    instanceDomain?: string
}

/**
 * 対象SNSの intent URL を組み立てる。
 *
 * Input:
 * - `target`: 対象SNS
 * - `intentText`: intent に渡す投稿文（`buildIntentText` の戻り値を想定）
 * - `options.instanceDomain`: `target` が "mastodon" の場合の投稿先インスタンスドメイン
 *
 * Output:
 * - intent URL文字列。Mastodonでドメイン未指定/不正な場合は `null`
 *
 * 例:
 * - 入力: `"x"`, `"hello"`
 * - 出力: `"https://x.com/intent/tweet?text=hello"`
 */
export const buildIntentUrl = (
    target: IntentTarget,
    intentText: string,
    options: IntentUrlOptions = {},
): string | null => {
    switch (target) {
        case "x": {
            const url = new URL("https://x.com/intent/tweet")
            url.searchParams.set("text", intentText)
            return url.toString()
        }
        case "taittsuu": {
            const url = new URL("https://taittsuu.com/share")
            url.searchParams.set("text", intentText)
            return url.toString()
        }
        case "mastodon": {
            if (!options.instanceDomain) {
                return null
            }
            try {
                const url = new URL(`https://${options.instanceDomain}/share`)
                url.searchParams.set("text", intentText)
                return url.toString()
            } catch (error) {
                return null
            }
        }
    }
}

export type OpenIntentPopupOptions = IntentUrlOptions & {
    /**
     * `preOpenPopupWindow`で事前に開いておいたポップアップウィンドウ
     * （省略時は新規にポップアップを開く。詳細は`openIntentPopup`を参照）
     */
    preOpenedWindow?: Window | null
}

/**
 * 対象SNSの intent 投稿ページをポップアップで開く。
 *
 * Input:
 * - `target`: 対象SNS
 * - `intentText`: intent に渡す投稿文
 * - `options.instanceDomain`: `target` が "mastodon" の場合の投稿先インスタンスドメイン
 * - `options.preOpenedWindow`: 事前に開いておいたポップアップウィンドウ
 *
 * Output:
 * - ウィンドウオープンに成功したら `true`（URL組み立てに失敗した場合は `false`）
 *
 * 例:
 * - 入力: `"x"`, `"hello\nhttps://example.com"`
 * - 出力: `true`
 */
export const openIntentPopupFor = (
    target: IntentTarget,
    intentText: string,
    options: OpenIntentPopupOptions = {},
): boolean => {
    const url = buildIntentUrl(target, intentText, options)
    if (!url) {
        return false
    }
    return openIntentPopup(url, options.preOpenedWindow)
}
