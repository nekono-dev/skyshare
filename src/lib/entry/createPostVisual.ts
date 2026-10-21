/**
 * 既存の Bluesky 投稿（Timeline の事後 entry 作成）から、entry の visual を作る。
 *
 * 責務と処理概要:
 * - 動画投稿: poster（`thumbnail.jpg`）と再生時間（HLS プレイリストの EXTINF 合計）を
 *   並行して取得し、poster に再生ボタンを重ねた 1200x630 の画像にする。再生時間は
 *   画像へ埋め込まず、呼び出し側が entry の heading に記載できるよう併せて返す。
 *   どちらかの取得に失敗したら例外を投げる（呼び出し側が entry 作成を失敗させる）。
 * - 画像投稿: 先頭 `VISUAL_IMAGE_COUNT` 枚を `GET /v2/bsky/images`（同一オリジン。
 *   cdn.bsky.app の CORS 制約を回避するプロキシ）経由で取得し、投稿フォームでクロップ編集
 *   しなかった場合と同じデフォルト配置で合成する。
 */
import { getBskyImage } from "@/client/openapi/client"
import type { TimelinePost } from "@/lib/entry/posts"
import { VISUAL_IMAGE_COUNT } from "@/lib/image/postImageLimits"
import { createDefaultThumbnail } from "@/lib/image/postImageProcessing"
import { fetchVideoDurationSec } from "@/lib/video/fetchVideoDuration"
import { drawVideoOverlay } from "@/lib/video/videoOverlay"

export type PostVisual = {
    blob: Blob
    /** 動画投稿の場合のみ、動画の再生時間（秒） */
    videoDurationSec?: number
}

/**
 * 動画の poster（`thumbnail.jpg`、CORS `*`）を取得する。
 * 配信側の `content-type` が `application/octet-stream` のため、`<img>` で読めるよう
 * `image/jpeg` の Blob に作り直す。
 */
const fetchVideoPoster = async (thumbnailUrl: string): Promise<Blob> => {
    const res = await fetch(thumbnailUrl)
    if (!res.ok) throw new Error("Failed to fetch the video poster.")
    const blob = await res.blob()
    return blob.type.startsWith("image/")
        ? blob
        : new Blob([blob], { type: "image/jpeg" })
}

/**
 * entry の visual（合成サムネイル）を作る。
 *
 * Input:
 * - `source`: visual の素材にする投稿（動画投稿、または画像投稿）
 *
 * Output:
 * - 1200x630 の合成サムネイル Blob と、動画投稿の場合の再生時間（秒）
 *
 * 失敗時の方針:
 * - 素材の取得・再生時間の取得・合成のいずれかに失敗したら Error を throw する。
 */
export const createPostVisualBlob = async (
    source: TimelinePost,
): Promise<PostVisual> => {
    const objectUrls: string[] = []
    try {
        const video = source.video
        let videoDurationSec: number | undefined
        let overlay: ReturnType<typeof drawVideoOverlay> | undefined
        if (video) {
            const [durationSec, poster] = await Promise.all([
                fetchVideoDurationSec(video.playlistUrl),
                fetchVideoPoster(video.thumbnailUrl),
            ])
            videoDurationSec = durationSec
            overlay = drawVideoOverlay()
            objectUrls.push(URL.createObjectURL(poster))
        } else {
            objectUrls.push(
                ...(await Promise.all(
                    source.images
                        .slice(0, VISUAL_IMAGE_COUNT)
                        .map(async image => {
                            const res = await getBskyImage({ cid: image.cid })
                            if (
                                res.status !== 200 ||
                                !(res.data instanceof Blob)
                            ) {
                                throw new Error(
                                    "Failed to fetch the source image.",
                                )
                            }
                            return URL.createObjectURL(res.data)
                        }),
                )),
            )
        }
        const blob = await createDefaultThumbnail(objectUrls, overlay)
        return { blob, videoDurationSec }
    } finally {
        objectUrls.forEach(url => URL.revokeObjectURL(url))
    }
}
