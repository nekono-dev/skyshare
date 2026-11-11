/**
 * Sidebar と FooterNav が共有するナビゲーション項目と、現在地の判定。
 *
 * - Sidebar・FooterNav の Astro フロントマター（SSR）と `syncActiveState.ts`（クライアント）が
 *   同じ定義を参照するため、DOM API に依存しない値と関数だけを置く。文言は文言キーで持つ。
 * - 表示順が Sidebar と FooterNav で異なるため、共通の項目から `sidebarNavItems`・`footerNavItems` を別々に並べる。
 */
import type { PlainMessageKey } from "@/lib/i18n/translate"

export interface NavItem {
    href: string
    /** 表示ラベルの文言キー（翻訳は描画側で行う） */
    labelKey: PlainMessageKey
    /** aria-label用のアクセシブルネームの文言キー。label は文脈により非表示/hover表示になりうるため、常に表示されるアクセシブルネームをここで独立に持つ。 */
    ariaLabelKey: PlainMessageKey
    /** NavIcon.astro がアイコン画像を出し分けるための判別子 */
    key: "entries" | "post" | "accounts" | "settings"
}

const entries: NavItem = {
    href: "/entries/",
    labelKey: "nav.entries",
    ariaLabelKey: "nav.entries",
    key: "entries",
}
const post: NavItem = {
    href: "/",
    labelKey: "nav.post",
    ariaLabelKey: "nav.post",
    key: "post",
}
const accounts: NavItem = {
    href: "/accounts/",
    labelKey: "nav.accounts",
    ariaLabelKey: "nav.accountsAria",
    key: "accounts",
}
const settings: NavItem = {
    href: "/settings/",
    labelKey: "nav.settings",
    ariaLabelKey: "nav.settings",
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
