import { describe, expect, it } from "vitest"

import {
    ENTRY_CAPTION_MAX_LENGTH,
    ENTRY_HEADING_MAX_LENGTH,
    buildEntryText,
} from "@/lib/entry/entryText"

describe("buildEntryText", () => {
    it("画像投稿は heading と trim 済み caption を返す", () => {
        expect(
            buildEntryText({
                userName: "Alice",
                postText: " Hello ",
                isVideo: false,
            }),
        ).toEqual({ heading: "Alice 's Post", caption: "Hello" })
    })

    it("動画投稿は heading を含めない", () => {
        const text = buildEntryText({
            userName: "Alice",
            postText: "Hello",
            isVideo: true,
        })
        expect(text).toEqual({ caption: "Hello" })
        expect("heading" in text).toBe(false)
    })

    it("本文が空白のみなら caption を含めない", () => {
        const text = buildEntryText({
            userName: "Alice",
            postText: "   ",
            isVideo: false,
        })
        expect("caption" in text).toBe(false)
    })

    it("上限を超える値は切り詰める", () => {
        const text = buildEntryText({
            userName: "a".repeat(500),
            postText: "b".repeat(500),
            isVideo: false,
        })
        expect(text.heading).toHaveLength(ENTRY_HEADING_MAX_LENGTH)
        expect(text.caption).toHaveLength(ENTRY_CAPTION_MAX_LENGTH)
    })
})
