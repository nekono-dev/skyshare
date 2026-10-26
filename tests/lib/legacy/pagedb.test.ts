import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/client/openapi/client", () => ({
    deleteLegacyPage: vi.fn(),
    getLegacyPage: vi.fn(),
}))

import { deleteLegacyPage, getLegacyPage } from "@/client/openapi/client"
import { deletePageDbEntry, fetchPageDbEntry } from "@/lib/legacy/pagedb"

const mockedDelete = vi.mocked(deleteLegacyPage)
const mockedGet = vi.mocked(getLegacyPage)

afterEach(() => {
    mockedDelete.mockReset()
    mockedGet.mockReset()
    vi.restoreAllMocks()
})

describe("deletePageDbEntry", () => {
    const params = {
        dbIndex: "3",
        dbKey: "did:plc:a@3abc",
        did: "did:plc:a",
        accessJwt: "jwt",
    }

    it("[legacy-page/3.1] 識別子を「dbIndex/dbKey」にして依頼し、成功なら ok を返す", async () => {
        mockedDelete.mockResolvedValue({ status: 200, data: {} } as any)
        expect(await deletePageDbEntry(params)).toEqual({ ok: true })
        expect(mockedDelete).toHaveBeenCalledWith({
            pageId: "3/did:plc:a@3abc",
            did: "did:plc:a",
            accessJwt: "jwt",
        })
    })

    it("[legacy-page/3.2] 旧バックエンドがエラーを返したとき、その理由を返す", async () => {
        mockedDelete.mockResolvedValue({
            status: 400,
            data: { error: "BadRequest" },
        } as any)
        expect(await deletePageDbEntry(params)).toEqual({
            error: "BadRequest",
        })
    })

    it("[legacy-page/3.3] 通信が失敗したとき、不明なエラーとして返す", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
        mockedDelete.mockRejectedValue(new Error("network"))
        expect(await deletePageDbEntry(params)).toEqual({
            error: "UnknownError",
        })
    })
})

describe("fetchPageDbEntry", () => {
    it("[legacy-page/1.1] 取得に成功したとき、OGP画像・投稿者・添付画像を返す", async () => {
        const entry = {
            ogp: "https://example.com/ogp.png",
            handle: "a.test",
            imgs: [{ thumb: "https://example.com/t.png", alt: "alt" }],
        }
        mockedGet.mockResolvedValue({ status: 200, data: entry } as any)
        expect(
            await fetchPageDbEntry({ dbIndex: "legacy", dbKey: "a.test@3abc" }),
        ).toEqual(entry)
        expect(mockedGet).toHaveBeenCalledWith("legacy", "a.test%403abc")
    })

    it("[legacy-page/1.2] 取得に失敗したとき、その理由を返す", async () => {
        mockedGet.mockResolvedValue({
            status: 404,
            data: { error: "BadRequest" },
        } as any)
        expect(await fetchPageDbEntry({ dbIndex: "3", dbKey: "a@b" })).toEqual({
            error: "BadRequest",
        })
    })
})
