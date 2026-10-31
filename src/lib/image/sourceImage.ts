/**
 * 投稿の画像の素材の型（image 側が持つ）。
 *
 * 責務と処理概要:
 * - 投稿レコードの画像（URL・代替テキスト・CID・縦横比）の形を定める。
 * - Entry（`entry/entry.ts`）と、画像の配置（`image/galleryLayout.ts`）の両方が使う。
 *   image は entry を import しないため、型は image 側に置く。
 *
 * 実装上の制約:
 * - 型だけを持つ。import を持たない。
 */

export type SourceImage = {
    url: string
    alt: string
    cid: string
    /** 画像レコードの `aspectRatio`。未設定・不正値の場合は `undefined` */
    aspectRatio?: { width: number; height: number }
}
