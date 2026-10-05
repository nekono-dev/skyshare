import { describe, expect, it } from "vitest"

import { buildIntentText, resolveTruncateLimit } from "@/util/share/intent"
import {
    INTENT_TRAILING_MARGIN,
    INTENT_WEIGHTED_LIMIT,
    weightedLength,
} from "@/util/share/truncateText"

const ENTRY_URL = "https://skyshare.nekono.dev/entries/abc"
const LONG_BODY = "あ".repeat(200)

describe("resolveTruncateLimit", () => {
    it.each([
        ["x", true, INTENT_WEIGHTED_LIMIT - INTENT_TRAILING_MARGIN],
        ["taittsuu", true, INTENT_WEIGHTED_LIMIT - INTENT_TRAILING_MARGIN],
        ["mastodon", true, undefined],
        ["x", false, undefined],
        ["taittsuu", false, undefined],
        ["mastodon", false, undefined],
    ] as const)("%s / 設定%s → %s", (target, enabled, expected) => {
        expect(resolveTruncateLimit(target, enabled)).toBe(expected)
    })
})

describe("buildIntentText の省略", () => {
    it("truncateLimit未指定なら省略しない", () => {
        const text = buildIntentText(LONG_BODY, ENTRY_URL)
        expect(text).toBe(`${LONG_BODY}\n${ENTRY_URL}`)
    })

    it("truncateLimit指定ならskyshareUriありで省略する", () => {
        const text = buildIntentText(LONG_BODY, ENTRY_URL, undefined, {
            truncateLimit: INTENT_WEIGHTED_LIMIT,
        })
        expect(text.endsWith(`...\n${ENTRY_URL}`)).toBe(true)
        expect(weightedLength(text)).toBeLessThanOrEqual(INTENT_WEIGHTED_LIMIT)
    })

    it("skyshareUriが空でも、リンクカードURLを残して本文を省略する", () => {
        const text = buildIntentText(
            LONG_BODY,
            "",
            "https://example.com/page",
            { truncateLimit: INTENT_WEIGHTED_LIMIT },
        )
        expect(text.endsWith("...\nhttps://example.com/page")).toBe(true)
        expect(weightedLength(text)).toBeLessThanOrEqual(INTENT_WEIGHTED_LIMIT)
    })

    it("URLが一切無くても、本文のみを省略する", () => {
        const text = buildIntentText(LONG_BODY, "", undefined, {
            truncateLimit: INTENT_WEIGHTED_LIMIT,
        })
        expect(text.endsWith("...")).toBe(true)
        expect(weightedLength(text)).toBeLessThanOrEqual(INTENT_WEIGHTED_LIMIT)
    })

    it("リンクカードURLも末尾要素として削らずに残す", () => {
        const text = buildIntentText(
            LONG_BODY,
            ENTRY_URL,
            "https://example.com/page",
            { truncateLimit: INTENT_WEIGHTED_LIMIT },
        )
        expect(
            text.endsWith(`...\n${ENTRY_URL}\nhttps://example.com/page`),
        ).toBe(true)
        expect(weightedLength(text)).toBeLessThanOrEqual(INTENT_WEIGHTED_LIMIT)
    })

    it("本文に含まれるリンクカードURLは重複して付けない", () => {
        const text = buildIntentText(
            "見て example.com/page",
            ENTRY_URL,
            "https://example.com/page",
            { truncateLimit: INTENT_WEIGHTED_LIMIT },
        )
        expect(text).toBe(`見て example.com/page\n${ENTRY_URL}`)
    })

    it("上限以内なら加工しない", () => {
        const text = buildIntentText("短い本文", ENTRY_URL, undefined, {
            truncateLimit: INTENT_WEIGHTED_LIMIT,
        })
        expect(text).toBe(`短い本文\n${ENTRY_URL}`)
    })
})
