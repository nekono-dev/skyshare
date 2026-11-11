/**
 * 投稿画像の枚数上限を、フォーム・API・スキーマで共有する。
 * - 投稿画像は最大 10 枚、Bluesky の画像 embed は最大 4 枚。
 */

/** 1投稿に添付できる画像の最大枚数（gallery のクライアント運用上限） */
export const MAX_POST_IMAGES = 10
/** `app.bsky.embed.images` で投稿できる最大枚数。これを超えると gallery を使う */
export const MAX_IMAGES_EMBED = 4
/** visual の合成素材とする先頭からの枚数 */
export const VISUAL_IMAGE_COUNT = 4
