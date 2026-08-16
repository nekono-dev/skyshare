/**
 * `transition:persist` でDOMを保持したナビ(Sidebar/FooterNav)の `aria-current` を、
 * 遷移後の実際のURLに合わせて再計算する。
 *
 * 処理の趣旨:
 * - `transition:persist` は遷移先ページが本来レンダリングした新しいDOM(正しい
 *   `aria-current` を含む)を捨て、遷移前ページのDOMをそのまま使い回す。
 *   そのため `aria-current` はサーバー側の計算のままでは古い遷移元ページの値が残り続ける。
 * - `astro:page-load` は通常のページ読み込み・View Transitionsによる遷移のどちらでも
 *   発火するため、これを契機に現在地ベースで再計算する。
 * - Sidebar/FooterNav それぞれの <script> から `import "@/components/nav/syncActiveState"`
 *   の形で副作用importするだけでよい。本モジュールの初期化はESモジュールの仕様上
 *   ブラウザ内で一度しかインスタンス化されないため、複数コンポーネントからimportされても
 *   初回同期・イベント登録は重複しない。
 */
import { normalizePathname, isActiveHref } from "./navItems"

const syncNavActiveState = () => {
    const current = normalizePathname(location.pathname)
    document
        .querySelectorAll<HTMLAnchorElement>("[data-nav] a[href]")
        .forEach(link => {
            const href = link.getAttribute("href") ?? ""
            if (isActiveHref(href, current)) {
                link.setAttribute("aria-current", "page")
            } else {
                link.removeAttribute("aria-current")
            }
        })
}

syncNavActiveState()
document.addEventListener("astro:page-load", syncNavActiveState)
