/**
 * 動画のアップロード本体。ブラウザから Bluesky の動画サービスへ直接、分割アップロード
 * （`startUpload` → `uploadPart` → `finishUpload`）し、変換完了（`getJobStatus`）を待って
 * blob 参照を返す。動画の実体は Skyshare のサーバーを経由しない（NFR-1）。
 */
import { CommonVideoBlobSchema } from "@/lib/api/schema/common"
import {
    VIDEO_JOB_POLL_INTERVAL_MS,
    VIDEO_JOB_TIMEOUT_MS,
    VIDEO_PART_MAX_RETRIES,
    VIDEO_SERVICE_XRPC_URL,
    VIDEO_TOKEN_REFRESH_MARGIN_SEC,
} from "@/lib/video/postVideoLimits"
import { resolveVideoMimeType, type VideoProbe } from "@/lib/video/probeVideo"
import type { VideoUploadToken } from "@/lib/video/videoUploadToken"
import {
    mapServiceErrorName,
    VideoUploadError,
    type VideoUploadErrorCode,
} from "@/lib/video/videoErrors"

export { VideoUploadError }
export type { VideoUploadErrorCode, VideoUploadToken }

export type VideoUploadProgress =
    /** 送信済みバイト / 総バイト */
    | { phase: "uploading"; percent: number }
    /** `getJobStatus.progress` */
    | { phase: "processing"; percent: number }

export type VideoBlobRef = ReturnType<typeof CommonVideoBlobSchema.parse>

export type UploadVideoParams = {
    file: File
    probe: Pick<VideoProbe, "width" | "height" | "durationSec">
    /** `POST /v2/bsky/video/upload-token` */
    fetchToken: () => Promise<VideoUploadToken>
    onProgress: (progress: VideoUploadProgress) => void
    signal: AbortSignal
}

const abortError = () =>
    new DOMException("The upload was aborted.", "AbortError")

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
        if (signal.aborted) return reject(abortError())
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", onAbort)
            resolve()
        }, ms)
        const onAbort = () => {
            clearTimeout(timer)
            reject(abortError())
        }
        signal.addEventListener("abort", onAbort, { once: true })
    })

/** 動画サービスのエラー応答（`{ error: string }`）からエラー名を取り出す。 */
const readErrorName = async (res: Response): Promise<unknown> => {
    try {
        return ((await res.json()) as { error?: unknown }).error
    } catch {
        return undefined
    }
}

const isAbort = (err: unknown): boolean =>
    err instanceof DOMException && err.name === "AbortError"

/**
 * トークンのキャッシュ関数を作る。残り時間が `VIDEO_TOKEN_REFRESH_MARGIN_SEC` を
 * 下回ったら `fetchToken` で再取得する。各リクエストでトークンが検証されるため、
 * 低速回線で30分を超えても途切れないようにする。
 */
const createTokenProvider = (
    fetchToken: () => Promise<VideoUploadToken>,
): (() => Promise<string>) => {
    let cached: VideoUploadToken | undefined
    return async () => {
        const nowSec = Date.now() / 1000
        if (
            !cached ||
            cached.expiresAt - nowSec < VIDEO_TOKEN_REFRESH_MARGIN_SEC
        ) {
            cached = await fetchToken()
        }
        return cached.token
    }
}

/**
 * 動画をアップロードし、変換完了後の blob 参照を返す。
 *
 * 処理フロー:
 * 1. `startUpload` でジョブとパート構成（`jobId`・`partSizeBytes`・`partCount`）を得る。
 * 2. パートを逐次 `uploadPart`。ネットワークエラー・5xx・429 のみ、最大
 *    `VIDEO_PART_MAX_RETRIES` 回（待機 1s,2s,4s）再試行する。
 * 3. `finishUpload`（冪等。ネットワークエラーは1回だけ再試行）。
 * 4. `getJobStatus` を `VIDEO_JOB_POLL_INTERVAL_MS` 間隔でポーリングし、
 *    `COMPLETED` で blob 参照を返す。`FAILED` は `processingFailed`、
 *    `VIDEO_JOB_TIMEOUT_MS` 超過は `timeout`。
 * 5. `signal` の中断時、`finishUpload` 前なら `abortUpload` を best-effort で呼び、
 *    `AbortError` を投げる。
 *
 * 失敗時は `VideoUploadError`（`code` で分類）を投げる。トークンはログに出力しない。
 */
