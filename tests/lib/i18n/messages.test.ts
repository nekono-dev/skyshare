import { describe, expect, it } from "vitest"

import { en } from "@/lib/i18n/messages/en"
import { ja } from "@/lib/i18n/messages/ja"

const placeholders = (value: string): string[] =>
    [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

describe("辞書の整合性", () => {
    const jaKeys = Object.keys(ja)
    const enRecord = en as Record<string, string>

    it("ja の全キーが en にある", () => {
        const missing = jaKeys.filter(key => !(key in enRecord))
        expect(missing).toEqual([])
    })

    it("en に ja に無いキーは `_one` のみ", () => {
        const extra = Object.keys(enRecord).filter(
            key => !jaKeys.includes(key) && !key.endsWith("_one"),
        )
        expect(extra).toEqual([])
    })

    it("ja の `_other` ごとに en の `_one` がある", () => {
        const missing = jaKeys
            .filter(key => key.endsWith("_other"))
            .map(key => key.replace(/_other$/, "_one"))
            .filter(key => !(key in enRecord))
        expect(missing).toEqual([])
    })

    it("同一キーのプレースホルダが ja と en で一致する", () => {
        const mismatched = jaKeys.filter(key => {
            const jaValue = (ja as Record<string, string>)[key]
            return (
                JSON.stringify(placeholders(jaValue)) !==
                JSON.stringify(placeholders(enRecord[key] ?? ""))
            )
        })
        expect(mismatched).toEqual([])
    })
})
