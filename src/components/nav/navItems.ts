/**
 * デスクトップ(Sidebar)・モバイル(FooterNav)共通のナビゲーション項目定義。
 *
 * 責務と処理概要:
 * - Sidebar/FooterNav 双方の Astro フロントマター(SSR)と、
 *   syncActiveState.ts(クライアント)の両方から同一の定義を参照できるようにする。
 * - DOM APIに依存しない純粋な値・関数のみを持つ。
 * - Sidebar と FooterNav とで表示順序が異なるため、共通のitem定義から
 *   `sidebarNavItems`/`footerNavItems` をそれぞれ独立に導出する。
 */

export interface NavItem {
    href: string
    label: string
    /** aria-label用のアクセシブルネーム。label は文脈により非表示/hover表示になりうるため、常に表示されるアクセシブルネームをここで独立に持つ。 */
    ariaLabel: string
    /** NavIcon.astro がアイコン画像を出し分けるための判別子 */
    key: "entries" | "post" | "accounts" | "settings"
}

const entries: NavItem = {
    href: "/entries/",
    label: "Entry一覧",
    ariaLabel: "Entry一覧",
    key: "entries",
}
const post: NavItem = {
    href: "/",
    label: "Post一覧",
    ariaLabel: "Post一覧",
    key: "post",
}
const accounts: NavItem = {
    href: "/accounts/",
    label: "アカウントの切り替え",
    ariaLabel: "アカウント切り替え",
    key: "accounts",
}
const settings: NavItem = {
    href: "/settings/",
    label: "設定",
    ariaLabel: "設定",
    key: "settings",
}

/** サイドバー表示順: アカウント → Post一覧 → Entry一覧 → 設定(末尾、新規投稿ボタンの直前) */
export const sidebarNavItems: NavItem[] = [accounts, post, entries, settings]

/** フッター表示順: Entry一覧 → Post一覧 → 設定 → アカウント(サイドバーとは独立に管理する) */
export const footerNavItems: NavItem[] = [entries, post, settings, accounts]

/** 末尾スラッシュを除去し、URL比較を安定させる */
export const normalizePathname = (pathname: string): string =>
    pathname !== "/" && pathname.endsWith("/")
        ? pathname.slice(0, -1)
        : pathname

/**
 * "/" は完全一致のみ、それ以外は将来のサブページ(例: /entries/[slug])も
 * 同じボタンをアクティブ扱いできるよう前方一致で判定する。
 *
 * 処理の趣旨:
 * - `href` は末尾スラッシュ付き(例: "/settings/")で定義される一方、
 *   `currentPathname` は呼び出し側で必ず `normalizePathname` 済み(末尾スラッシュなし)
 *   のため、比較前に `href` 側も正規化しないと "/settings" === "/settings/" が
 *   常に不一致になり、自ページのナビ項目がアクティブ判定されない。
 */
export const isActiveHref = (
    href: string,
    currentPathname: string,
): boolean => {
    const normalizedHref = normalizePathname(href)
    return normalizedHref === "/"
        ? currentPathname === "/"
        : currentPathname === normalizedHref ||
              currentPathname.startsWith(`${normalizedHref}/`)
}
