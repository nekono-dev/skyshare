import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/client/openapi/client", () => ({
    extractUrl: vi.fn(),
}))

import { extractUrl } from "@/client/openapi/client"
import { warmOgpCache } from "@/lib/entry/warmOgpCache"

const mockedExtract = vi.mocked(extractUrl)

afterEach(() => {
    mockedExtract.mockReset()
    vi.restoreAllMocks()
})

describe("warmOgpCache", () => {
    it("[ogp-link-card/3.1] URLをOGP抽出サービスへ渡し、3秒で打ち切る指定を付ける", async () => {
        mockedExtract.mockResolvedValue({ status: 200 } as any)
        const timeoutSpy = vi.spyOn(AbortSignal, "timeout")
        await warmOgpCache("https://skyshare.nekono.dev/entries/x")
        expect(mockedExtract.mock.calls[0][0]).toEqual({
            url: "https://skyshare.nekono.dev/entries/x",
        })
        expect(timeoutSpy).toHaveBeenCalledWith(3000)
    })

    it("[ogp-link-card/3.3] URLが空のとき、何も呼ばない", async () => {
        await warmOgpCache("")
        expect(mockedExtract).not.toHaveBeenCalled()
    })

    it("[ogp-link-card/3.2] 呼び出しが失敗しても、例外を投げない", async () => {
        mockedExtract.mockRejectedValue(new Error("network"))
        await expect(
            warmOgpCache("https://example.com"),
        ).resolves.toBeUndefined()
    })
})
