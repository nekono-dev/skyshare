/**
 * 見出し・説明文の上限が、lexiconに合わせてUTF-8のバイト数で判定されることのテスト。
 */
import { describe, expect, it } from "vitest"

import { RequestBodySchema as UpdateSchema } from "@/lib/api/schema/v2/entry/put"

const body = (heading: string, caption = "c") => ({
    uri: "at://did:plc:a/dev.nekono.skyshare.entry/3x",
    heading,
    caption,
})

describe("entry の見出し・説明文の上限", () => {
    it("[entry-api/1.7] 100バイトまでの見出しを受理し、日本語34文字（102バイト）は拒否する", () => {
        expect(UpdateSchema.safeParse(body("あ".repeat(33))).success).toBe(true)
        expect(UpdateSchema.safeParse(body("あ".repeat(34))).success).toBe(
            false,
        )
    })

    it("[entry-api/1.7] 300バイトまでの説明文を受理し、日本語101文字（303バイト）は拒否する", () => {
        expect(
            UpdateSchema.safeParse(body("h", "あ".repeat(100))).success,
        ).toBe(true)
        expect(
            UpdateSchema.safeParse(body("h", "あ".repeat(101))).success,
        ).toBe(false)
    })
})
