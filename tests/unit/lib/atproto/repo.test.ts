/**
 * listRecordsSince のページング（打ち切りの条件と、並び順の前提）を固定する。
 *
 * - 既定の並び（新しい順）で取得し、ページ内の全件が sinceMs より古いときだけ打ち切る。
 */
import { describe, expect, it, vi } from "vitest"
import { listRecordsSince } from "@/lib/atproto/repo"

type Page = { records: { value: { createdAt: unknown } }[]; cursor?: string }

const makeAgent = (pages: Page[]) => {
    const listRecords = vi.fn(async (params: { cursor?: string }) => {
        const index = params.cursor ? Number(params.cursor) : 0
        return { data: pages[index] }
    })
    const agent = {
        com: { atproto: { repo: { listRecords } } },
    } as unknown as Parameters<typeof listRecordsSince>[0]
    return { listRecords, agent }
}

const at = (iso: string) => ({ value: { createdAt: iso } })

describe("listRecordsSince", () => {
    it("does not request reverse order", async () => {
        const { agent, listRecords } = makeAgent([
            { records: [at("2026-01-02T00:00:00Z")] },
        ])
        await listRecordsSince(
            agent,
            { repo: "did:plc:x", collection: "c" },
            Date.parse("2026-01-01T00:00:00Z"),
        )
        expect(listRecords).toHaveBeenCalledTimes(1)
        expect(listRecords.mock.calls[0][0]).not.toHaveProperty("reverse")
    })

    it("keeps fetching while a page has a record that is not older than sinceMs", async () => {
        const { agent, listRecords } = makeAgent([
            {
                records: [
                    at("2026-01-03T00:00:00Z"),
                    at("2025-12-01T00:00:00Z"),
                ],
                cursor: "1",
            },
            { records: [at("2026-01-02T00:00:00Z")], cursor: "2" },
            { records: [at("2025-11-01T00:00:00Z")] },
        ])
        const records = await listRecordsSince(
            agent,
            { repo: "did:plc:x", collection: "c" },
            Date.parse("2026-01-01T00:00:00Z"),
        )
        expect(records).toHaveLength(4)
        expect(listRecords).toHaveBeenCalledTimes(3)
    })

    it("stops at the first page where every record is older than sinceMs", async () => {
        const { agent, listRecords } = makeAgent([
            {
                records: [at("2025-12-01T00:00:00Z")],
                cursor: "1",
            },
            { records: [at("2026-01-05T00:00:00Z")] },
        ])
        const records = await listRecordsSince(
            agent,
            { repo: "did:plc:x", collection: "c" },
            Date.parse("2026-01-01T00:00:00Z"),
        )
        expect(records).toHaveLength(1)
        expect(listRecords).toHaveBeenCalledTimes(1)
    })

    it("does not stop on a record whose createdAt cannot be parsed", async () => {
        const { agent, listRecords } = makeAgent([
            {
                records: [{ value: { createdAt: undefined } }],
                cursor: "1",
            },
            { records: [at("2026-01-05T00:00:00Z")] },
        ])
        await listRecordsSince(
            agent,
            { repo: "did:plc:x", collection: "c" },
            Date.parse("2026-01-01T00:00:00Z"),
        )
        expect(listRecords).toHaveBeenCalledTimes(2)
    })
})
