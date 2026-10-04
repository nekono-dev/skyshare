import { afterEach, describe, expect, it, vi } from "vitest"

import {
    probeVideo,
    resolveVideoMimeType,
    validateVideoFile,
    VideoProbeError,
} from "@/lib/video/probeVideo"

describe("resolveVideoMimeType", () => {
    it.each([
        ["video/mp4", "a.mp4"],
        ["video/quicktime", "a.mov"],
        ["video/webm", "a.webm"],
        ["video/mpeg", "a.mpg"],
    ])("MIME %s はそのまま返す", (type, name) => {
        expect(resolveVideoMimeType({ type, name })).toBe(type)
    })

    it("MIME が空のときは拡張子（大文字小文字を問わない）で判定する", () => {
        expect(resolveVideoMimeType({ type: "", name: "a.MOV" })).toBe(
            "video/quicktime",
        )
        expect(resolveVideoMimeType({ type: "", name: "a.mpeg" })).toBe(
            "video/mpeg",
        )
        expect(
            resolveVideoMimeType({ type: "", name: "a.avi" }),
        ).toBeUndefined()
        expect(
            resolveVideoMimeType({ type: "", name: "noext" }),
        ).toBeUndefined()
    })

    it("MIME が対応外なら、拡張子が対応形式でも対応外", () => {
        expect(
            resolveVideoMimeType({ type: "application/pdf", name: "a.mp4" }),
        ).toBeUndefined()
    })
})

describe("validateVideoFile", () => {
    it("対応形式以外は unsupportedFormat", () => {
        expect(
            validateVideoFile({
                type: "video/x-msvideo",
                name: "a.avi",
                size: 1,
            }),
        ).toBe("unsupportedFormat")
        expect(validateVideoFile({ type: "", name: "a", size: 1 })).toBe(
            "unsupportedFormat",
        )
    })

    it("mov・webm・mpeg は可、301MB の mov は tooLarge", () => {
        for (const [type, name] of [
            ["video/quicktime", "a.mov"],
            ["video/webm", "a.webm"],
            ["video/mpeg", "a.mpg"],
        ])
            expect(validateVideoFile({ type, name, size: 1 })).toBeUndefined()
        expect(
            validateVideoFile({
                type: "video/quicktime",
                name: "a.mov",
                size: 300_000_001,
            }),
        ).toBe("tooLarge")
    })

    it("300,000,001 バイトは tooLarge、300,000,000 バイトは可", () => {
        expect(
            validateVideoFile({
                type: "video/mp4",
                name: "a.mp4",
                size: 300_000_001,
            }),
        ).toBe("tooLarge")
        expect(
            validateVideoFile({
                type: "video/mp4",
                name: "a.mp4",
                size: 300_000_000,
            }),
        ).toBeUndefined()
    })
})

