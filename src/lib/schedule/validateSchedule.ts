/**
 * 予約の作成入力の検証と、保管形式への変換。
 *
 * 責務と処理概要:
 * - 実行時刻（ISO 8601）を UNIX 秒へ変換し、現在から MIN_LEAD_SECONDS 以上
 *   MAX_LEAD_SECONDS 以下の範囲にあるかを判定する。
 * - 作成の入力に含まれる画像（投稿の画像・リンクカードの画像・代表画像）を取り出して
 *   番号を振り、本文の JSON からは番号の参照に置き換える。実行時にこの番号で R2 の画像を引く。
 */
import type { RequestBodyType } from "@/lib/api/schema/v2/schedules/post"
import { MAX_LEAD_SECONDS, MIN_LEAD_SECONDS } from "./scheduleLimits"

export { getScheduleLimits } from "./scheduleLimits"

export const validateRunAt = (
    runAt: string,
    nowSeconds: number,
): { ok: true; epoch: number } | { ok: false } => {
    const ms = Date.parse(runAt)
    if (!Number.isFinite(ms)) return { ok: false }
    const epoch = Math.floor(ms / 1000)
    if (epoch < nowSeconds + MIN_LEAD_SECONDS) return { ok: false }
    if (epoch > nowSeconds + MAX_LEAD_SECONDS) return { ok: false }
    return { ok: true, epoch }
}

/** 保管する投稿1件。画像は `images` 配列の番号で参照する。 */
export type StoredPost = {
    text?: string
    facets?: unknown
    langs?: string[]
    selfLabels?: string
    gate?: unknown
    ogMeta?: unknown
    imagesMeta?: unknown
    /** 画像の番号の配列 */
    images?: number[]
    /** リンクカードの画像の番号 */
    ogImage?: number
}

export type StoredPayload = {
    posts: StoredPost[]
    reply?: unknown
    createEntry?: boolean
    /** 代表画像の番号 */
    visual?: number
    heading?: string
    caption?: string
}

export type StagedImage = { bytes: ArrayBuffer; mime: string }

export const toStoredPayload = async (
    body: RequestBodyType,
): Promise<{ payload: StoredPayload; images: StagedImage[] }> => {
    const images: StagedImage[] = []
    const stage = async (blob: Blob): Promise<number> => {
        images.push({
            bytes: await blob.arrayBuffer(),
            mime: blob.type || "application/octet-stream",
        })
        return images.length - 1
    }

    const posts: StoredPost[] = []
    for (const item of body.posts) {
        const post: StoredPost = {
            text: item.text,
            facets: item.facets,
            langs: item.langs,
            selfLabels: item.selfLabels,
            gate: item.gate,
        }
        if ("ogMeta" in item && item.ogMeta) post.ogMeta = item.ogMeta
        if ("imagesMeta" in item && item.imagesMeta) {
            post.imagesMeta = item.imagesMeta
        }
        if ("images" in item && item.images && item.images.length > 0) {
            post.images = []
            for (const image of item.images)
                post.images.push(await stage(image))
        }
        if ("ogImage" in item && item.ogImage) {
            post.ogImage = await stage(item.ogImage)
        }
        posts.push(post)
    }

    const payload: StoredPayload = {
        posts,
        reply: body.reply,
        createEntry: body.createEntry,
        heading: body.heading,
        caption: body.caption,
    }
    if (body.visual) payload.visual = await stage(body.visual)
    return { payload, images }
}
