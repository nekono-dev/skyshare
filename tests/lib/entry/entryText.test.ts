import { describe, expect, it } from "vitest"

import {
    ENTRY_CAPTION_MAX_BYTES,
    ENTRY_HEADING_MAX_BYTES,
    buildEntryText,
} from "@/lib/entry/entryText"

describe("buildEntryText", () => {
    it("[entry-visual/AC-8] heading は「投稿者名 | Skyshare」、caption は trim 済み本文を返す", () => {
        expect(
            buildEntryText({ userName: "Alice", postText: " Hello " }),
        ).toEqual({ heading: "Alice | Skyshare", caption: "Hello" })
    })

    it("[entry-visual/AC-8] 動画投稿は heading が再生時間（m:ss）になり、投稿者名は使わない", () => {
        expect(
            buildEntryText({
                userName: "Alice",
                postText: "Hello",
                videoDurationSec: 65,
            }),
        ).toEqual({ heading: "1:05", caption: "Hello" })
    })

    it("本文が空白のみなら caption を含めない", () => {
        const text = buildEntryText({ userName: "Alice", postText: "   " })
        expect(text).toEqual({ heading: "Alice | Skyshare" })
        expect("caption" in text).toBe(false)
    })

    it("上限を超える値は切り詰める", () => {
        const text = buildEntryText({
            userName: "a".repeat(500),
            postText: "b".repeat(500),
        })
        expect(text.heading).toHaveLength(ENTRY_HEADING_MAX_BYTES)
        expect(text.heading?.endsWith(" | Skyshare")).toBe(true)
        expect(text.caption).toHaveLength(ENTRY_CAPTION_MAX_BYTES)
    })

    it("上限はlexiconに合わせてUTF-8のバイト数で数え、日本語は文字の途中で切らない", () => {
        const text = buildEntryText({
            userName: "あ".repeat(100),
            postText: "い".repeat(200),
        })
        expect(
            new TextEncoder().encode(text.heading!).length,
        ).toBeLessThanOrEqual(ENTRY_HEADING_MAX_BYTES)
        expect(text.heading?.endsWith(" | Skyshare")).toBe(true)
        // 300バイトに収まる最大の文字数（3バイト×100文字）
        expect(text.caption).toBe("い".repeat(100))
    })
})
