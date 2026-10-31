/**
 * 投稿フォームの画像と OGP の取得結果の型。
 *
 * 責務と処理概要:
 * - 部品（`ImagePicker`・`OgpFetchButton`）が親へ通知する値の形と、判断（`segments.ts`・`shareDispatch.ts`）が使う形を、ここで一つに定める。
 * - 型だけを持つ。値も React も持たず、部品には依存しない（部品が `rules/` を参照する向きを保つ）。
 */

/** 投稿用に生成した画像一式（原寸のブロブ・サムネイル・プレビュー URL・代替テキスト）。 */
export type ImageEntry = {
    originalBlobs: Blob[]
    thumbnailBlob: Blob
    originalPreviews: string[]
    thumbnailPreview: string
    sourceFileNames: string[]
    meta?: { width?: number; height?: number; alt: string }[]
}

/** OGP から取得したリンクカードの見出しと説明。 */
export type OgpMeta = {
    title: string
    description: string
}

/** OGP の取得結果（リンクカードの内容と、サムネイルの画像）。 */
export type OgpResult = {
    meta: OgpMeta
    imageBlob: Blob
    sourceUrl: string
}
