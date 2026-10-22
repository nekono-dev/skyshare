/**
 * 予約投稿の制限値。
 *
 * 責務と処理概要:
 * - 実行時刻の範囲・待機中の件数・投稿数の上限を1か所に定義する。
 * - 作成時の検証と、画面へ返す制限値の応答が、同じ定数を参照する。
 */
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/threadLimit"
import { MAX_IMAGE_BYTES_PER_SCHEDULE } from "./types"

export const MIN_LEAD_SECONDS = 5 * 60
export const MAX_LEAD_SECONDS = 14 * 24 * 60 * 60
export const MAX_PENDING_PER_ACCOUNT = 5

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