export const uploadVideo = async (
    params: UploadVideoParams,
): Promise<VideoBlobRef> => {
    const { file, probe, fetchToken, onProgress, signal } = params
    const getToken = createTokenProvider(fetchToken)
    let jobId: string | undefined
    let finished = false

    const request = async (
        method: "POST" | "GET",
        name: string,
        options: {
            query?: Record<string, string | number>
            contentType?: string
            body?: BodyInit
            auth?: boolean
        } = {},
    ): Promise<Response> => {
        const url = new URL(`${VIDEO_SERVICE_XRPC_URL}app.bsky.video.${name}`)
        for (const [key, value] of Object.entries(options.query ?? {})) {
            url.searchParams.set(key, String(value))
        }
        const headers: Record<string, string> = {}
        if (options.auth !== false) {
            headers.Authorization = `Bearer ${await getToken()}`
        }
        if (options.contentType) headers["Content-Type"] = options.contentType
        try {
            return await fetch(url, {
                method,
                headers,
                body: options.body,
                signal,
            })
        } catch (err) {
            if (isAbort(err) || signal.aborted) throw abortError()
            throw new VideoUploadError("network")
        }
    }

    const failFromResponse = async (res: Response): Promise<never> => {
        const code = mapServiceErrorName(await readErrorName(res))
        throw new VideoUploadError(code)
    }

    try {
        // 1. startUpload
        const startRes = await request("POST", "startUpload", {
            contentType: "application/json",
            body: JSON.stringify({
                sizeBytes: file.size,
                // validateVideoFile を通過済みのため必ず解決できる
                mimeType: resolveVideoMimeType(file) ?? "",
                name: file.name,
                durationMs: Math.round(probe.durationSec * 1000),
                width: probe.width,
                height: probe.height,
            }),
        })
        if (!startRes.ok) await failFromResponse(startRes)
        const start = (await startRes.json()) as {
            jobId: string
            partSizeBytes: number
            partCount: number
        }
        jobId = start.jobId

        // 2. uploadPart（逐次）
        let sentBytes = 0
        for (let part = 1; part <= start.partCount; part++) {
            const chunk = file.slice(
                (part - 1) * start.partSizeBytes,
                part * start.partSizeBytes,
            )
            await uploadPartWithRetry(request, jobId, part, chunk, signal)
            sentBytes += chunk.size
            onProgress({
                phase: "uploading",
                percent: Math.min(100, (sentBytes / file.size) * 100),
            })
        }

        // 3. finishUpload（冪等のため、通信エラーは1回だけ再試行する）
        let finishRes: Response
        try {
            finishRes = await finishUpload(request, jobId)
        } catch (err) {
            if (!(err instanceof VideoUploadError) || err.code !== "network")
                throw err
            finishRes = await finishUpload(request, jobId)
        }
        if (!finishRes.ok) await failFromResponse(finishRes)
        finished = true
        const fin = (await finishRes.json()) as { completedJobId?: string }

        // 4. 変換待ち
        return await pollJob(
            request,
            fin.completedJobId ?? jobId,
            onProgress,
            signal,
        )
    } catch (err) {
        if (isAbort(err) && jobId && !finished) {
            // best-effort（失敗は無視。signal は中断済みのため付けない）
            void fetch(`${VIDEO_SERVICE_XRPC_URL}app.bsky.video.abortUpload`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${await getToken().catch(() => "")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ jobId }),
            }).catch(() => undefined)
        }
        throw err
    }
}

type Request = (
    method: "POST" | "GET",
    name: string,
    options?: {
        query?: Record<string, string | number>
        contentType?: string
        body?: BodyInit
        auth?: boolean
    },
) => Promise<Response>

const finishUpload = (request: Request, jobId: string) =>
    request("POST", "finishUpload", {
        contentType: "application/json",
        body: JSON.stringify({ jobId }),
    })

const uploadPartWithRetry = async (
    request: Request,
    jobId: string,
    partNumber: number,
    chunk: Blob,
    signal: AbortSignal,
): Promise<void> => {
    for (let attempt = 0; ; attempt++) {
        let retryable = false
        try {
            const res = await request("POST", "uploadPart", {
                query: { jobId, partNumber },
                contentType: "application/octet-stream",
                body: chunk,
            })
            if (res.ok) return
            if (res.status >= 500 || res.status === 429) {
                retryable = true
            } else {
                throw new VideoUploadError(
                    mapServiceErrorName(await readErrorName(res)),
                )
            }
        } catch (err) {
            if (!(err instanceof VideoUploadError) || err.code !== "network")
                throw err
            retryable = true
        }
        if (retryable && attempt >= VIDEO_PART_MAX_RETRIES) {
            throw new VideoUploadError("network")
        }
        await sleep(1000 * 2 ** attempt, signal)
    }
}

const pollJob = async (
    request: Request,
    jobId: string,
    onProgress: (progress: VideoUploadProgress) => void,
    signal: AbortSignal,
): Promise<VideoBlobRef> => {
    const startedAt = Date.now()
    for (;;) {
        const res = await request("GET", "getJobStatus", {
            query: { jobId },
            auth: false,
        })
        if (res.ok) {
            const { jobStatus } = (await res.json()) as {
                jobStatus: { state: string; progress?: number; blob?: unknown }
            }
            if (jobStatus.state === "JOB_STATE_COMPLETED") {
                const blob = CommonVideoBlobSchema.safeParse(jobStatus.blob)
                if (!blob.success) throw new VideoUploadError("unknown")
                return blob.data
            }
            if (jobStatus.state === "JOB_STATE_FAILED") {
                throw new VideoUploadError("processingFailed")
            }
            onProgress({
                phase: "processing",
                percent: jobStatus.progress ?? 0,
            })
        }
        if (Date.now() - startedAt >= VIDEO_JOB_TIMEOUT_MS) {
            throw new VideoUploadError("timeout")
        }
        await sleep(VIDEO_JOB_POLL_INTERVAL_MS, signal)
    }
}
