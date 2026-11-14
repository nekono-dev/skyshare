/**
 * プライバシーポリシーの日付が最終改定日だけであること（制定日を持たないこと）を確かめる。
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { createTranslator } from "@/lib/i18n/translate"
import { buildPrivacyPolicy } from "@/lib/site/policySections"
import { checkSiteEnv, resolveSiteConfig } from "@/lib/site/siteEnv"
import { siteConfig } from "@/lib/site/siteConfig"

const repoRoot = path.resolve(__dirname, "../../../..")

describe("最終改定日だけを持つ", () => {
    it("必須の環境変数に制定日を求めず、設定にも制定日を持たない", () => {
        const env = {
            SITE_HOST: "example.test",
            PUBLIC_OPERATOR_NAME: "operator",
            PUBLIC_OPERATOR_EMAIL: "operator@example.test",
            PUBLIC_PRIVACY_REVISED_AT: "2026-11-14",
        }

        expect(checkSiteEnv(env)).toEqual([])
        expect(resolveSiteConfig(env, false).privacy).toEqual({
            revisedAt: "2026-11-14",
        })
    })

    it("改定の節は、日本語・英語とも最終改定日だけを示す", () => {
        for (const [locale, expected] of [
            ["ja", `最終改定日: ${siteConfig.privacy.revisedAt}`],
            ["en", `Last revised: ${siteConfig.privacy.revisedAt}`],
        ] as const) {
            const section = buildPrivacyPolicy(
                createTranslator(locale).t,
                siteConfig,
            ).find(s => s.id === "revision")
            const texts = section!.blocks.flatMap(block =>
                block.kind === "text" ? [block.text] : [],
            )

            expect(texts).toContain(expected)
            expect(texts.join("\n")).not.toMatch(/制定日|Enacted/)
        }
    })

    it("設定・CI・手順書・雛形に、制定日の環境変数の名前が残らない", () => {
        const files = [
            "config/develop.example.json",
            "config/production.example.json",
            ".github/workflows/preview.yaml",
            ".github/workflows/deploy.yaml",
            "scripts/config/render-deploy-config.mjs",
            "docs/DEVELOP.md",
            "src/lib/site/siteEnv.ts",
            "src/lib/site/siteConfig.ts",
        ]
        for (const file of files) {
            const text = fs.readFileSync(path.join(repoRoot, file), "utf8")
            expect(text, file).not.toContain("PRIVACY_ENACTED_AT")
        }
    })
})
