/**
 * 投稿に含まれる Entry 素材・埋め込み・画像や動画のアップロードを準備する。
 *
 * - `lib/api` に依存せず、ページが検証した値をこの領域の型で受け取る。
 * - 想定可能な失敗は `Outcome.status` で返し、予期しない例外は呼び出し側へ投げる。
 * - 埋め込みは動画、画像、OGP の順に優先し、visual は一度だけアップロードする。
 */

import { uploadBlob } from "@/lib/atproto/blob"
import { validateFacets } from "@/lib/atproto/facet"
import {
    createExternalEmbed,
    createImageEmbed,
    createVideoEmbed,
    validateImageMetadata,
} from "@/lib/atproto/embed"
import type { PostGateValue } from "@/lib/atproto/gate"
import type {
    BskyFacets,
    BskyImagesMeta,
    BskyOgMeta,
    BskyVideoBlob,
    BskyVideoMeta,
} from "@/lib/atproto/recordTypes"
import type {
    ThreadEntryInput,
    ThreadPostInput,
} from "@/lib/entry/createBskyThread"
import type { Outcome } from "@/types/outcome"

/** blob のアップロードに使う Agent（最小インターフェース）。 */
export type EntryMediaAgent = Parameters<typeof uploadBlob>[0]

/**
 * createEntry の検証（5a）の入力。
 * ページが検証済みの値を、この領域の型で受け取る。
 */
export type CreateEntryCheckInput = {
    createEntry?: boolean
    visual?: Blob
}

/**
 * posts の 1 件分の入力（5b）。
 * 動画・画像・OGP の各項目は、投稿の形に応じて省略される。
 */
export type EntryPostMediaInput = {
    text?: string
    facets?: BskyFacets
    langs?: string[]
    selfLabels?: string
    gate?: PostGateValue
    images?: Blob[]
    imagesMeta?: BskyImagesMeta
    ogImage?: Blob
    ogMeta?: BskyOgMeta
    video?: BskyVideoBlob
    videoMeta?: BskyVideoMeta
}

/**
 * entry 作成の入力（5c）。
 * `visual` は createEntry が true のときだけ使う。
 */
export type CreateEntryUploadInput = {
    createEntry?: boolean
    visual?: Blob
    heading?: string
    caption?: string
}

/**
 * フェーズ 5a: createEntry:true の検証。
 *
 * 処理の趣旨:
 * - createEntry が true なら visual が必須。posts 全体を見て初めて判定できるため、
 *   個々の posts[i] の検証より先に呼び出す。
 *
 * 失敗時の方針:
 * - visual がなければ 400。
 */
export const validateCreateEntry = (
    input: CreateEntryCheckInput,
): Outcome<void> => {
    const wantsEntry = input.createEntry === true
    if (wantsEntry) {
        if (!input.visual) {
            console.warn("createEntry: createEntry flag requires visual")
            return { ok: false, status: 400 }
        }
    }
    return { ok: true, value: undefined }
}

/**
 * フェーズ 5b: posts の 1 件分について、検証・embed 作成・アップロードを行う。
 *
 * 処理の趣旨:
 * - 画像メタデータ検証、facets 検証の順に行う。
 * - embed は、動画、画像、OGP の順に優先して作る。画像と OGP は Bluesky 上で同時に
 *   埋め込めないため、画像が指定されていればそちらを使う。
 * - 画像（または OGP の画像）は、埋め込みの作成の前にアップロードする。
 *
 * Output:
 * - 成功時: スレッドの 1 件分の入力（`ThreadPostInput`）
 *
 * 失敗時の方針:
 * - 画像メタデータ・facets・OGP の埋め込みの検証の失敗は 400。
 * - 画像・OGP 画像のアップロードの失敗は 500。
 */
export const preparePostMedia = async (
    agent: EntryMediaAgent,
    item: EntryPostMediaInput,
): Promise<Outcome<ThreadPostInput>> => {
    const images = item.images
    const imagesMeta = item.imagesMeta
    const ogImage = item.ogImage
    const ogMeta = item.ogMeta
    const hasImages = !!images && images.length > 0

    try {
        validateImageMetadata(images, imagesMeta)
    } catch (err) {
        console.warn("createEntry: image metadata validation failed", err)
        return { ok: false, status: 400 }
    }

    const postText = item.text ?? ""
    try {
        validateFacets(postText, item.facets)
    } catch (err) {
        console.warn("createEntry: invalid facets", err)
        return { ok: false, status: 400 }
    }

    // Embed 作成: 画像（手動添付）と OGP リンクカードは Bluesky 上で同時に
    // 埋め込めないため、画像が指定されている場合はそちらを優先する。
    // 動画は先行アップロード済みの blob 参照を載せるだけなので、最優先で扱う
    // （スキーマ上、動画は画像・OGPとは排他）。
    let embed: any = undefined
    if (item.video) {
        embed = createVideoEmbed(item.video, item.videoMeta!)
    } else if (hasImages && images) {
        let uploadedImages: any[]
        try {
            uploadedImages = await Promise.all(
                images.map(image => uploadBlob(agent, image)),
            )
        } catch (err) {
            console.error("createEntry: image upload failed", err)
            return { ok: false, status: 500 }
        }
        embed = createImageEmbed(uploadedImages, imagesMeta)
    } else if (ogMeta && ogImage) {
        let uploadedOgImage: any
        try {
            uploadedOgImage = await uploadBlob(agent, ogImage)
        } catch (err) {
            console.error("createEntry: ogImage upload failed", err)
            return { ok: false, status: 500 }
        }
        try {
            embed = createExternalEmbed(ogMeta, uploadedOgImage)
        } catch (err) {
            console.error("createEntry: failed to create embed", err)
            return { ok: false, status: 400 }
        }
    }

    return {
        ok: true,
        value: {
            text: postText,
            facets: item.facets,
            langs: item.langs,
            embed,
            selfLabel: item.selfLabels,
            gate: item.gate,
        },
    }
}

/**
 * フェーズ 5c: createEntry:true の場合、visual を 1 回だけアップロードし、
 * entry 作成の入力を組み立てる（`source` は常に posts[0]。design.md §7.2）。
 *
 * Output:
 * - createEntry が true なら entry 作成の入力、false なら undefined
 *
 * 失敗時の方針:
 * - visual のアップロードの失敗は 500。
 */
export const uploadEntryVisual = async (
    agent: EntryMediaAgent,
    input: CreateEntryUploadInput,
): Promise<Outcome<ThreadEntryInput | undefined>> => {
    const wantsEntry = input.createEntry === true
    if (!(wantsEntry && input.visual)) {
        return { ok: true, value: undefined }
    }

    let uploadedVisual: any
    try {
        uploadedVisual = await uploadBlob(agent, input.visual)
    } catch (err) {
        console.error("createEntry: visual thumbnail upload failed", err)
        return { ok: false, status: 500 }
    }
    return {
        ok: true,
        value: {
            visual: uploadedVisual,
            heading: input.heading,
            caption: input.caption,
        },
    }
}
