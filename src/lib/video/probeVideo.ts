/**
 * 選択された動画ファイルの検査と、poster（最初のフレーム相当）の切り出し。
 */
import {
    MAX_VIDEO_BYTES,
    MAX_VIDEO_DURATION_SEC,
    VIDEO_MIME_TYPE,
} from "@/lib/video/postVideoLimits"
import type { VideoValidationError } from "@/lib/video/videoErrors"

export type VideoProbe = {
    width: number
    height: number
    durationSec: number
    /** JPEG（最大辺 1280px） */
    posterBlob: Blob
}

/** poster の最大辺（px） */
const POSTER_MAX_SIDE = 1280
/** 読み込み・シークの待機上限（ミリ秒） */
const PROBE_TIMEOUT_MS = 15_000
/** シーク後にフレームが描画可能になるまでの待機上限（ミリ秒）。超えても描画を試みる */
const FRAME_READY_TIMEOUT_MS = 1_000

export class VideoProbeError extends Error {
    constructor(readonly code: VideoValidationError) {
        super(code)
        this.name = "VideoProbeError"
    }
}

/**
 * 同期的に検査できるもの（形式・サイズ）を検査する。
 *
 * Output:
 * - 違反があればその理由、問題なければ `undefined`
 */
export const validateVideoFile = (
    file: Pick<File, "type" | "size">,
): VideoValidationError | undefined => {
    if (file.type !== VIDEO_MIME_TYPE) return "notMp4"
    if (file.size > MAX_VIDEO_BYTES) return "tooLarge"
    return undefined
}

const waitForEvent = (target: HTMLVideoElement, event: string): Promise<void> =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new VideoProbeError("unreadable")),
            PROBE_TIMEOUT_MS,
        )
        target.addEventListener(
            event,
            () => {
                clearTimeout(timer)
                resolve()
            },
            { once: true },
        )
        target.addEventListener(
            "error",
            () => {
                clearTimeout(timer)
                reject(new VideoProbeError("unreadable"))
            },
            { once: true },
        )
    })

/**
 * シーク先のフレームがデコード・描画可能になるまで待つ。
 *
 * 処理の趣旨:
 * - Safari では `seeked` の発火時点でフレームが未デコードのことがあり、そのまま
 *   `drawImage` すると黒一色になる。`requestVideoFrameCallback`（Safari 15.4+）で
 *   フレームの提示を待つ。
 * - 未対応の環境では `readyState` が現在位置のデータを持つまで待つ。
 * - いずれも待機上限で打ち切る（超えても reject せず、描画へ進む）。
 *
 * Input:
 * - `framePresented`: シーク前に登録した `requestVideoFrameCallback` の Promise
 *   （シーク中に発火済みでも取りこぼさないため）
 */
const waitForFrameReady = async (
    video: HTMLVideoElement,
    framePresented: Promise<void> | undefined,
): Promise<void> => {
    const timeout = new Promise<void>(resolve =>
        setTimeout(resolve, FRAME_READY_TIMEOUT_MS),
    )
    if (framePresented) {
        await Promise.race([framePresented, timeout])
        return
    }
    // HAVE_CURRENT_DATA(2) 未満なら現在位置のフレームがまだ無い
    if (video.readyState < 2) {
        await Promise.race([waitForEvent(video, "loadeddata"), timeout]).catch(
            () => undefined,
        )
    }
}

/**
 * `<video preload="auto">` で寸法と長さを読み、最初のフレーム相当のフレームを
 * canvas に描いて poster を作る。
 *
 * 処理の趣旨:
 * - 0 秒ちょうどは未デコードのことがあるため、`currentTime = Math.min(0.1, duration / 2)`
 *   へシークして `seeked` とフレームの描画可能（`waitForFrameReady`）を待つ。
 * - 長さが上限を超えれば `tooLong`、読み込み不能・寸法 0・長さが有限でない場合は
 *   `unreadable` で reject する（`VideoProbeError`）。
 * - object URL は終了時に必ず revoke する。
 */
export const probeVideo = async (file: File): Promise<VideoProbe> => {
    const url = URL.createObjectURL(file)
    try {
        const video = document.createElement("video")
        // Safari は "metadata" だとシーク後のフレームをデコードせず、黒いフレームを描画してしまう
        video.preload = "auto"
        video.muted = true
        video.playsInline = true
        const loaded = waitForEvent(video, "loadedmetadata")
        video.src = url
        await loaded

        const { videoWidth: width, videoHeight: height, duration } = video
        if (!Number.isFinite(duration) || width <= 0 || height <= 0) {
            throw new VideoProbeError("unreadable")
        }
        if (duration > MAX_VIDEO_DURATION_SEC) {
            throw new VideoProbeError("tooLong")
        }

        const framePresented =
            typeof video.requestVideoFrameCallback === "function"
                ? new Promise<void>(resolve =>
                      video.requestVideoFrameCallback(() => resolve()),
                  )
                : undefined
        const seeked = waitForEvent(video, "seeked")
        video.currentTime = Math.min(0.1, duration / 2)
        await seeked
        await waitForFrameReady(video, framePresented)

        const ratio = Math.min(1, POSTER_MAX_SIDE / Math.max(width, height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(width * ratio))
        canvas.height = Math.max(1, Math.round(height * ratio))
        const context = canvas.getContext("2d")
        if (!context) throw new VideoProbeError("unreadable")
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        const posterBlob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
                blob =>
                    blob
                        ? resolve(blob)
                        : reject(new VideoProbeError("unreadable")),
                "image/jpeg",
                0.9,
            ),
        )
        return { width, height, durationSec: duration, posterBlob }
    } finally {
        URL.revokeObjectURL(url)
    }
}
