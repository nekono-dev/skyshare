/**
 * x.com intent 起動ユーティリティ。
 *
 * 責務と処理概要:
 * - 投稿本文と SkyShare URI から intent 用テキストを生成する。
 * - x.com 投稿ページのポップアップを起動する（実際のポップアップ処理は
 *   `openIntentPopup` に委譲する）。
 */
import { openIntentPopup } from "@/util/share/openIntentPopup"

/**
 * x.com intent に渡す投稿文を組み立てる。
 *
 * Input:
 * - `text`: 元の投稿本文
 * - `skyshareUri`: SkyShare の投稿 URI
 *
 * Output:
 * - x.com intent に渡す 1 つの文字列
 *
 * 例:
 * - 入力: `"こんにちは"`, `"at://..."`
 * - 出力: `"こんにちは\nat://..."`
 */
export const buildXIntentText = (text: string, skyshareUri: string) => {
    const normalizedText = text.trim()
    if (normalizedText.length === 0) {
        return skyshareUri
    }
    if (skyshareUri.length === 0) {
        return normalizedText
    }
    return `${normalizedText}\n${skyshareUri}`
}

/**
 * x.com intent 投稿ページをポップアップで開く。
 *
 * Input:
 * - `intentText`: intent に渡す投稿文字列
 * - `preOpenedWindow`: `preOpenPopupWindow`で事前に開いておいたウィンドウ
 *   （省略時は新規にポップアップを開く。詳細は`openIntentPopup`を参照）
 *
 * Output:
 * - ウィンドウオープンに成功したら `true`
 *
 * 例:
 * - 入力: `"hello\nhttps://example.com"`
 * - 出力: `true`
 */
export const openXIntentPopup = (
    intentText: string,
    preOpenedWindow?: Window | null,
) => {
    if (typeof window === "undefined") {
        return false
    }

    const intentUrl = new URL("https://x.com/intent/tweet")
    intentUrl.searchParams.set("text", intentText)

    return openIntentPopup(intentUrl.toString(), preOpenedWindow)
}