describe("probeVideo", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    /** loadedmetadata / seeked を即座に発火する偽の <video> を使う。 */
    const stubBrowser = (video: {
        videoWidth: number
        videoHeight: number
        duration: number
        fail?: boolean
    }) => {
        const revoke = vi.fn()
        const drawn: unknown[][] = []
        const fakeVideo: any = {
            ...video,
            currentTime: 0,
            listeners: {} as Record<string, () => void>,
            addEventListener(name: string, fn: () => void) {
                this.listeners[name] = fn
            },
            set src(_v: string) {
                queueMicrotask(() =>
                    this.fail
                        ? this.listeners.error?.()
                        : this.listeners.loadedmetadata?.(),
                )
            },
        }
        Object.defineProperty(fakeVideo, "currentTime", {
            get() {
                return this._t ?? 0
            },
            set(v: number) {
                this._t = v
                queueMicrotask(() => this.listeners.seeked?.())
            },
        })
        const canvas: any = {
            width: 0,
            height: 0,
            getContext: () => ({
                drawImage: (...args: unknown[]) => drawn.push(args),
            }),
            toBlob: (cb: (b: Blob) => void, type: string) =>
                cb(new Blob(["x"], { type })),
        }
        vi.stubGlobal("document", {
            createElement: (tag: string) =>
                tag === "video" ? fakeVideo : canvas,
        })
        vi.stubGlobal("URL", {
            createObjectURL: () => "blob:x",
            revokeObjectURL: revoke,
        })
        return { fakeVideo, canvas, revoke, drawn }
    }

    const file = new File(["x"], "a.mp4", { type: "video/mp4" })

    it("寸法・長さ・JPEG の poster を返し、0.1 秒へシークし、object URL を revoke する", async () => {
        const { fakeVideo, canvas, revoke } = stubBrowser({
            videoWidth: 2560,
            videoHeight: 1440,
            duration: 5,
        })
        const probe = await probeVideo(file)
        expect(probe).toMatchObject({
            width: 2560,
            height: 1440,
            durationSec: 5,
        })
        expect(probe.posterBlob.type).toBe("image/jpeg")
        expect(fakeVideo.currentTime).toBe(0.1)
        // 最大辺 1280 に縮小
        expect(canvas.width).toBe(1280)
        expect(canvas.height).toBe(720)
        expect(revoke).toHaveBeenCalledWith("blob:x")
    })

    it("長さが短い動画は duration/2 へシークする", async () => {
        const { fakeVideo } = stubBrowser({
            videoWidth: 10,
            videoHeight: 10,
            duration: 0.1,
        })
        await probeVideo(file)
        expect(fakeVideo.currentTime).toBeCloseTo(0.05)
    })

    it("601 秒は tooLong", async () => {
        const { revoke } = stubBrowser({
            videoWidth: 10,
            videoHeight: 10,
            duration: 601,
        })
        await expect(probeVideo(file)).rejects.toMatchObject({
            code: "tooLong",
        })
        expect(revoke).toHaveBeenCalled()
    })

    it("duration が NaN・寸法 0 は unreadable", async () => {
        stubBrowser({ videoWidth: 10, videoHeight: 10, duration: NaN })
        await expect(probeVideo(file)).rejects.toBeInstanceOf(VideoProbeError)
        stubBrowser({ videoWidth: 0, videoHeight: 0, duration: 5 })
        await expect(probeVideo(file)).rejects.toMatchObject({
            code: "unreadable",
        })
    })

    it("読み込みエラーは unreadable", async () => {
        stubBrowser({
            videoWidth: 10,
            videoHeight: 10,
            duration: 5,
            fail: true,
        })
        await expect(probeVideo(file)).rejects.toMatchObject({
            code: "unreadable",
        })
    })

    it("requestVideoFrameCallback があれば、フレーム提示の後に描画する（Safari の黒フレーム対策）", async () => {
        const { fakeVideo, drawn } = stubBrowser({
            videoWidth: 10,
            videoHeight: 10,
            duration: 5,
        })
        let presentFrame: () => void = () => undefined
        fakeVideo.requestVideoFrameCallback = (cb: () => void) => {
            presentFrame = cb
        }
        const promise = probeVideo(file)
        // seeked 後もフレームが提示されるまでは描画されない
        await new Promise(resolve => setTimeout(resolve, 20))
        expect(drawn).toHaveLength(0)
        presentFrame()
        await promise
        expect(drawn).toHaveLength(1)
    })

    it("requestVideoFrameCallback が無く readyState が足りなければ、loadeddata を待ってから描画する", async () => {
        const { fakeVideo, drawn } = stubBrowser({
            videoWidth: 10,
            videoHeight: 10,
            duration: 5,
        })
        fakeVideo.readyState = 1
        const promise = probeVideo(file)
        await new Promise(resolve => setTimeout(resolve, 20))
        expect(drawn).toHaveLength(0)
        fakeVideo.listeners.loadeddata()
        await promise
        expect(drawn).toHaveLength(1)
    })
})
