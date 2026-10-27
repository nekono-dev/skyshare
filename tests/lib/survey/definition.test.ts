import { describe, expect, it } from "vitest"

import { LOCALES } from "@/lib/i18n/locale"
import {
    SurveyConfigSchema,
    localize,
    parseSurveyConfig,
} from "@/lib/survey/definition"

import {
    createInvalidCases,
    createValidConfig,
} from "../../fixtures/survey/config"

describe("parseSurveyConfig: 有効な設定", () => {
    it("[survey-definition/1.1] 有効な設定が通り、内容がそのまま返る", () => {
        const input = createValidConfig()
        const result = parseSurveyConfig(input)
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.config).toEqual(input)
    })

    it("[survey-definition/1.2] 質問の識別子・種別・質問文・選択肢の識別子と表示文を持つ", () => {
        const result = parseSurveyConfig(createValidConfig())
        if (!result.ok) throw new Error("有効な設定が拒否された")
        const question = result.config.surveys[0].questions[0]
        expect(question.id).toBe("q-purpose")
        expect(question.kind).toBe("single")
        expect(question.options[0].id).toBe("share")
        expect(question.options[0].label.ja).toBe("共有")
    })

    it("[survey-definition/1.1] 説明は任意で、省略できる", () => {
        const result = parseSurveyConfig(createValidConfig())
        if (!result.ok) throw new Error("有効な設定が拒否された")
        expect(result.config.surveys[1].description).toBeUndefined()
    })

    it("[survey-definition/1.3] 複数選択の上限は任意で、1 以上かつ「回答しない」を除く選択肢数以下を通す", () => {
        const withoutLimit = createValidConfig()
        delete (withoutLimit.surveys[0].questions[1] as { maxSelect?: number })
            .maxSelect
        expect(parseSurveyConfig(withoutLimit).ok).toBe(true)

        for (const max of [1, 3]) {
            const config = createValidConfig()
            ;(
                config.surveys[0].questions[1] as { maxSelect?: number }
            ).maxSelect = max
            expect(parseSurveyConfig(config).ok).toBe(true)
        }
    })

    it("[survey-definition/1.4] 「回答しない」を decline で識別できる", () => {
        const result = parseSurveyConfig(createValidConfig())
        if (!result.ok) throw new Error("有効な設定が拒否された")
        const options = result.config.surveys[0].questions[0].options
        expect(options.map(option => option.decline === true)).toEqual([
            false,
            false,
            true,
        ])
    })

    it("[survey-definition/1.9] 「回答しない」は 1 質問に 1 つなら通る", () => {
        const result = parseSurveyConfig(createValidConfig())
        expect(result.ok).toBe(true)
    })

    it("[survey-definition/1.6] 識別子は英小文字・数字・ハイフンのみ。40 文字まで通り、41 文字は拒否する", () => {
        const ok = createValidConfig()
        ok.surveys[0].id = "a".repeat(40)
        expect(parseSurveyConfig(ok).ok).toBe(true)
        const ng = createValidConfig()
        ng.surveys[0].id = "a".repeat(41)
        expect(parseSurveyConfig(ng).ok).toBe(false)
    })

    it("[survey-definition/1.6] 先頭・末尾・連続のハイフンを拒否する", () => {
        for (const id of ["-a", "a-", "a--b", ""]) {
            const config = createValidConfig()
            config.surveys[0].id = id
            expect(parseSurveyConfig(config).ok, id).toBe(false)
        }
    })

    it("[survey-definition/1.7] 別の質問・別のアンケートでは同じ識別子を使える", () => {
        const config = createValidConfig()
        config.surveys[1].questions[0].id = config.surveys[0].questions[0].id
        config.surveys[1].questions[0].options[0].id =
            config.surveys[0].questions[0].options[0].id
        expect(parseSurveyConfig(config).ok).toBe(true)
    })

    it("[survey-definition/1.1] アンケートが 0 件の配列は有効（何も配信しない）", () => {
        expect(parseSurveyConfig({ surveys: [] }).ok).toBe(true)
    })
})

describe("parseSurveyConfig: 不正な設定", () => {
    for (const invalid of createInvalidCases()) {
        it(`[survey-definition/${invalid.requirement}] ${invalid.name}と拒否され、位置を報告する`, () => {
            const result = parseSurveyConfig(invalid.config)
            expect(result.ok).toBe(false)
            if (result.ok) return
            expect(result.issues.length).toBeGreaterThan(0)
            expect(
                result.issues.some(issue =>
                    issue.startsWith(`${invalid.expectedPath}:`),
                ),
                result.issues.join("\n"),
            ).toBe(true)
        })
    }

    it("[survey-definition/1.1] オブジェクトでない入力を拒否する", () => {
        for (const input of [null, undefined, "x", 1, []]) {
            expect(parseSurveyConfig(input).ok).toBe(false)
        }
    })
})

describe("parseSurveyConfig: 不正の報告", () => {
    it("[survey-definition/5.6] 報告に入力の値が含まれない", () => {
        const secret = "SECRET-VALUE-12345"
        const secretKey = "secretKey"
        const config = createValidConfig()
        config.surveys[0].id = `Bad_${secret}`
        ;(config.surveys[0] as Record<string, unknown>)[secretKey] = secret
        ;(config.surveys[0].questions[0] as Record<string, unknown>).kind =
            secret
        config.surveys[0].questions[1].options[0].id =
            config.surveys[0].questions[1].options[1].id = `dup-${secret}`
        config.surveys[0].questions[0].title = {
            ja: secret,
            en: secret,
            fr: secret,
        } as never
        const result = parseSurveyConfig(config)
        expect(result.ok).toBe(false)
        if (result.ok) return
        const text = result.issues.join("\n")
        expect(text).not.toContain(secret)
        expect(text).not.toContain(secretKey)
        expect(text).not.toContain("dup-")
    })

    it("[survey-definition/5.6] 全ての不正例で、報告に入力の値が含まれない", () => {
        for (const invalid of createInvalidCases()) {
            const result = parseSurveyConfig(invalid.config)
            if (result.ok) continue
            expect(result.issues.join("\n"), invalid.name).not.toContain(
                "秘密の値",
            )
        }
    })

    it("[survey-definition/5.6] 各要素は「位置: 理由」の形", () => {
        const result = parseSurveyConfig({})
        if (result.ok) throw new Error("拒否されるべき")
        for (const issue of result.issues) {
            expect(issue).toMatch(/^[^:]+: .+/)
        }
    })
})

describe("LocalizedText と localize", () => {
    it("[survey-definition/2.4] 指定した言語の文言を返す", () => {
        const result = parseSurveyConfig(createValidConfig())
        if (!result.ok) throw new Error("有効な設定が拒否された")
        const title = result.config.surveys[0].title
        expect(localize(title, "ja")).toBe("使い方アンケート")
        expect(localize(title, "en")).toBe("Usage survey")
    })

    it("[survey-definition/1.1] 検証用の設定は全対応言語の文言を持つ", () => {
        const config = createValidConfig()
        for (const locale of LOCALES) {
            expect(config.surveys[0].title[locale]).toBeTruthy()
        }
    })
})

describe("SurveyConfigSchema", () => {
    it("[survey-definition/1.1] サーバー・画面・生成処理が使うスキーマとして safeParse できる", () => {
        expect(SurveyConfigSchema.safeParse(createValidConfig()).success).toBe(
            true,
        )
        expect(SurveyConfigSchema.safeParse({ surveys: "x" }).success).toBe(
            false,
        )
    })
})
