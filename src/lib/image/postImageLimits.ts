/**
 * 投稿画像の枚数に関する定数の集約先。
 *
 * 責務と処理概要:
 * - フロント（投稿フォーム）・API・Zodスキーマが同じ値を参照できるよう、
 *   画像枚数の上限と閾値をここに一元化する（specs/image-picker）。
 */

/** 1投稿に添付できる画像の最大枚数（gallery のクライアント運用上限） */
export const MAX_POST_IMAGES = 10
/** `app.bsky.embed.images` で投稿できる最大枚数。これを超えると gallery を使う */
export const MAX_IMAGES_EMBED = 4
/** visual の合成素材とする先頭からの枚数 */
export const VISUAL_IMAGE_COUNT = 4
