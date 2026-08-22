/**
 * ナビゲーション(Sidebar/FooterNav)の `/accounts` アイコンに、現在ログイン中の
 * アカウントアバターを反映する。
 *
 * 処理の趣旨:
 * - 全ページ `prerender = true` の静的ページであるため、ログイン中アカウントは
 *   サーバーレンダリング時点では分からない。`AccountSwitcher` と同じ
 *   `GET /v2/bsky/session` をクライアント側で叩き、アクティブなアカウントの
 *   `avatarUrl` を `[data-account-avatar-img]` へ反映する。
 * - 取得失敗・未ログイン時はプレースホルダー(NavIcon.astro の初期表示)のまま
 *   フォールバックする。ナビゲーションはページ全体の骨格要素であるため、
 *   アバター取得の失敗でUIを壊さないことを優先する。
 * - Sidebar/FooterNav それぞれの <script> から `import "@/components/layout/nav/syncAccountAvatar"`
 *   の形で副作用importするだけでよい(syncActiveState.ts と同じESMシングルトンの仕組み)。
 */
import { getSession } from "@/client/openapi/client"

const syncAccountAvatar = async () => {
    try {
        const res = await getSession()
        if (res.status !== 200) return

        const active = res.data.accounts.find(account => account.isActive)
        const avatarUrl = active?.avatarUrl
        if (!avatarUrl) return

        document
            .querySelectorAll<HTMLImageElement>("[data-account-avatar-img]")
            .forEach(img => {
                img.src = avatarUrl
                img.hidden = false
            })
    } catch (err) {
        console.error(err)
    }
}

void syncAccountAvatar()
document.addEventListener("astro:page-load", syncAccountAvatar)
