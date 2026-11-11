/**
 * 投稿画像の URL・代替テキスト・CID・縦横比を表す型。
 * - image が entry に依存しないよう、この型を image 側で定義する。
 */

export type SourceImage = {
    url: string
    alt: string
    cid: string
    /** 画像レコードの `aspectRatio`。未設定・不正値の場合は `undefined` */
    aspectRatio?: { width: number; height: number }
}
