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
    key: "entries" | "post" | "accounts"
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

/** サイドバー表示順: アカウント → Post一覧 → Entry一覧 */
export const sidebarNavItems: NavItem[] = [accounts, post, entries]

/** フッター表示順: Entry一覧 → Post一覧 → アカウント(サイドバーとは独立に管理する) */
export const footerNavItems: NavItem[] = [entries, post, accounts]

/** 末尾スラッシュを除去し、URL比較を安定させる */
export const normalizePathname = (pathname: string): string =>
    pathname !== "/" && pathname.endsWith("/")
        ? pathname.slice(0, -1)
        : pathname

/**
 * "/" は完全一致のみ、それ以外は将来のサブページ(例: /entries/[slug])も
 * 同じボタンをアクティブ扱いできるよう前方一致で判定する。
 */
export const isActiveHref = (href: string, currentPathname: string): boolean =>
    href === "/"
        ? currentPathname === "/"
        : currentPathname === href || currentPathname.startsWith(`${href}/`)
