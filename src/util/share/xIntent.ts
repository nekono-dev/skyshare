/**
 * x.com intent 起動ユーティリティ。
 *
 * 責務と処理概要:
 * - 投稿本文と SkyShare URI から intent 用テキストを生成する。
 * - x.com 投稿ページのポップアップを起動する。
 */

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
    return `${normalizedText}\n${skyshareUri}`
}

/**
 * x.com intent 投稿ページをポップアップで開く。
 *
 * Input:
 * - `intentText`: intent に渡す投稿文字列
 *
 * Output:
 * - ウィンドウオープンに成功したら `true`
 *
 * 例:
 * - 入力: `"hello\nhttps://example.com"`
 * - 出力: `true`
 */
export const openXIntentPopup = (intentText: string) => {
    if (typeof window === "undefined") {
        return false
    }

    const intentUrl = new URL("https://x.com/intent/post")
    intentUrl.searchParams.set("text", intentText)

    try {
        const popupWindow = window.open(intentUrl.toString(), "_blank")
        if (popupWindow === null) {
            return false
        }

        // windowFeatures で noopener を指定すると戻り値が常に null になり
        // 成功判定ができなくなるため、開いた後に opener を手動で切り離す。
        popupWindow.opener = null
        return true
    } catch (error) {
        return false
    }
}
