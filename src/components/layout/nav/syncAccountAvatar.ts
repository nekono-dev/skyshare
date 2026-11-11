/**
 * Sidebar と FooterNav のアカウントアイコンへ、アクティブアカウントのアバターを補う。
 *
 * - アバターの URL は prerender 時に分からないため、クライアントで取得して `NavIcon` の
 *   `data-account-avatar-img` に設定する。取得に失敗したらプレースホルダーのままにする。
 * - アカウントの切り替えが起こり得るため、`astro:page-load` ごとにキャッシュを捨てて取得し直す。
 */
import {
    getActiveAccountInfo,
    resetActiveAccountInfoCache,
} from "@/lib/session/activeAccountSession"

const syncAccountAvatar = async () => {
    try {
        const { avatarUrl } = await getActiveAccountInfo()
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
document.addEventListener("astro:page-load", () => {
    resetActiveAccountInfoCache()
    void syncAccountAvatar()
})
