import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
    uploadVideo,
    VideoUploadError,
    type VideoUploadProgress,
} from "@/lib/video/videoUploader"

const PART = 5_242_880
const BLOB = {
    $type: "blob",
    ref: { $link: "bafkreivideo" },
    mimeType: "video/mp4",
    size: 100,
}

type Call = { name: string; url: URL; init: RequestInit }

/** `app.bsky.video.<name>` ごとの応答をキューで差し替えられる偽 fetch。 */
const setupFetch = (
    handlers: Partial<
        Record<string, (call: Call) => Response | Promise<Response>>
    >,
) => {
    const calls: Call[] = []
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: URL | string, init: RequestInit = {}) => {
            const url = new URL(String(input))
            const name = url.pathname.split("app.bsky.video.")[1]
            const call = { name, url, init }
            calls.push(call)
            const handler = handlers[name]
            if (!handler) throw new Error(`unexpected ${name}`)
            return handler(call)
        }),
    )
    return calls
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status })

const makeFile = (bytes: number) =>
    new File([new Uint8Array(bytes)], "a.mp4", { type: "video/mp4" })

const baseParams = (file: File, overrides = {}) => ({
    file,
    probe: { width: 640, height: 360, durationSec: 5 },
    fetchToken: vi.fn(async () => ({
        token: "secret-token",
        did: "did:plc:me",
        expiresAt: Math.floor(Date.now() / 1000) + 1800,
    })),
    onProgress: vi.fn(),
    signal: new AbortController().signal,
    ...overrides,
})

