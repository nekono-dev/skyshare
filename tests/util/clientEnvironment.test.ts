/**
 * ブラウザの実行環境の判定の検証。
 *
 * 責務と処理概要:
 * - 代表的な識別文字列から OS とブラウザが求まること、ホーム画面からの起動の判定、
 *   userAgentData による補いを検証する。
 */
import { describe, expect, it } from "vitest"
import {
    collectClientEnvironment,
    detectStandalone,
    parseUserAgent,
} from "@/util/clientEnvironment"

const UA = {
    iphoneSafari:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    iphoneChrome:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
    androidChrome:
        "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
    windowsEdge:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
    macFirefox:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0",
    ipadDesktop:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
}

/** `matchMedia` と `navigator` だけを持つフェイクの window */
const fakeWindow = (opts: {
    displayMode?: string
    standalone?: boolean
    userAgent?: string
    maxTouchPoints?: number
    userAgentData?: unknown
}): Window =>
    ({
        matchMedia: (query: string) => ({
            matches: query === `(display-mode: ${opts.displayMode})`,
        }),
        navigator: {
            userAgent: opts.userAgent ?? "",
            maxTouchPoints: opts.maxTouchPoints ?? 0,
            standalone: opts.standalone,
            userAgentData: opts.userAgentData,
        },
    }) as unknown as Window

describe("parseUserAgent", () => {
    it.each([
        [UA.iphoneSafari, 0, "iOS 18.1", "Safari 18.1"],
        [UA.iphoneChrome, 0, "iOS 17.5", "Chrome 126.0.6478.54"],
        [UA.androidChrome, 0, "Android 14", "Chrome 141.0.0.0"],
        [UA.windowsEdge, 0, "Windows 10/11", "Edge 141.0.0.0"],
        [UA.macFirefox, 0, "macOS 10.15", "Firefox 131.0"],
        [UA.ipadDesktop, 5, "iPadOS", "Safari 18.0"],
        ["curl/8.0", 0, "Unknown", "Unknown"],
    ])(
        "[feedback-form/3.2] 識別文字列から OS とブラウザを求める (%#)",
        (ua, touch, os, browser) => {
            expect(parseUserAgent(ua, touch)).toEqual({ os, browser })
        },
    )
})

describe("detectStandalone", () => {
    it("[feedback-form/3.2] display-mode と iOS の standalone から起動の形態を求める", () => {
        expect(
            detectStandalone(fakeWindow({ displayMode: "standalone" })),
        ).toBe(true)
        expect(
            detectStandalone(fakeWindow({ displayMode: "minimal-ui" })),
        ).toBe(true)
        expect(detectStandalone(fakeWindow({ standalone: true }))).toBe(true)
        expect(detectStandalone(fakeWindow({ displayMode: "browser" }))).toBe(
            false,
        )
    })
})

describe("collectClientEnvironment", () => {
    it("userAgentData があれば Windows 11 と詳しい版で補う", async () => {
        const env = await collectClientEnvironment(
            fakeWindow({
                userAgent: UA.windowsEdge,
                userAgentData: {
                    getHighEntropyValues: async () => ({
                        platform: "Windows",
                        platformVersion: "15.0.0",
                        fullVersionList: [
                            { brand: "Not=A?Brand", version: "24.0.0.0" },
                            { brand: "Chromium", version: "141.0.7390.55" },
                            {
                                brand: "Microsoft Edge",
                                version: "141.0.3537.57",
                            },
                        ],
                    }),
                },
            }),
        )
        expect(env).toEqual({
            os: "Windows 11",
            browser: "Edge 141.0.3537.57",
            userAgent: UA.windowsEdge,
            standalone: false,
        })
    })

    it("userAgentData の取得に失敗したら識別文字列の判定を使う", async () => {
        const env = await collectClientEnvironment(
            fakeWindow({
                userAgent: UA.androidChrome,
                userAgentData: {
                    getHighEntropyValues: async () => {
                        throw new Error("denied")
                    },
                },
            }),
        )
        expect(env.os).toBe("Android 14")
        expect(env.browser).toBe("Chrome 141.0.0.0")
    })
})
