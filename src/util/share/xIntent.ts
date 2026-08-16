/**
 * x.com intent 起動ユーティリティ。
 *
 * 責務と処理概要:
 * - 投稿本文と SkyShare URI から intent 用テキストを生成する。
 * - x.com 投稿ページのポップアップを起動する。
 */

/**
 * 現在のユーザーエージェントが Safari 系かを判定する。
 *
 * 処理の趣旨:
 * - Safari では `window.open` が null を返しても実際には新規タブが開くケースがある。
 * - 戻り値だけで誤って失敗扱いしないための補助判定として使う。
 *
 * Input:
 * - なし
 *
 * Output:
 * - Safari 系ブラウザと推定できる場合は `true`
 *
 * 例:
 * - 入力: なし
 * - 出力: `true`（iOS Safari の場合）
 */
const isLikelySafari = () => {
    if (typeof navigator === "undefined") {
        return false
    }

    const userAgent = navigator.userAgent
    return (
        userAgent.includes("Safari") &&
        !userAgent.includes("Chrome") &&
        !userAgent.includes("Chromium") &&
        !userAgent.includes("Android")
    )
}

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
        const popupWindow = window.open(
            intentUrl.toString(),
            "_blank",
            "noopener,noreferrer",
        )
        if (popupWindow !== null) {
            return true
        }

        // Safari では null 戻りでも実際にタブ遷移できるケースを成功扱いにする。
        return isLikelySafari()
    } catch (error) {
        return false
    }
}
