import { describe, expect, it, vi } from "vitest"

import { listAllRecords } from "@/lib/atproto/repo"

describe("listAllRecords", () => {
    it("1ページのみで完結する場合はそのまま返す", async () => {
        const listRecords = vi.fn().mockResolvedValue({
            data: { records: [{ uri: "at://a" }, { uri: "at://b" }] },
        })
        const agent = { com: { atproto: { repo: { listRecords } } } }

        const result = await listAllRecords(agent, {
            repo: "did:plc:abc",
            collection: "dev.nekono.skyshare.entry",
        })

        expect(result).toEqual([{ uri: "at://a" }, { uri: "at://b" }])
        expect(listRecords).toHaveBeenCalledTimes(1)
        expect(listRecords).toHaveBeenCalledWith({
            repo: "did:plc:abc",
            collection: "dev.nekono.skyshare.entry",
            cursor: undefined,
            limit: 100,
        })
    })

    it("複数ページのcursorを辿って全件結合する", async () => {
        const listRecords = vi
            .fn()
            .mockResolvedValueOnce({
                data: { records: [{ uri: "at://a" }], cursor: "next1" },
            })
            .mockResolvedValueOnce({
                data: { records: [{ uri: "at://b" }], cursor: "next2" },
            })
            .mockResolvedValueOnce({
                data: { records: [{ uri: "at://c" }] },
            })
        const agent = { com: { atproto: { repo: { listRecords } } } }

        const result = await listAllRecords(agent, {
            repo: "did:plc:abc",
            collection: "dev.nekono.skyshare.entry",
        })

        expect(result).toEqual([
            { uri: "at://a" },
            { uri: "at://b" },
            { uri: "at://c" },
        ])
        expect(listRecords).toHaveBeenCalledTimes(3)
    })

    it("recordsが無いページはスキップして続行する", async () => {
        const listRecords = vi.fn().mockResolvedValue({ data: {} })
        const agent = { com: { atproto: { repo: { listRecords } } } }

        expect(
            await listAllRecords(agent, {
                repo: "did:plc:abc",
                collection: "x",
            }),
        ).toEqual([])
    })
})
