/**
 * 既存の Bluesky 投稿から Skyshare Entry 用の visual を合成する。
 *
 * - 画像は同一オリジンの `GET /v2/bsky/images` 経由で取得し、CDN の CORS 制約を避ける。
 * - 動画の poster は `image/jpeg` の Blob にして `<img>` で読めるようにする。
 */
import { getBskyImage } from "@/client/openapi/client"
import type { SourceVideo } from "@/lib/entry/entry"
import type { SourceImage } from "@/lib/image/sourceImage"

/**
 * 投稿の画像・動画の素材（このモジュールが使う項目だけ）。
 * timeline の投稿（`TimelinePost`）はこの形に代入できるため、timeline を import しない。
 */
export type PostVisualSource = {
    images: SourceImage[]
    video?: SourceVideo
}
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
    source: PostVisualSource,
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
