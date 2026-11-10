/**
 * Bluesky 投稿の embed（画像・動画・外部リンク）を組み立てる。
 *
 * - 純粋関数: アップロード済みの blob 参照を受け取るだけで、atproto への通信はしない。
 */

import type {
    BskyImagesMeta,
    BskyOgMeta,
    BskyVideoBlob,
    BskyVideoMeta,
} from "@/lib/atproto/recordTypes"
import { MAX_IMAGES_EMBED, MAX_POST_IMAGES } from "@/lib/image/postImageLimits"

/**
 * 画像投稿時のメタデータ整合性を検証する。
 *
 * - `images` が未指定または空配列なら画像投稿ではないため、検証しない。
 * - `images` があるときは `imagesMeta` が必須で、件数が一致しなければならない。
 * - 枚数が `MAX_POST_IMAGES` を超える場合は拒否する（スキーマを通らない内部呼び出しへの防御）。
 *
 * Input:
 * - `images`: Blob 配列（undefined 可）
 * - `imagesMeta`: { width: number, height: number }[] 配列（undefined 可）
 *
 * Output:
 * - void（エラー時は Error を throw）
 *
 * 失敗時の方針:
 * - images があるのに imagesMeta がない場合は Error を throw。
 * - 上限超過・カウント不一致は Error を throw し、呼び出し元で catch して 400 を返す。
 *
 * 例:
 * - 入力：images=[BlobA, BlobB], imagesMeta=[{w:100,h:100}] → throw「カウント不一致」
 * - 入力：images=[BlobA, BlobB], imagesMeta=[{w:100,h:100}, {w:200,h:200}] → void
 */
export const validateImageMetadata = (
    images: Blob[] | undefined,
    imagesMeta: BskyImagesMeta | undefined,
) => {
    if (!images || images.length === 0) {
        return
    }

    if (images.length > MAX_POST_IMAGES) {
        throw new Error(`images must be at most ${MAX_POST_IMAGES}`)
    }

    if (!imagesMeta) {
        throw new Error("imagesMeta is required when images are provided")
    }

    const widths = imagesMeta?.map(v => v.width) ?? []
    const heights = imagesMeta?.map(v => v.height) ?? []

    if (widths.length !== images.length || heights.length !== images.length) {
        throw new Error("image size metadata count mismatch")
    }
}

/**
 * 画像投稿の embed オブジェクトを、枚数に応じた型で組み立てる。
 *
 * - 1〜4 枚は `app.bsky.embed.images`（この型の lexicon 上限が 4 枚のため）、5 枚以上は `app.bsky.embed.gallery` を使う。
 * - alt・縦横比・順序はどちらの型でも保持する。
 * - `aspectRatio` は metadata に width・height がある場合だけ付ける。gallery では `aspectRatio` が必須だが、`imagesMeta` の width・height は必須（最小 1）のため常に付く。
 *
 * Input:
 * - `uploadedBlobs`: atproto サーバーで生成された blob 参照配列
 * - `metadata`: { width: number, height: number, alt?: string }[] メタデータ配列
 *
 * Output:
 * - 4枚以下: { $type: "app.bsky.embed.images", images: [...] }
 * - 5枚以上: { $type: "app.bsky.embed.gallery", items: [{ $type: "app.bsky.embed.gallery#image", ... }] }
 *
 * 例:
 * - 入力：uploadedBlobs=[blobRef1, blobRef2], metadata=[{w:100,h:100,alt:""}, {w:200,h:200,alt:"猫の写真"}]
 * - 出力：{ $type: "app.bsky.embed.images", images: [{image: blobRef1, alt: "", aspectRatio: {width: 100, height: 100}}, {image: blobRef2, alt: "猫の写真", ...}] }
 */
export const createImageEmbed = (
    uploadedBlobs: any[],
    metadata: BskyImagesMeta | undefined,
) => {
    const entries = uploadedBlobs.map((blob, idx) => {
        const width = metadata?.[idx]?.width
        const height = metadata?.[idx]?.height
        return {
            image: blob,
            alt: metadata?.[idx]?.alt ?? "",
            aspectRatio: width && height ? { width, height } : undefined,
        }
    })

    if (entries.length <= MAX_IMAGES_EMBED) {
        return { $type: "app.bsky.embed.images" as const, images: entries }
    }

    return {
        $type: "app.bsky.embed.gallery" as const,
        items: entries.map(entry => ({
            $type: "app.bsky.embed.gallery#image" as const,
            ...entry,
        })),
    }
}

/**
 * OGP 投稿の app.bsky.embed.external embed オブジェクトを組み立てる。
 *
 * - Bluesky はリンクカードを embed として付けるため、本文（facets）に URL が含まれるかどうかとは無関係に組み立てる。
 *
 * Input:
 * - `ogMeta`: { title: string, description: string, url: string, ... }
 * - `thumbBlob`: サムネイル blob（アップロード済み、未指定可）
 *
 * Output:
 * - { $type: "app.bsky.embed.external", external: { uri, title, description, thumb? } }
 *
 * 失敗時の方針:
 * - `ogMeta.url` が空の場合は Error を throw。
 *
 * 例:
 * - 入力：ogMeta={title:"Example",description:"...",url:"https://..."},thumbBlob=blobRef
 * - 出力：{ $type:"app.bsky.embed.external",external:{uri:"https://...",title:"Example",description:"..."，thumb:blobRef} }
 */
export const createExternalEmbed = (ogMeta: BskyOgMeta, thumbBlob: any) => {
    if (!ogMeta.url) {
        throw new Error("ogp post requires a link in the text")
    }

    return {
        $type: "app.bsky.embed.external" as const,
        external: {
            uri: ogMeta.url,
            title: ogMeta.title,
            description: ogMeta.description,
            thumb: thumbBlob,
        },
    }
}

/**
 * 動画投稿の app.bsky.embed.video embed オブジェクトを組み立てる。
 *
 * - 動画の実体はブラウザから動画サービスへアップロード済みのため、blob 参照を載せるだけにする。
 * - 縦横比と alt（未指定は空文字）を保持する。
 *
 * 例:
 * - 入力：video=blobRef, meta={width:640,height:360,alt:""}
 * - 出力：{ $type:"app.bsky.embed.video", video:blobRef, alt:"", aspectRatio:{width:640,height:360} }
 */
export const createVideoEmbed = (
    video: BskyVideoBlob,
    meta: BskyVideoMeta,
) => ({
    $type: "app.bsky.embed.video" as const,
    video,
    alt: meta.alt ?? "",
    aspectRatio: { width: meta.width, height: meta.height },
})
