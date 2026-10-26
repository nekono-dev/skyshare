import { describe, expect, it, vi } from "vitest"

import { listRecordsSince } from "@/lib/atproto/repo"
import { ENTRY_COLLECTION } from "@/lib/atproto/nsid"

describe("listRecordsSince", () => {
    const record = (id: string, createdAt: unknown) => ({
        uri: `at://${id}`,
        value: { createdAt },
    })
    const since = Date.parse("2026-01-10T00:00:00Z")
    const makeAgent = (...pages: { records: any[]; cursor?: string }[]) => {
        const listRecords = vi.fn()
        for (const page of pages) {
            listRecords.mockResolvedValueOnce({ data: page })
        }
        return {
            listRecords,
            agent: { com: { atproto: { repo: { listRecords } } } },
        }
    }

    it("[timeline-api/4.2] 新しい順（reverse）で100件ずつ取得する", async () => {
        const { agent, listRecords } = makeAgent({
            records: [record("a", "2026-01-12T00:00:00Z")],
        })

        await listRecordsSince(
            agent,
            { repo: "did:plc:abc", collection: ENTRY_COLLECTION },
            since,
        )

        expect(listRecords).toHaveBeenCalledWith({
            repo: "did:plc:abc",
            collection: ENTRY_COLLECTION,
            cursor: undefined,
            limit: 100,
            reverse: true,
        })
    })

    it("[atproto-access/2.1] 複数ページのcursorを辿って全件結合する", async () => {
        const { agent, listRecords } = makeAgent(
            {
                records: [record("a", "2026-01-15T00:00:00Z")],
                cursor: "c1",
            },
            {
                records: [record("b", "2026-01-14T00:00:00Z")],
                cursor: "c2",
            },
            { records: [record("c", "2026-01-13T00:00:00Z")] },
        )

        const result = await listRecordsSince(
            agent,
            { repo: "did:plc:abc", collection: ENTRY_COLLECTION },
            since,
        )

        expect(result.map(r => r.uri)).toEqual(["at://a", "at://b", "at://c"])
        expect(listRecords).toHaveBeenCalledTimes(3)
    })

    it("[timeline-api/4.2] ページ内がすべて始点より古ければ、cursorがあっても次のページを取得しない", async () => {
        const { agent, listRecords } = makeAgent(
            {
                records: [
                    record("a", "2026-01-12T00:00:00Z"),
                    record("b", "2026-01-09T00:00:00Z"),
                ],
                cursor: "c1",
            },
            {
                records: [record("c", "2026-01-05T00:00:00Z")],
                cursor: "c2",
            },
            { records: [record("d", "2026-01-01T00:00:00Z")] },
        )

        const result = await listRecordsSince(
            agent,
            { repo: "did:plc:abc", collection: ENTRY_COLLECTION },
            since,
        )

        // 1ページ目は新しいレコードを含むので継続、2ページ目は全件古いので打ち切る
        expect(listRecords).toHaveBeenCalledTimes(2)
        expect(result.map(r => r.uri)).toEqual(["at://a", "at://b", "at://c"])
    })

    it("cursorが無くなれば、始点より新しいレコードだけでも終了する", async () => {
        const { agent, listRecords } = makeAgent({
            records: [record("a", "2026-01-12T00:00:00Z")],
        })

        const result = await listRecordsSince(
            agent,
            { repo: "did:plc:abc", collection: ENTRY_COLLECTION },
            since,
        )

        expect(listRecords).toHaveBeenCalledTimes(1)
        expect(result).toHaveLength(1)
    })

    it("createdAtが読めないレコードは古いとみなさず、取得を続ける", async () => {
        const { agent, listRecords } = makeAgent(
            {
                records: [record("a", undefined), record("b", "invalid")],
                cursor: "c1",
            },
            { records: [record("c", "2026-01-01T00:00:00Z")] },
        )

        await listRecordsSince(
            agent,
            { repo: "did:plc:abc", collection: ENTRY_COLLECTION },
            since,
        )

        expect(listRecords).toHaveBeenCalledTimes(2)
    })

    it("レコードが0件のページでは終了する", async () => {
        const { agent, listRecords } = makeAgent({ records: [] })

        const result = await listRecordsSince(
            agent,
            { repo: "did:plc:abc", collection: ENTRY_COLLECTION },
            since,
        )

        expect(result).toEqual([])
        expect(listRecords).toHaveBeenCalledTimes(1)
    })
})
