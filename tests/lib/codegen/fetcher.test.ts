import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/vars", () => ({ extractorApi: "https://extract.test" }))
vi.mock("@/env", () => ({ v1Endpoint: "https://legacy.test/api" }))

import { customFetcher } from "@/lib/codegen/fetcher"

const fetchMock = vi.fn()

afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
})

const respond = (body: BodyInit | null, init?: ResponseInit) => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockResolvedValue(new Response(body, init))
}

describe("customFetcher", () => {
    it("[api-codegen/AC-3] 抽出APIのパスは、抽出サービスのURLへ書き換え、パスの末尾のスラッシュを外す", async () => {
        respond(JSON.stringify({ ok: 1 }), { status: 200 })
        await customFetcher("/v1/extract/?url=https%3A%2F%2Fa.test", {})
        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://extract.test/v1/extract?url=https%3A%2F%2Fa.test",
        )
    })

    it("[api-codegen/AC-4] 旧ページのパスは、旧バックエンドのURLへ書き換える", async () => {
        respond("{}", { status: 200 })
        await customFetcher("/v1/page/3/key/", {})
        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://legacy.test/api/page/3/key",
        )
    })

    it("[api-codegen/AC-5] 応答の本文が空でもJSONでなくても、例外にならずdataへ格納される", async () => {
        respond(null, { status: 200 })
        const empty = await customFetcher<{ data: unknown; status: number }>(
            "/v2/entry/",
            {},
        )
        expect(empty.data).toBeUndefined()
        expect(empty.status).toBe(200)

        respond("plain text", { status: 500 })
        const text = await customFetcher<{ data: unknown; status: number }>(
            "/v2/entry/",
            {},
        )
        expect(text.data).toBe("plain text")
        expect(text.status).toBe(500)
    })

    it("[api-codegen/AC-6] 画像のAPIの応答は、JSONにせず Blob のまま返す", async () => {
        respond(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "content-type": "image/png" },
        })
        const res = await customFetcher<{ data: Blob; status: number }>(
            "/v2/bsky/images/?cid=x",
            {},
        )
        expect(res.data).toBeInstanceOf(Blob)
        expect(res.data.size).toBe(3)
    })

    it("[api-codegen/AC-6] 予約の画像の取得の応答も Blob で返り、エラーの JSON は解釈される", async () => {
        respond(new Uint8Array([9, 9]), {
            status: 200,
            headers: { "content-type": "image/jpeg" },
        })
        const ok = await customFetcher<{ data: Blob }>(
            "/v2/schedules/s1/images/0/",
            {},
        )
        expect(ok.data).toBeInstanceOf(Blob)
        respond(JSON.stringify({ error: "Not Found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
        })
        const ng = await customFetcher<{ data: unknown; status: number }>(
            "/v2/schedules/s1/images/9/",
            {},
        )
        expect(ng.status).toBe(404)
        expect(ng.data).toEqual({ error: "Not Found" })
    })
})
