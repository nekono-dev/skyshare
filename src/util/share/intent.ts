/**
 * 外部SNS（x.com / タイッツー / Mastodon）向け intent 共通処理。
 *
 * 責務と処理概要:
 * - intent 本文の組み立て、intent URL の組み立て、ポップアップの起動
 *   （実処理は `openIntentPopup` に委譲）を対象SNS共通で担う。
 */
import { openIntentPopup } from "@/util/share/openIntentPopup"

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

/**
 * intent に渡す投稿文を組み立てる。
 *
 * 処理の趣旨:
 * - 本文・skyshareUri・リンクカードURLを1つの文字列にまとめる。
 * - リンクカードURLは、本文に既に含まれていなければ末尾に追加する
 *   （本文側はスキーム省略表記もあり得るため、スキームを除いた形で比較する）。
 *
 * Input:
 * - `text`: 元の投稿本文
 * - `skyshareUri`: SkyShare の投稿 URI（無ければ空文字）
 * - `linkCardUrl`: 投稿に添付されたリンクカードの元URL（無ければ省略可）
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
): string => {
    const normalizedText = text.trim()
    const trimmedLinkCardUrl = linkCardUrl?.trim() ?? ""
    const linkCardUrlWithoutScheme = trimmedLinkCardUrl.replace(
        /^https?:\/\//i,
        "",
    )
    const needsLinkCardUrl =
        linkCardUrlWithoutScheme.length > 0 &&
        !normalizedText.includes(linkCardUrlWithoutScheme)
    const suffix = [skyshareUri, needsLinkCardUrl ? trimmedLinkCardUrl : ""]
        .filter(part => part.length > 0)
        .join("\n")

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
