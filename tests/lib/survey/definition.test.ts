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

/** 文言を差し替える対象。タイトル・説明・質問文・選択肢の表示文 */
const textTargets: {
    name: string
    path: string
    set: (config: ReturnType<typeof createValidConfig>, text: unknown) => void
}[] = [
    {
        name: "タイトル",
        path: "surveys.0.title",
        set: (config, text) => {
            config.surveys[0].title = text as never
        },
    },
    {
        name: "説明",
        path: "surveys.0.description",
        set: (config, text) => {
            config.surveys[0].description = text as never
        },
    },
    {
        name: "質問文",
        path: "surveys.0.questions.0.title",
        set: (config, text) => {
            config.surveys[0].questions[0].title = text as never
        },
    },
    {
        name: "選択肢の表示文",
        path: "surveys.0.questions.0.options.0.label",
        set: (config, text) => {
            config.surveys[0].questions[0].options[0].label = text as never
        },
    },
]

/** 全対応言語の文言を作る（言語ごとに異なる値） */
const fullText = (): Record<string, string> =>
    Object.fromEntries(LOCALES.map(locale => [locale, `text-${locale}`]))

describe("多言語の文言の規則", () => {
    for (const target of textTargets) {
        describe(target.name, () => {
            it(`[survey-definition/2.1] 全対応言語の文言を持てば通る`, () => {
                const config = createValidConfig()
                target.set(config, fullText())
                expect(parseSurveyConfig(config).ok).toBe(true)
            })

            for (const locale of LOCALES) {
                it(`[survey-definition/2.2] ${locale} の文言が欠けると拒否し、位置を報告する`, () => {
                    const config = createValidConfig()
                    const text = fullText()
                    delete text[locale]
                    target.set(config, text)
                    const result = parseSurveyConfig(config)
                    expect(result.ok).toBe(false)
                    if (result.ok) return
                    expect(
                        result.issues.some(issue =>
                            issue.startsWith(`${target.path}.${locale}:`),
                        ),
                        result.issues.join("\n"),
                    ).toBe(true)
                })

                for (const blank of ["", " ", "\t\n", "　　"]) {
                    it(`[survey-definition/2.2] ${locale} の文言が空白だけ（${JSON.stringify(blank)}）だと拒否し、位置を報告する`, () => {
                        const config = createValidConfig()
                        target.set(config, { ...fullText(), [locale]: blank })
                        const result = parseSurveyConfig(config)
                        expect(result.ok).toBe(false)
                        if (result.ok) return
                        expect(
                            result.issues.some(issue =>
                                issue.startsWith(`${target.path}.${locale}:`),
                            ),
                            result.issues.join("\n"),
                        ).toBe(true)
                    })
                }

                it(`[survey-definition/2.2] ${locale} の文言が文字列でないと拒否する`, () => {
                    const config = createValidConfig()
                    target.set(config, { ...fullText(), [locale]: 1 })
                    expect(parseSurveyConfig(config).ok).toBe(false)
                })
            }

            it("[survey-definition/2.3] 未対応の言語の文言を含むと拒否し、キー名を報告しない", () => {
                const config = createValidConfig()
                target.set(config, { ...fullText(), unsupportedLang: "x" })
                const result = parseSurveyConfig(config)
                expect(result.ok).toBe(false)
                if (result.ok) return
                expect(result.issues.join("\n")).not.toContain(
                    "unsupportedLang",
                )
            })

            it("[survey-definition/2.3] 全言語が欠けた空のオブジェクトを拒否する", () => {
                const config = createValidConfig()
                target.set(config, {})
                expect(parseSurveyConfig(config).ok).toBe(false)
            })
        })
    }

    it("[survey-definition/2.1] 説明は省略できるが、指定するなら全言語が必須（片方だけは拒否）", () => {
        const omitted = createValidConfig()
        delete (omitted.surveys[0] as { description?: unknown }).description
        expect(parseSurveyConfig(omitted).ok).toBe(true)

        const partial = createValidConfig()
        partial.surveys[0].description = { ja: "のみ" } as never
        expect(parseSurveyConfig(partial).ok).toBe(false)
    })

    it("[survey-definition/2.2] 前後に空白を含む文言は、そのまま（加工されず）通る", () => {
        const config = createValidConfig()
        config.surveys[0].title = { ja: " 題 ", en: " title " }
        const result = parseSurveyConfig(config)
        expect(result.ok).toBe(true)
        if (result.ok)
            expect(result.config.surveys[0].title).toEqual({
                ja: " 題 ",
                en: " title ",
            })
    })

    it("[survey-definition/2.5] スキーマの言語キーは LOCALES と一致する（追加された言語が欠けた設定は拒否される）", () => {
        // LOCALES ちょうどのキーを持つ文言は通る（スキーマに余分な言語が無い）
        const exact = createValidConfig()
        exact.surveys[0].title = fullText() as never
        expect(parseSurveyConfig(exact).ok).toBe(true)

        // LOCALES の各言語は必須（スキーマに言語の漏れが無い）
        for (const locale of LOCALES) {
            const missing = createValidConfig()
            const text = fullText()
            delete text[locale]
            missing.surveys[0].title = text as never
            expect(parseSurveyConfig(missing).ok, locale).toBe(false)
        }

        // LOCALES に無い言語は受け付けない
        const extra = createValidConfig()
        extra.surveys[0].title = { ...fullText(), zz: "x" } as never
        expect(parseSurveyConfig(extra).ok).toBe(false)
    })

    it("[survey-definition/2.4] 全言語で、指定した言語の文言を返す", () => {
        const text = fullText() as Record<(typeof LOCALES)[number], string>
        for (const locale of LOCALES) {
            expect(localize(text, locale)).toBe(`text-${locale}`)
        }
    })
})

