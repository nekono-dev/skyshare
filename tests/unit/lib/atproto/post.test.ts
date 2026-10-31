/**
 * Bluesky 投稿レコードの組み立ての特性化テスト（src-cycles 1.3・要件 3.2）。
 *
 * 責務と処理概要:
 * - 代表的な入力に対して、投稿レコードの形（種別・本文・作成日時・由来）が変わらないことを固定する。
 */
import { describe, expect, it } from "vitest"
import { buildBskyPostRecord } from "@/lib/atproto/post"

describe("投稿レコードの組み立て（特性化）", () => {
    it("本文と作成日時だけの入力から、投稿レコードの形を組み立てる", () => {
        expect(
            buildBskyPostRecord({
                text: "hello",
                facets: undefined,
                langs: undefined,
                embed: undefined,
                selfLabel: undefined,
                reply: undefined,
                createdAt: "2026-01-01T00:00:00.000Z",
            }),
        ).toEqual({
            $type: "app.bsky.feed.post",
            text: "hello",
            createdAt: "2026-01-01T00:00:00.000Z",
            via: "Skyshare",
        })
    })
})
