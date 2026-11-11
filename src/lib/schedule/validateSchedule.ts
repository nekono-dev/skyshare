/** 予約の作成入力を検証し、実行時に画像を参照できる保管形式へ変換する。 */
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
