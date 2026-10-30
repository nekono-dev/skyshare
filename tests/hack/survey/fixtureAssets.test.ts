/**
 * survey-operation の固定資材が上流の設定契約を満たし、外部出力例を持つことを確認する。
 *
 * 責務と処理概要:
 * - 開始日時のない下書き資材は形状を確認し、登録済み設定と不正設定資材は survey-definition の入口で解析する。
 * - 不正な設定例が個別に拒否されることを確かめる。
 * - gh・wrangler の固定出力例が、値を含まず構造化されていることを確かめる。
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { parseSurveyConfig } from "@/lib/survey/definition"
import { retentionExpired } from "@/lib/survey/period"

const fixture = (relativePath: string): string =>
    readFileSync(
        new URL(
            `../../fixtures/survey-operation/${relativePath}`,
            import.meta.url,
        ),
        "utf8",
    )

const readJson = (relativePath: string): unknown =>
    JSON.parse(fixture(relativePath)) as unknown

describe("survey-operation の固定資材", () => {
    it("[3.5] 識別子ありの下書きは開始日時を含まない", () => {
        const draft = readJson("drafts/with-id.json")
        expect(draft).toBeTypeOf("object")
        if (!draft || typeof draft !== "object") throw new Error("下書きが不正")
        expect("id" in draft).toBe(true)
        expect("opensAt" in draft).toBe(false)
    })

    it("[3.5] 識別子なしの下書きは開始日時と識別子を含まない", () => {
        const draft = readJson("drafts/without-id.json")
        expect(draft).toBeTypeOf("object")
        if (!draft || typeof draft !== "object") throw new Error("下書きが不正")
        expect("id" in draft).toBe(false)
        expect("opensAt" in draft).toBe(false)
    })

    it("[3.5] 既存設定は複数件を検証でき、期限切れの例を含む", () => {
        const input = readJson("configs/existing.json")
        const result = parseSurveyConfig(input)

        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.config.surveys).toHaveLength(2)
        expect(
            retentionExpired(
                result.config.surveys[0],
                new Date("2026-10-28T00:00:00Z"),
            ).answers,
        ).toBe(true)
    })

    it.each([
        ["invalid/missing-locale.json", "対応言語が欠ける"],
        ["invalid/overlapping-periods.json", "期間が重複する"],
        ["invalid/unknown-field.json", "未定義の項目がある"],
    ])("[5.4] %s は個別に上流の設定検証で拒否される (%s)", file => {
        expect(parseSurveyConfig(readJson(file)).ok).toBe(false)
    })

    it("[8.1] GitHub API と wrangler の固定出力例が値を含まず用意されている", () => {
        const absent = readJson("commands/gh-variable-absent.json") as {
            exitCode: number
            stdout: string
            stderr: string
        }
        const authFailure = readJson("commands/gh-auth-failure.json") as {
            exitCode: number
            stdout: string
            stderr: string
        }
        // 読み取りを gh variable get から gh api に変えたため、404 の JSON 本文は stdout に出る。
        expect(absent).toMatchObject({ exitCode: 1 })
        expect(JSON.parse(absent.stdout)).toMatchObject({
            message: "Not Found",
            status: "404",
        })
        expect(absent.stderr).toMatch(/HTTP 404/i)
        expect(authFailure).toMatchObject({ exitCode: 1, stdout: "" })
        expect(authFailure.stderr).toMatch(/auth|login/i)

        const rowPresent = fixture("commands/wrangler-row-present.txt")
        const noRows = fixture("commands/wrangler-no-rows.txt")
        const progress = fixture("commands/wrangler-progress-output.txt")
        const failure = readJson("commands/wrangler-failure.json") as {
            exitCode: number
            stdout: string
            stderr: string
        }
        expect(JSON.parse(rowPresent)).toMatchObject([
            { results: [{ r: 1, a: 0 }] },
        ])
        expect(JSON.parse(noRows)).toMatchObject([
            { results: [{ r: 0, a: 0 }] },
        ])
        expect(progress).toContain("Executing")
        expect(progress).toContain('"results":[{"r":0,"a":1}]')
        expect(failure.exitCode).toBe(1)
        expect(failure.stdout).toBe("")
    })
})
