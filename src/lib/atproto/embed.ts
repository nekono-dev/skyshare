/**
 * Bluesky 投稿の embed（画像 / 外部リンク）組み立てユーティリティ群。
 *
 * 責務と処理概要:
 * - 画像投稿・OGPリンク投稿それぞれの embed 構造（`app.bsky.embed.*`）を組み立てる。
 * - 画像投稿については、アップロード前のメタデータ整合性検証も担う。
 * - アップロード済み blob 参照や facets 抽出結果を入力として受け取るのみで、
 *   atproto クライアントへの通信自体は行わない（純粋関数）。
 */

import type * as Components from "@/lib/api/schema/common"
import { MAX_IMAGES_EMBED, MAX_POST_IMAGES } from "@/lib/image/postImageLimits"

/**
 * 画像投稿時のメタデータ整合性を検証する。
 *
 * 処理の趣旨:
 * - bsky 投稿作成前に、画像投稿として成立する最小条件を確認する。
 * - images が未指定または空配列の場合は画像投稿ではないため、検証をスキップする。
 * - images が存在する場合は imagesMeta が必須であり、件数一致を確認する。
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
    imagesMeta: Components.CommonImagesMetaType | undefined,
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
 * 処理の趣旨:
 * - 1〜4枚は従来どおり `app.bsky.embed.images`（互換性維持）、
 *   5枚以上は `app.bsky.embed.gallery` を使う。
 * - alt・縦横比・順序はどちらの型でも保持する。
 * - aspectRatio は メタデータが存在する場合のみセット。gallery は aspectRatio 必須だが、
 *   imagesMeta は width/height が必須（min 1）のため常に存在する。
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
    metadata: Components.CommonImagesMetaType | undefined,
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
 * 処理の趣旨:
 * - OGP メタデータ（title, description, url）から、
 * - atproto の external embed 形式に変換する。
 * - Bluesky はリンクカードを embed として添付するため、本文（facets）に
 *   URL が含まれているかどうかとは無関係に組み立てられる。
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
export const createExternalEmbed = (
    ogMeta: Components.CommonOgMetaType,
    thumbBlob: any,
) => {
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
