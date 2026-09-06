import {
    getActiveAccountInfo,
    resetActiveAccountInfoCache,
} from "@/lib/account/activeAccountSession"

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
