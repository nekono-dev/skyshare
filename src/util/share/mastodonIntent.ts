/**
 * Mastodon intent 起動ユーティリティ。
 *
 * 責務と処理概要:
 * - 投稿本文と SkyShare URI から intent 用テキストを生成する。
 * - ユーザが設定したMastodonインスタンスのドメインを使い、投稿ページのポップアップを起動する
 *   （実際のポップアップ処理は `openIntentPopup` に委譲する）。
 * - X/タイッツーと異なり全ユーザ共通のURLを持てないため、インスタンスドメインを引数で受け取る。
 */
import { openIntentPopup } from "@/util/share/openIntentPopup"

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
 * Mastodon intent に渡す投稿文を組み立てる。
 *
 * Input:
 * - `text`: 元の投稿本文
 * - `skyshareUri`: SkyShare の投稿 URI
 *
 * Output:
 * - Mastodon intent に渡す 1 つの文字列
 *
 * 例:
 * - 入力: "こんにちは", "at://..."
 * - 出力: "こんにちは\nat://..."
 */
export const buildMastodonIntentText = (text: string, skyshareUri: string) => {
    const normalizedText = text.trim()
    if (normalizedText.length === 0) {
        return skyshareUri
    }
    return `${normalizedText}\n${skyshareUri}`
}

/**
 * Mastodon intent 投稿ページをポップアップで開く。
 *
 * Input:
 * - `instanceDomain`: ユーザが設定したMastodonインスタンスのドメイン（例: "mastodon.social"）
 * - `intentText`: intent に渡す投稿文字列
 * - `preOpenedWindow`: `preOpenPopupWindow`で事前に開いておいたウィンドウ
 *   （省略時は新規にポップアップを開く。詳細は`openIntentPopup`を参照）
 *
 * Output:
 * - ウィンドウオープンに成功したら `true`
 *
 * 例:
 * - 入力: "mastodon.social", "hello"
 * - 出力: `true`
 */
export const openMastodonIntentPopup = (
    instanceDomain: string,
    intentText: string,
    preOpenedWindow?: Window | null,
) => {
    if (typeof window === "undefined") {
        return false
    }

    try {
        const intentUrl = new URL(`https://${instanceDomain}/share`)
        // searchParams.set が text の値をURLエンコードする。
        intentUrl.searchParams.set("text", intentText)

        return openIntentPopup(intentUrl.toString(), preOpenedWindow)
    } catch (error) {
        return false
    }
}
