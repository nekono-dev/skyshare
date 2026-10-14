import { describe, expect, it } from "vitest"

import { buildHelpEntries } from "@/components/help/helpEntries"
import { createTranslator } from "@/lib/i18n/translate"

describe("buildHelpEntries", () => {
    it("[help-page/AC-1] 記事の識別子は重複せず、見出しと本文が空でない", () => {
        const entries = buildHelpEntries(createTranslator("ja").t)
        expect(entries.length).toBeGreaterThan(0)
        expect(new Set(entries.map(entry => entry.id)).size).toBe(
            entries.length,
        )
        for (const entry of entries) {
            expect(entry.title).not.toBe("")
            expect(entry.description).toBeTruthy()
        }
    })

    it("[help-page/AC-2] 表示言語が変わると、見出しの文言が変わり、記事の並びと識別子は変わらない", () => {
        const ja = buildHelpEntries(createTranslator("ja").t)
        const en = buildHelpEntries(createTranslator("en").t)
        expect(en.map(entry => entry.id)).toEqual(ja.map(entry => entry.id))
        expect(en[0].title).not.toBe(ja[0].title)
    })
})
