/**
 * Sidebar・FooterNav のナビリンクに、実際のブラウザ URL の `?guest=1` を反映する。
 *
 * - 両コンポーネントは `prerender = true` のページに埋め込まれ、ビルド時にはリクエスト URL が無いため、
 *   `href` へ `?guest=1` を付ける判定が常に偽になり、ゲスト表示中でもリンクから失われる。
 *   通常の読み込みと View Transitions の両方で発火する `astro:page-load` で `location.search` を見て補う。
 * - 両コンポーネントの `<script>` から副作用 import するだけでよい。
 */
import { isGuestModeRequested, withGuestModeQuery } from "@/lib/guestMode"

const syncGuestModeQuery = () => {
    const guestModeActive = isGuestModeRequested()
    document
        .querySelectorAll<HTMLAnchorElement>("[data-nav] a[href]")
        .forEach(link => {
            const href = link.getAttribute("href") ?? ""
            const [path] = href.split("?")
            link.setAttribute("href", withGuestModeQuery(path, guestModeActive))
        })
}

syncGuestModeQuery()
document.addEventListener("astro:page-load", syncGuestModeQuery)
