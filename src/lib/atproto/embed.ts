/**
 * Bluesky 投稿の embed（画像 / 外部リンク）組み立てユーティリティ群。
 *
 * 責務と処理概要:
 * - 画像投稿・OGPリンク投稿それぞれの embed 構造（`app.bsky.embed.*`）を組み立てる。
 * - 画像投稿については、アップロード前のメタデータ整合性検証も担う。
 * - アップロード済み blob 参照や facets 抽出結果を入力として受け取るのみで、
 *   atproto クライアントへの通信自体は行わない（純粋関数）。
 */

import type * as Components from "@/client/openapi/schemas/components"

/**
 * 画像投稿時のメタデータ整合性を検証する。
 *
 * 処理の趣旨:
 * - bsky 投稿作成前に、画像投稿として成立する最小条件を確認する。
 * - images が未指定または空配列の場合は画像投稿ではないため、検証をスキップする。
 * - images が存在する場合は imagesMeta が必須であり、件数一致を確認する。
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
 * - カウント不一致は Error を throw し、呼び出し元で catch して 400 を返す。
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
 * 画像投稿の app.bsky.embed.images embed オブジェクトを組み立てる。
 *
 * 処理の趣旨:
 * - アップロード済み blob と メタデータ（幅・高さ）から、
 *   atproto の投稿埋め込み形式に適合した embed 構造を生成。
 * - aspetRatio は メタデータが存在する場合のみセット。
 *
 * Input:
 * - `uploadedBlobs`: atproto サーバーで生成された blob 参照配列
 * - `metadata`: { width: number, height: number }[] メタデータ配列
 *
 * Output:
 * - { $type: "app.bsky.embed.images", images: [...] }
 *
 * 例:
 * - 入力：uploadedBlobs=[blobRef1, blobRef2], metadata=[{w:100,h:100}, {w:200,h:200}]
 * - 出力：{ $type: "app.bsky.embed.images", images: [{image: blobRef1, alt: "", aspectRatio: {width: 100, height: 100}}, ...] }
 */
export const createImageEmbed = (
    uploadedBlobs: any[],
    metadata: Components.CommonImagesMetaType | undefined,
) => {
    const widths = metadata?.map(v => v.width) ?? []
    const heights = metadata?.map(v => v.height) ?? []

    return {
        $type: "app.bsky.embed.images" as const,
        images: uploadedBlobs.map((blob, idx) => ({
            image: blob,
            alt: "",
            aspectRatio:
                widths[idx] && heights[idx]
                    ? {
                          width: widths[idx],
                          height: heights[idx],
                      }
                    : undefined,
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
