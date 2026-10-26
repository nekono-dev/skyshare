import { describe, expect, it } from "vitest"

import {
    buildIntentText,
    buildIntentUrl,
    resolveTruncateLimit,
} from "@/util/share/intent"
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
        ["misskey", true, undefined],
        ["x", false, undefined],
        ["taittsuu", false, undefined],
        ["mastodon", false, undefined],
        ["misskey", false, undefined],
    ] as const)(
        "[share-text/3.2] %s / 設定%s → %s",
        (target, enabled, expected) => {
            expect(resolveTruncateLimit(target, enabled)).toBe(expected)
        },
    )
})

describe("buildIntentUrl", () => {
    it("Misskeyはインスタンスの /share に text を付けたURLを返す", () => {
        expect(
            buildIntentUrl("misskey", "こんにちは\nhttps://example.com", {
                instanceDomain: "misskey.io",
            }),
        ).toBe(
            "https://misskey.io/share?text=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF%0Ahttps%3A%2F%2Fexample.com",
        )
    })

    it.each(["mastodon", "misskey"] as const)(
        "%s はインスタンスドメイン未指定ならnullを返す",
        target => {
            expect(buildIntentUrl(target, "hello")).toBeNull()
        },
    )
})

describe("buildIntentText の省略", () => {
    it("[share-text/1.1] truncateLimit未指定なら省略しない", () => {
        const text = buildIntentText(LONG_BODY, ENTRY_URL)
        expect(text).toBe(`${LONG_BODY}\n${ENTRY_URL}`)
    })

    it("[share-text/1.1] 本文・skyshare entryのURL・リンクカードのURLを、この順に改行区切りで連結する", () => {
        const text = buildIntentText(
            "見て",
            ENTRY_URL,
            "https://example.com/page",
        )
        expect(text).toBe(`見て\n${ENTRY_URL}\nhttps://example.com/page`)
    })

    it("[share-text/3.1] truncateLimit指定ならskyshareUriありで省略する", () => {
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

    it("[share-text/3.3] リンクカードURLも末尾要素として削らずに残す", () => {
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

    it("[share-text/1.2] 本文に含まれるリンクカードURLは重複して付けない", () => {
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
