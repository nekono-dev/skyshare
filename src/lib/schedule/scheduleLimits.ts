/** 予約投稿の入力検証と画面表示で共有する制限値。 */
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/threadLimit"
import { MAX_IMAGE_BYTES_PER_SCHEDULE } from "./types"

export const MIN_LEAD_SECONDS = 5 * 60
export const MAX_LEAD_SECONDS = 14 * 24 * 60 * 60
export const MAX_PENDING_PER_ACCOUNT = 3

export type ScheduleLimits = {
    minLeadSeconds: number
    maxLeadSeconds: number
    maxPending: number
    maxImageBytes: number
    maxPosts: number
}

export const getScheduleLimits = (): ScheduleLimits => ({
    minLeadSeconds: MIN_LEAD_SECONDS,
    maxLeadSeconds: MAX_LEAD_SECONDS,
    maxPending: MAX_PENDING_PER_ACCOUNT,
    maxImageBytes: MAX_IMAGE_BYTES_PER_SCHEDULE,
    maxPosts: MAX_THREAD_POST_COUNT,
})
