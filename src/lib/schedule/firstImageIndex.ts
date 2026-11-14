/**
 * 保管本文から一覧に表示する添付画像の番号を選ぶ。
 */
import type { StoredPayload } from "@/lib/schedule/validateSchedule"

export const firstImageIndex = (payload: StoredPayload): number | null => {
    for (const post of payload.posts) {
        const index = post.images?.[0]
        if (index !== undefined) return index
    }
    return null
}
