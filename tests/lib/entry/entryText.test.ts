import { describe, expect, it } from "vitest"

import {
    ENTRY_CAPTION_MAX_LENGTH,
    ENTRY_HEADING_MAX_LENGTH,
    buildEntryText,
} from "@/lib/entry/entryText"

describe("buildEntryText", () => {
    it("heading は「投稿者名 | Skyshare」、caption は trim 済み本文を返す", () => {
        expect(
            buildEntryText({ userName: "Alice", postText: " Hello " }),
        ).toEqual({ heading: "Alice | Skyshare", caption: "Hello" })
    })

    it("動画投稿は heading が再生時間（m:ss）になり、投稿者名は使わない", () => {
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
        expect(text.heading).toHaveLength(ENTRY_HEADING_MAX_LENGTH)
        expect(text.heading?.endsWith(" | Skyshare")).toBe(true)
        expect(text.caption).toHaveLength(ENTRY_CAPTION_MAX_LENGTH)
    })
})
