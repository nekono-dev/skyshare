/**
 * 対象の API の入口（薄い入口）の形を静的に検査するテスト（src-pages-thin 6.1・要件 4.1）。
 *
 * 責務と処理概要:
 * - 対象の 6 ファイル（`src/pages/v2` 配下の入口）を `node:fs` で読み、ソースの文字列として検査する。
 * - ページモジュール自体は import しない（静的な文字列の検査のみ）。
 * - 検査は 2 種類。
 *   1. バインディングの参照がないこと: `env.` で始まる参照、および
 *      `getScheduleEnv` / `getFeedbackEnv` / `FEEDBACK_GITHUB_TOKEN` / `FEEDBACK_RATE_LIMITER` /
 *      `SCHEDULE_IMAGES` / `SCHEDULE_ENC_KEY` / `.DB` の識別子がコードに現れないこと。
 *   2. 禁止したモジュールを import しないこと: `@/lib/schedule/env`、`@/lib/feedback/env`、
 *      `@/lib/schedule/store`、`@/lib/schedule/imageStaging`、`@/lib/schedule/stageSchedule`、
 *      `@/lib/schedule/oauth` 配下、`cloudflare:workers`。
 * - コメントを除いてから照合する方法: 複数行コメント `/* ... *\/` を正規表現で取り除き、
 *   次に行頭（空白の後）が `//` で始まる行を取り除く。文字列中の `//`（URL など）は行頭でない限り残るため、
 *   コード中の参照は取りこぼさない。コメント内の語（`env.DB` など）は照合対象外になる。
 * - 負例（検査が機能することの確認）: `findViolations` に、違反を含む文字列
 *   （`env.DB` の参照と `@/lib/schedule/store` の import）を与え、違反として報告されることを確かめる。
 *   この負例は本ファイル内の固定文字列で行い、実ファイルは使わない。
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")

/** 検査対象の薄い入口（6 ファイル）。リポジトリルートからの相対パス。 */
const THIN_ENTRY_FILES = [
    "src/pages/v2/entry.ts",
    "src/pages/v2/schedules.ts",
    "src/pages/v2/schedules/[id].ts",
    "src/pages/v2/schedules/credential.ts",
    "src/pages/v2/schedules/[id]/images/[index].ts",
    "src/pages/v2/feedback.ts",
] as const

/** 禁止する import 先（完全一致）。 */
const FORBIDDEN_MODULES = [
    "@/lib/schedule/env",
    "@/lib/feedback/env",
    "@/lib/schedule/store",
    "@/lib/schedule/imageStaging",
    "@/lib/schedule/stageSchedule",
    "cloudflare:workers",
] as const

/** 禁止する import 先の接頭辞（この配下のすべて）。 */
const FORBIDDEN_MODULE_PREFIXES = ["@/lib/schedule/oauth/"] as const

/** 禁止する識別子（コード中に現れてはならない語）。 */
const FORBIDDEN_IDENTIFIERS = [
    "getScheduleEnv",
    "getFeedbackEnv",
    "FEEDBACK_GITHUB_TOKEN",
    "FEEDBACK_RATE_LIMITER",
    "SCHEDULE_IMAGES",
    "SCHEDULE_ENC_KEY",
] as const

/** バインディングの参照（`env.` で始まる参照）の正規表現。 */
const ENV_MEMBER_PATTERN = /\benv\.[A-Za-z_]/g

/** `.DB` の参照の正規表現（D1 バインディングの取得の痕跡）。 */
const DB_MEMBER_PATTERN = /\.DB\b/g

/**
 * ソースからコメントを取り除く（検査の前処理）。
 * - 複数行コメント（`/* ... *\/`）を除去する。
 * - 行頭（空白の後）が `//` で始まる行を除去する。
 * - 行の途中の `//` は除去しない（文字列中の URL を壊さないため）。
 */
const stripComments = (source: string): string =>
    source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter(line => !line.trimStart().startsWith("//"))
        .join("\n")