describe("期間の規則", () => {
    /** 2 つのアンケートの期間を差し替えた設定を作る */
    const withPeriods = (
        a: [string, string],
        b: [string, string],
    ): ReturnType<typeof createValidConfig> => {
        const config = createValidConfig()
        ;[config.surveys[0].opensAt, config.surveys[0].closesAt] = a
        ;[config.surveys[1].opensAt, config.surveys[1].closesAt] = b
        return config
    }

    const issuesOf = (input: unknown): string[] => {
        const result = parseSurveyConfig(input)
        expect(result.ok).toBe(false)
        return result.ok ? [] : result.issues
    }

    it("[survey-definition/3.1] Z・±hh:mm のオフセット付き日時を受け付ける", () => {
        const config = withPeriods(
            ["2026-11-01T00:00:00Z", "2026-12-01T00:00:00+09:00"],
            ["2026-12-05T00:00:00-05:00", "2027-01-01T00:00:00.500Z"],
        )
        expect(parseSurveyConfig(config).ok).toBe(true)
    })

    it("[survey-definition/3.1] オフセットなしの日時を拒否し、位置を報告する", () => {
        const config = withPeriods(
            ["2026-11-01T00:00:00", "2026-12-01T00:00:00+09:00"],
            ["2026-12-01T00:00:00+09:00", "2027-01-01T00:00:00"],
        )
        const issues = issuesOf(config)
        expect(issues.some(i => i.startsWith("surveys.0.opensAt:"))).toBe(true)
        expect(issues.some(i => i.startsWith("surveys.1.closesAt:"))).toBe(true)
    })

    it("[survey-definition/3.1] 日時でない文字列・日付だけを拒否する", () => {
        for (const bad of [
            "",
            "tomorrow",
            "2026-11-01",
            "2026-13-01T00:00:00Z",
        ]) {
            const config = withPeriods(
                [bad, "2026-12-01T00:00:00+09:00"],
                ["2026-12-01T00:00:00+09:00", "2027-01-01T00:00:00+09:00"],
            )
            expect(parseSurveyConfig(config).ok, bad).toBe(false)
        }
    })

    it("[survey-definition/3.2] 終了が開始と同時・以前の場合を拒否する", () => {
        const same = withPeriods(
            ["2026-11-01T00:00:00Z", "2026-11-01T00:00:00Z"],
            ["2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"],
        )
        expect(
            issuesOf(same).some(i => i.startsWith("surveys.0.closesAt:")),
        ).toBe(true)
        const before = withPeriods(
            ["2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"],
            ["2027-01-01T00:00:00Z", "2026-12-15T00:00:00Z"],
        )
        expect(
            issuesOf(before).some(i => i.startsWith("surveys.1.closesAt:")),
        ).toBe(true)
    })

    it("[survey-definition/3.2] オフセット違いは時刻値で比較する", () => {
        // 文字列では終了が大きいが、時刻値では終了が開始より前
        const config = withPeriods(
            ["2026-11-01T00:00:00Z", "2026-11-01T05:00:00+09:00"],
            ["2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"],
        )
        expect(parseSurveyConfig(config).ok).toBe(false)
    })

    it("[survey-definition/3.3] 期間が重なるアンケートを拒否する", () => {
        const config = withPeriods(
            ["2026-11-01T00:00:00Z", "2026-12-01T00:00:01Z"],
            ["2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"],
        )
        const issues = issuesOf(config)
        expect(issues.some(i => i.startsWith("surveys.1.opensAt:"))).toBe(true)
    })

    it("[survey-definition/3.3] 並び順に依存せず、離れた位置の重複も拒否する", () => {
        const config = withPeriods(
            ["2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"],
            ["2026-11-01T00:00:00Z", "2026-12-15T00:00:00Z"],
        )
        expect(parseSurveyConfig(config).ok).toBe(false)
    })

    it("[survey-definition/3.3] 終了と次の開始が同時刻の隣接は許可する（オフセット違いでも）", () => {
        const config = withPeriods(
            ["2026-11-01T00:00:00+09:00", "2026-12-01T00:00:00+09:00"],
            ["2026-11-30T15:00:00Z", "2027-01-01T00:00:00+09:00"],
        )
        expect(parseSurveyConfig(config).ok).toBe(true)
    })

    it("[survey-definition/3.3] 報告に日時の値を含めない", () => {
        const config = withPeriods(
            ["2026-11-01T00:00:00Z", "2026-12-15T00:00:00Z"],
            ["2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"],
        )
        expect(issuesOf(config).join("\n")).not.toContain("2026")
    })
    /** 3 件目を加えた設定を、3 件の期間を指定して作る */
    const withThree = (
        a: [string, string],
        b: [string, string],
        c: [string, string],
    ) => {
        const config = withPeriods(a, b)
        const third = structuredClone(config.surveys[1])
        third.id = "survey-2026-c"
        ;[third.opensAt, third.closesAt] = c
        config.surveys.push(third)
        return config
    }

    it("[survey-definition/3.3] 長い期間に内包される複数のアンケートが、それぞれ重複として報告される", () => {
        const config = withThree(
            ["2026-11-01T00:00:00Z", "2027-01-01T00:00:00Z"],
            ["2026-11-05T00:00:00Z", "2026-11-10T00:00:00Z"],
            ["2026-11-20T00:00:00Z", "2026-11-25T00:00:00Z"],
        )
        const issues = issuesOf(config)
        expect(issues.some(i => i.startsWith("surveys.1.opensAt:"))).toBe(true)
        expect(issues.some(i => i.startsWith("surveys.2.opensAt:"))).toBe(true)
    })

    it("[survey-definition/3.2] 終了が開始以前の期間があっても、他の有効なアンケート同士の重複を報告する", () => {
        const config = withThree(
            ["2026-11-01T00:00:00Z", "2026-10-01T00:00:00Z"],
            ["2026-11-10T00:00:00Z", "2026-11-20T00:00:00Z"],
            ["2026-11-15T00:00:00Z", "2026-11-30T00:00:00Z"],
        )
        const issues = issuesOf(config)
        expect(issues.some(i => i.startsWith("surveys.0.closesAt:"))).toBe(true)
        expect(issues.some(i => i.startsWith("surveys.2.opensAt:"))).toBe(true)
        expect(issues.some(i => i.startsWith("surveys.1.opensAt:"))).toBe(false)
    })

    it("[survey-definition/3.2] 終了が開始以前の期間は、重複の報告を余計に生まない", () => {
        const config = withThree(
            ["2026-11-01T00:00:00Z", "2026-10-01T00:00:00Z"],
            ["2026-11-10T00:00:00Z", "2026-11-20T00:00:00Z"],
            ["2026-11-20T00:00:00Z", "2026-11-30T00:00:00Z"],
        )
        const issues = issuesOf(config)
        expect(issues.filter(i => i.includes("opensAt"))).toEqual([])
        expect(issues.length).toBe(1)
    })

    it("[survey-definition/3.1] 存在しない暦日を拒否する", () => {
        const config = withPeriods(
            ["2026-02-30T00:00:00Z", "2026-12-01T00:00:00Z"],
            ["2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"],
        )
        expect(
            issuesOf(config).some(i => i.startsWith("surveys.0.opensAt:")),
        ).toBe(true)
    })
})
