/**
 * 動画の blob 参照のスキーマ（api と動画の送信処理が共有する）。
 *
 * 責務と処理概要:
 * - 動画サービス（getJobStatus）が JSON 形式で返す blob 参照を検証する。
 * - `.meta`（OpenAPI の説明）は持たない。説明は api の側で付ける。
 */
import { z } from "zod/v4"
import { MAX_VIDEO_BYTES, VIDEO_BLOB_MIME_TYPE } from "./postVideoLimits"

/**
 * 動画blob参照。動画サービス(getJobStatus)がJSON形式で返すblob参照で、
 * `app.bsky.embed.video#video`にそのまま使える。動画の実体はブラウザから動画サービスへ
 * 直接アップロード済みのため、サーバへ送られるのはこの参照だけ。
 */
export const CommonVideoBlobSchema = z
    .object({
        $type: z.literal("blob"),
        ref: z.object({ $link: z.string().min(1) }).strict(),
        mimeType: z.literal(VIDEO_BLOB_MIME_TYPE),
        size: z.number().int().min(1).max(MAX_VIDEO_BYTES),
    })
    .strict()
export type CommonVideoBlobType = z.infer<typeof CommonVideoBlobSchema>