/** 単一の行から import 先のモジュール指定子をすべて集める。 */
const collectModuleSpecifiers = (code: string): string[] => {
    const specifiers: string[] = []
    // `from "x"`、`import "x"`、`import("x")` の 3 形式を対象にする
    const pattern = /(?:\bfrom\s+|\bimport\s*\(?\s*)["']([^"']+)["']/g
    for (const match of code.matchAll(pattern)) {
        specifiers.push(match[1])
    }
    return specifiers
}

/**
 * ソースを検査し、違反の一覧を返す（空配列なら違反なし）。
 * 検査の対象はコメントを除いたコードのみ。
 */
const findViolations = (source: string): string[] => {
    const code = stripComments(source)
    const violations: string[] = []

    for (const match of code.matchAll(ENV_MEMBER_PATTERN)) {
        violations.push(`バインディングの参照: ${match[0]}`)
    }
    for (const match of code.matchAll(DB_MEMBER_PATTERN)) {
        violations.push(`バインディングの参照: ${match[0]}`)
    }
    for (const identifier of FORBIDDEN_IDENTIFIERS) {
        const pattern = new RegExp(`\\b${identifier}\\b`)
        if (pattern.test(code)) {
            violations.push(`禁止した識別子: ${identifier}`)
        }
    }

    for (const specifier of collectModuleSpecifiers(code)) {
        const forbiddenExact = (
            FORBIDDEN_MODULES as readonly string[]
        ).includes(specifier)
        const forbiddenPrefix = FORBIDDEN_MODULE_PREFIXES.some(prefix =>
            specifier.startsWith(prefix),
        )
        if (forbiddenExact || forbiddenPrefix) {
            violations.push(`禁止した import: ${specifier}`)
        }
    }
    return violations
}

/** 指定した相対パスのファイルを読み、違反を集める。 */
const violationsOf = (relativePath: string): string[] =>
    findViolations(readFileSync(path.join(repoRoot, relativePath), "utf8"))

describe("対象の API の入口の形（src-pages-thin 6.1・要件 4.1）", () => {
    it.each(THIN_ENTRY_FILES)(
        "%s にバインディングの参照がない（env. の参照・禁止した識別子・.DB がない）",
        relativePath => {
            const source = readFileSync(
                path.join(repoRoot, relativePath),
                "utf8",
            )
            const code = stripComments(source)
            const references = [
                ...code.matchAll(ENV_MEMBER_PATTERN),
                ...code.matchAll(DB_MEMBER_PATTERN),
            ].map(match => match[0])
            expect(references).toEqual([])
            for (const identifier of FORBIDDEN_IDENTIFIERS) {
                expect(code).not.toMatch(new RegExp(`\\b${identifier}\\b`))
            }
        },
    )

    it.each(THIN_ENTRY_FILES)(
        "%s が禁止したモジュール（env・store・imageStaging・stageSchedule・oauth・cloudflare:workers）を import しない",
        relativePath => {
            const source = readFileSync(
                path.join(repoRoot, relativePath),
                "utf8",
            )
            const specifiers = collectModuleSpecifiers(stripComments(source))
            const forbidden = specifiers.filter(
                specifier =>
                    (FORBIDDEN_MODULES as readonly string[]).includes(
                        specifier,
                    ) ||
                    FORBIDDEN_MODULE_PREFIXES.some(prefix =>
                        specifier.startsWith(prefix),
                    ),
            )
            expect(forbidden).toEqual([])
        },
    )

    it("6 ファイルすべてに違反がない（統合の確認）", () => {
        const report = Object.fromEntries(
            THIN_ENTRY_FILES.map(file => [file, violationsOf(file)]),
        )
        expect(report).toEqual(
            Object.fromEntries(THIN_ENTRY_FILES.map(file => [file, []])),
        )
    })

    describe("検査の負例（検査が違反を検出できることの確認）", () => {
        it("env.DB の参照と禁止した import を含む文字列を違反として報告する", () => {
            const fixture = [
                'import { getScheduleStore } from "@/lib/schedule/store"',
                "export const POST = async ({ locals }) => {",
                "    const db = env.DB",
                "    return new Response(String(db))",
                "}",
            ].join("\n")
            const violations = findViolations(fixture)
            expect(violations).toContain("バインディングの参照: env.D")
            expect(violations).toContain(
                "禁止した import: @/lib/schedule/store",
            )
        })

        it("oauth 配下・cloudflare:workers・禁止した識別子を違反として報告する", () => {
            const fixture = [
                'import { x } from "@/lib/schedule/oauth/session"',
                'import { env } from "cloudflare:workers"',
                "const key = getScheduleEnv().SCHEDULE_ENC_KEY",
            ].join("\n")
            const violations = findViolations(fixture)
            expect(violations).toContain(
                "禁止した import: @/lib/schedule/oauth/session",
            )
            expect(violations).toContain("禁止した import: cloudflare:workers")
            expect(violations).toContain("禁止した識別子: getScheduleEnv")
            expect(violations).toContain("禁止した識別子: SCHEDULE_ENC_KEY")
        })

        it("コメント内だけの語は違反として報告しない", () => {
            const fixture = [
                "// env.DB と SCHEDULE_IMAGES はここでは使わない",
                "/* import from '@/lib/schedule/store' は禁止 */",
                'import { errorResponseFromStatus } from "@/util/http"',
            ].join("\n")
            expect(findViolations(fixture)).toEqual([])
        })
    })
})
