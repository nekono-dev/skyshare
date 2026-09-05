import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/atproto/publicAgent", () => ({
    publicAtpAgent: {
        app: { bsky: { graph: { getLists: vi.fn() } } },
    },
}))

import { publicAtpAgent } from "@/lib/atproto/publicAgent"
import { getOwnLists } from "@/lib/atproto/lists"

const getLists = publicAtpAgent.app.bsky.graph.getLists as ReturnType<
    typeof vi.fn
>

beforeEach(() => {
    getLists.mockReset()
})

describe("getOwnLists", () => {
    it("curatelistのみ抽出し、modlistを除外して{uri,name}へ整形する", async () => {
        getLists.mockResolvedValue({
            data: {
                lists: [
                    {
                        uri: "at://did:plc:abc/app.bsky.graph.list/1",
                        name: "close friends",
                        purpose: "app.bsky.graph.defs#curatelist",
                    },
                    {
                        uri: "at://did:plc:abc/app.bsky.graph.list/2",
                        name: "spam",
                        purpose: "app.bsky.graph.defs#modlist",
                    },
                ],
            },
        })

        const result = await getOwnLists("did:plc:abc")

        expect(getLists).toHaveBeenCalledWith({
            actor: "did:plc:abc",
            limit: 100,
        })
        expect(result).toEqual([
            {
                uri: "at://did:plc:abc/app.bsky.graph.list/1",
                name: "close friends",
            },
        ])
    })

    it("リストが0件の場合は空配列を返す", async () => {
        getLists.mockResolvedValue({ data: { lists: [] } })

        const result = await getOwnLists("did:plc:abc")

        expect(result).toEqual([])
    })

    it("失敗時は例外を呼び出し元へ投げる", async () => {
        getLists.mockRejectedValue(new Error("network error"))

        await expect(getOwnLists("did:plc:abc")).rejects.toThrow(
            "network error",
        )
    })
})