const happy = (partCount: number) => ({
    startUpload: () => json({ jobId: "job1", partSizeBytes: PART, partCount }),
    uploadPart: () => json({}),
    finishUpload: () => json({ completedJobId: "job2" }),
    getJobStatus: () =>
        json({ jobStatus: { state: "JOB_STATE_COMPLETED", blob: BLOB } }),
    abortUpload: () => json({}),
})

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe("uploadVideo", () => {
    it("[video-upload/AC-3] 正常系: 3 パートを順番に送り、blob 参照を返し、進捗を通知する", async () => {
        const calls = setupFetch({
            ...happy(3),
            getJobStatus: (() => {
                let n = 0
                return () =>
                    n++ === 0
                        ? json({
                              jobStatus: {
                                  state: "JOB_STATE_ENCODING",
                                  progress: 40,
                              },
                          })
                        : json({
                              jobStatus: {
                                  state: "JOB_STATE_COMPLETED",
                                  blob: BLOB,
                              },
                          })
            })(),
        })
        const params = baseParams(makeFile(PART * 2 + 100))
        const promise = uploadVideo(params)
        await vi.runAllTimersAsync()
        expect(await promise).toEqual(BLOB)

        const parts = calls.filter(c => c.name === "uploadPart")
        expect(parts.map(c => c.url.searchParams.get("partNumber"))).toEqual([
            "1",
            "2",
            "3",
        ])
        expect(parts.map(c => (c.init.body as Blob).size)).toEqual([
            PART,
            PART,
            100,
        ])
        expect(calls.map(c => c.name)).toContain("finishUpload")
        // finishUpload の completedJobId で getJobStatus を呼ぶ
        expect(
            calls
                .find(c => c.name === "getJobStatus")!
                .url.searchParams.get("jobId"),
        ).toBe("job2")

        const progress = params.onProgress.mock.calls.map(
            c => c[0] as VideoUploadProgress,
        )
        expect(
            progress
                .filter(p => p.phase === "uploading")
                .map(p => Math.round(p.percent)),
        ).toEqual([50, 100, 100])
        expect(progress).toContainEqual({ phase: "processing", percent: 40 })
        // getJobStatus は認証なし、他は Bearer
        expect(
            (calls.find(c => c.name === "getJobStatus")!.init.headers as any)
                .Authorization,
        ).toBeUndefined()
        expect((calls[0].init.headers as any).Authorization).toBe(
            "Bearer secret-token",
        )
    })

    it("startUpload のボディにサイズ・MIME・長さ・寸法を含める", async () => {
        const calls = setupFetch(happy(1))
        const promise = uploadVideo(baseParams(makeFile(100)))
        await vi.runAllTimersAsync()
        await promise
        expect(JSON.parse(calls[0].init.body as string)).toEqual({
            sizeBytes: 100,
            mimeType: "video/mp4",
            name: "a.mp4",
            durationMs: 5000,
            width: 640,
            height: 360,
        })
    })

    it.each([
        ["a.mov", "video/quicktime", "video/quicktime"],
        ["a.webm", "video/webm", "video/webm"],
        ["a.MOV", "", "video/quicktime"],
    ])(
        "[video-upload/AC-7] %s（type=%j）の startUpload の mimeType は実形式 %s になる",
        async (name, type, expected) => {
            const calls = setupFetch(happy(1))
            const file = new File([new Uint8Array(100)], name, { type })
            const promise = uploadVideo(baseParams(file))
            await vi.runAllTimersAsync()
            await promise
            expect(JSON.parse(calls[0].init.body as string).mimeType).toBe(
                expected,
            )
        },
    )

    it("[video-upload/AC-4] パートが 503 なら再試行して成功する", async () => {
        let n = 0
        const calls = setupFetch({
            ...happy(1),
            uploadPart: () => (n++ === 0 ? json({}, 503) : json({})),
        })
        const promise = uploadVideo(baseParams(makeFile(100)))
        await vi.runAllTimersAsync()
        await promise
        expect(calls.filter(c => c.name === "uploadPart")).toHaveLength(2)
    })

    it("[video-upload/AC-4] 4 回連続失敗で network エラー", async () => {
        const calls = setupFetch({
            ...happy(1),
            uploadPart: () => json({}, 503),
        })
        const promise = uploadVideo(baseParams(makeFile(100)))
        const assertion = expect(promise).rejects.toMatchObject({
            code: "network",
        })
        await vi.runAllTimersAsync()
        await assertion
        expect(calls.filter(c => c.name === "uploadPart")).toHaveLength(4)
    })

    it("[video-upload/AC-4] 400 は再試行しない", async () => {
        const calls = setupFetch({
            ...happy(1),
            uploadPart: () => json({ error: "Bad" }, 400),
        })
        const promise = uploadVideo(baseParams(makeFile(100)))
        const assertion =
            expect(promise).rejects.toBeInstanceOf(VideoUploadError)
        await vi.runAllTimersAsync()
        await assertion
        expect(calls.filter(c => c.name === "uploadPart")).toHaveLength(1)
    })

    it.each([
        ["VideoTooLarge", "tooLarge"],
        ["BadAspectRatio", "badAspectRatio"],
        ["DailyLimitExceeded", "dailyLimit"],
        ["UploadForbidden", "forbidden"],
        ["TooManyOpenUploads", "tooManyUploads"],
        ["ServiceOverloaded", "overloaded"],
    ])(
        "[video-upload/AC-7] startUpload の %s は %s になる",
        async (name, code) => {
            setupFetch({
                ...happy(1),
                startUpload: () => json({ error: name }, 400),
            })
            await expect(
                uploadVideo(baseParams(makeFile(100))),
            ).rejects.toMatchObject({ code })
        },
    )

    it("JOB_STATE_FAILED は processingFailed", async () => {
        setupFetch({
            ...happy(1),
            getJobStatus: () =>
                json({ jobStatus: { state: "JOB_STATE_FAILED" } }),
        })
        const promise = uploadVideo(baseParams(makeFile(100)))
        const assertion = expect(promise).rejects.toMatchObject({
            code: "processingFailed",
        })
        await vi.runAllTimersAsync()
        await assertion
    })

    it("[video-upload/AC-8] ポーリングが上限を超えると timeout", async () => {
        setupFetch({
            ...happy(1),
            getJobStatus: () =>
                json({
                    jobStatus: { state: "JOB_STATE_ENCODING", progress: 1 },
                }),
        })
        const promise = uploadVideo(baseParams(makeFile(100)))
        const assertion = expect(promise).rejects.toMatchObject({
            code: "timeout",
        })
        await vi.advanceTimersByTimeAsync(21 * 60 * 1000)
        await assertion
    })

    it("完了時の blob が不正なら unknown", async () => {
        setupFetch({
            ...happy(1),
            getJobStatus: () =>
                json({ jobStatus: { state: "JOB_STATE_COMPLETED", blob: {} } }),
        })
        const promise = uploadVideo(baseParams(makeFile(100)))
        const assertion = expect(promise).rejects.toMatchObject({
            code: "unknown",
        })
        await vi.runAllTimersAsync()
        await assertion
    })

    it("[video-upload/AC-5] トークンの残りが 5 分未満なら次のリクエスト前に再取得する", async () => {
        setupFetch(happy(2))
        const nowSec = Math.floor(Date.now() / 1000)
        const fetchToken = vi
            .fn()
            .mockResolvedValueOnce({
                token: "t1",
                did: "d",
                expiresAt: nowSec + 200,
            })
            .mockResolvedValue({
                token: "t2",
                did: "d",
                expiresAt: nowSec + 1800,
            })
        const promise = uploadVideo(
            baseParams(makeFile(PART + 1), { fetchToken }),
        )
        await vi.runAllTimersAsync()
        await promise
        // 最初の取得で残り 200 秒（<300）のため、次のリクエストで再取得される
        expect(fetchToken.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it("[video-upload/AC-6] uploadPart 中に中断すると abortUpload が 1 回呼ばれ AbortError", async () => {
        const controller = new AbortController()
        const calls = setupFetch({
            ...happy(2),
            uploadPart: call => {
                controller.abort()
                throw new DOMException("aborted", "AbortError")
            },
        })
        await expect(
            uploadVideo(
                baseParams(makeFile(PART + 1), { signal: controller.signal }),
            ),
        ).rejects.toMatchObject({ name: "AbortError" })
        await vi.runAllTimersAsync()
        expect(calls.filter(c => c.name === "abortUpload")).toHaveLength(1)
    })

    it("[video-upload/AC-6] finishUpload 後の中断では abortUpload は呼ばれない", async () => {
        const controller = new AbortController()
        const calls = setupFetch({
            ...happy(1),
            getJobStatus: () => {
                controller.abort()
                return json({
                    jobStatus: { state: "JOB_STATE_ENCODING", progress: 1 },
                })
            },
        })
        const promise = uploadVideo(
            baseParams(makeFile(100), { signal: controller.signal }),
        )
        const assertion = expect(promise).rejects.toMatchObject({
            name: "AbortError",
        })
        await vi.runAllTimersAsync()
        await assertion
        expect(calls.filter(c => c.name === "abortUpload")).toHaveLength(0)
    })

    it("[video-upload/AC-13] トークン文字列を console に出力しない", async () => {
        const spies = (["log", "info", "warn", "error", "debug"] as const).map(
            m => vi.spyOn(console, m).mockImplementation(() => undefined),
        )
        setupFetch({
            ...happy(1),
            uploadPart: () => json({}, 400),
        })
        const promise = uploadVideo(baseParams(makeFile(100)))
        const assertion = expect(promise).rejects.toBeDefined()
        await vi.runAllTimersAsync()
        await assertion
        for (const spy of spies) {
            expect(JSON.stringify(spy.mock.calls)).not.toContain("secret-token")
        }
        spies.forEach(spy => spy.mockRestore())
    })
})
