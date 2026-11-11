/**
 * クリックが現在のタブで別ページへ移動するリンク操作かを判定する。
 * アプリ固有の知識に依存せず、同一ページ内のハッシュ移動は除外する。
 */

/** 判定に使うクリックのイベントの形（`MouseEvent` の部分） */
export type ClickLike = {
    defaultPrevented: boolean
    button: number
    metaKey: boolean
    ctrlKey: boolean
    shiftKey: boolean
    altKey: boolean
    target: EventTarget | null
}

/** 判定に使う現在の住所の形（`Location` の部分） */
export type LocationLike = { href: string }

/**
 * 現在のタブで別のページへ移るリンクのクリックなら、移る先を返す。
 *
 * Input:
 * - `event`: クリックのイベント
 * - `current`: 現在の住所
 *
 * Output: 移る先の URL。移る操作でなければ null
 *
 * Example:
 * - 同じオリジンの `<a href="/settings/">` の通常のクリック → `URL("https://example.com/settings/")`
 * - `target="_blank"` のリンク、Ctrl+クリック、`#section` だけの違い → null
 */
export const navigatingLinkTarget = (
    event: ClickLike,
    current: LocationLike,
): URL | null => {
    if (event.defaultPrevented || event.button !== 0) return null
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return null
    }
    const element = event.target as Element | null
    const anchor = element?.closest?.("a[href]") as HTMLAnchorElement | null
    if (!anchor) return null
    const targetWindow = anchor.getAttribute("target")
    if (targetWindow && targetWindow !== "_self") return null
    if (anchor.hasAttribute("download")) return null

    let to: URL
    try {
        to = new URL(anchor.getAttribute("href") ?? "", current.href)
    } catch {
        return null
    }
    // http(s) 以外（mailto: など）はこのタブのページを離れない
    if (to.protocol !== "https:" && to.protocol !== "http:") return null
    const from = new URL(current.href)
    if (
        to.origin === from.origin &&
        to.pathname === from.pathname &&
        to.search === from.search
    ) {
        return null
    }
    return to
}
