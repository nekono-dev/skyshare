/**
 * Sidebar/FooterNav のナビリンクに、実際のブラウザURLの `?guest=1` を同期し直す。
 *
 * 処理の趣旨:
 * - Sidebar/FooterNav は `prerender = true` なページに埋め込まれており、`href` に
 *   `?guest=1` を付与するかどうかの判定(`guestModeActive`)はビルド時に一度だけ
 *   計算される。ビルド時には実際のリクエストURLが存在しないため、この判定は常に
 *   `false` に固まってしまい、ゲスト表示中でもリンクから `?guest=1` が失われる。
 * - `astro:page-load` は通常のページ読み込み・View Transitionsによる遷移のどちらでも
 *   発火するため、これを契機に実際の `location.search` を見て `href` を補正する。
 * - Sidebar/FooterNav それぞれの <script> から
 *   `import "@/components/layout/nav/syncGuestModeQuery"` の形で副作用importするだけでよい。
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
