import { describe, expect, it } from "vitest"

import { formatDateTime, formatNumber } from "@/lib/i18n/format"

describe("formatDateTime", () => {
    const iso = "2026-09-06T10:00:00.000Z"
    const options = {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Tokyo",
    } as const

    it("[i18n-messages/AC-4] ja は従来の toLocaleString('ja-JP') と一致する", () => {
        expect(formatDateTime(iso, "ja", options)).toBe(
            new Date(iso).toLocaleString("ja-JP", options),
        )
    })
    it("[i18n-messages/AC-3] en は英語の書式になる", () => {
        expect(formatDateTime(iso, "en", options)).toBe(
            new Date(iso).toLocaleString("en-US", options),
        )
        expect(formatDateTime(iso, "en", options)).toMatch(/Sep/)
    })
    it("不正な日付は空文字", () => {
        expect(formatDateTime("not-a-date", "ja")).toBe("")
    })
})

describe("formatNumber", () => {
    it("[i18n-messages/AC-3] 桁区切りを言語に合わせる", () => {
        expect(formatNumber(12345, "en")).toBe("12,345")
        expect(formatNumber(12345, "ja")).toBe("12,345")
    })
})
