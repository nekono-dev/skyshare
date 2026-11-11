/**
 * `transition:persist` で保持した Sidebar・FooterNav の `aria-current` を、遷移後の URL で再計算する。
 *
 * - 遷移先の新しい DOM（正しい `aria-current` を含む）は捨てられ、遷移前の DOM が使い回されるため、
 *   サーバーが計算した値は遷移元のまま残る。通常の読み込みと View Transitions の両方で発火する
 *   `astro:page-load` を契機に直す。
 * - 両コンポーネントの `<script>` から副作用 import するだけでよい。ES モジュールはブラウザ内で
 *   一度しか評価されないため、初回の同期とイベント登録は重複しない。
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
