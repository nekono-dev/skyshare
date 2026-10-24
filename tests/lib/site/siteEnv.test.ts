/**
 * 運用者ごとの設定の解決と検証。
 *
 * 責務と処理概要:
 * - 本番ビルドの必須値・形式の検査、任意の値と開発時のダミー値の解決、サイトの URL の決定を検証する。
 */
import { describe, expect, it } from "vitest"
import { checkSiteEnv, resolveSiteConfig, siteUrl } from "@/lib/site/siteEnv"

const valid = {
    SITE_HOST: "s.example.org",
    PUBLIC_OPERATOR_NAME: "example-operator",
    PUBLIC_OPERATOR_EMAIL: "privacy@example.org",
    PUBLIC_OPERATOR_BLUESKY_HANDLE: "example.org",
    PUBLIC_PRIVACY_ENACTED_AT: "2030-01-02",
    PUBLIC_PRIVACY_REVISED_AT: "2030-03-04",
    PUBLIC_GA_MEASUREMENT_ID: "G-TEST123",
}

describe("checkSiteEnv", () => {
    it("[site-config/AC-1] 必須の値が欠けると欠けた変数名を挙げ、そろえば問題がない", () => {
        const problems = checkSiteEnv({})
        expect(problems).toHaveLength(5)
        for (const name of [
            "SITE_HOST",
            "PUBLIC_OPERATOR_NAME",
            "PUBLIC_OPERATOR_EMAIL",
            "PUBLIC_PRIVACY_ENACTED_AT",
            "PUBLIC_PRIVACY_REVISED_AT",
        ])
            expect(problems.join()).toContain(name)
        expect(checkSiteEnv(valid)).toEqual([])
    })

    it("[site-config/AC-2] 形式の違う値を問題として挙げる", () => {
        const problems = checkSiteEnv({
            ...valid,
            SITE_HOST: "https://s.example.org/",
            PUBLIC_OPERATOR_EMAIL: "no-at-mark",
            PUBLIC_PRIVACY_ENACTED_AT: "2030/01/02",
            PUBLIC_GA_MEASUREMENT_ID: '"><script>',
        })
        expect(problems).toHaveLength(4)
    })
})

describe("resolveSiteConfig", () => {
    it("[site-config/AC-3] 任意の値は省いても問題がなく、設定すればそのまま使い、形式が違えば使わない", () => {
        const {
            PUBLIC_OPERATOR_BLUESKY_HANDLE: _h,
            PUBLIC_GA_MEASUREMENT_ID: _g,
            ...required
        } = valid
        expect(checkSiteEnv(required)).toEqual([])
        expect(resolveSiteConfig(valid, false)).toEqual({
            operator: {
                name: "example-operator",
                email: "privacy@example.org",
                blueskyHandle: "example.org",
            },
            privacy: { enactedAt: "2030-01-02", revisedAt: "2030-03-04" },
            analyticsId: "G-TEST123",
        })
        const broken = resolveSiteConfig(
            { ...valid, PUBLIC_GA_MEASUREMENT_ID: '"><script>' },
            false,
        )
        expect(broken.analyticsId).toBeNull()
    })

    it("[site-config/AC-4] 開発時は未設定の必須値をダミー値で補い、任意の値は使わない", () => {
        const config = resolveSiteConfig({}, true)
        expect(config.operator.email).toBe("operator@example.com")
        expect(config.privacy.enactedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(config.operator.blueskyHandle).toBeNull()
        expect(config.analyticsId).toBeNull()
    })
})

describe("siteUrl", () => {
    it("[site-config/AC-6] 公開するドメインからサイトの URL を作り、未設定なら開発サーバーのアドレスにする", () => {
        expect(siteUrl({ SITE_HOST: "s.example.org" })).toBe(
            "https://s.example.org",
        )
        expect(siteUrl({})).toBe("https://localhost:4321")
    })
})
