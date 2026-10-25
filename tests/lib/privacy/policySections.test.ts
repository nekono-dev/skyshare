/**
 * プライバシーポリシーの節の組み立ての検証。
 *
 * 責務と処理概要:
 * - 節の識別子・並び、収集する情報の区分、共有の例外、予約投稿の記載、連絡先の項目、設定の値の参照、
 *   表示言語による違いを検証する。
 */
import { describe, expect, it } from "vitest"
import {
    buildPrivacyPolicy,
    type PolicyItem,
} from "@/lib/privacy/policySections"
import { createTranslator } from "@/lib/i18n/translate"
import type { SiteConfig } from "@/lib/site/siteConfig"

// 運用者ごとの設定の例（実行中のビルドの値に依存しないよう、テストで固定する）
const config: SiteConfig = {
    operator: {
        name: "example-operator",
        email: "privacy@example.org",
        blueskyHandle: "example.org",
    },
    privacy: { enactedAt: "2030-01-02", revisedAt: "2030-03-04" },
    analyticsId: "G-TEST123",
}
const operator = { ...config.operator, ...config.privacy }
const ja = (c: SiteConfig = config) =>
    buildPrivacyPolicy(createTranslator("ja").t, c)
const en = () => buildPrivacyPolicy(createTranslator("en").t, config)
const find = (id: string) => ja().find(s => s.id === id)!
const allText = (sections = ja()) =>
    JSON.stringify(sections.map(s => [s.title, s.blocks]))

/** 節の箇条書きの項目（最初の箇条書き） */
const items = (id: string, sections = ja()): PolicyItem[] => {
    const list = sections
        .find(s => s.id === id)!
        .blocks.find(b => b.kind === "list")
    if (list?.kind !== "list") throw new Error("箇条書きがない")
    return list.items
}
/** 項目の文（項目名つきの値は「項目名: 値」） */
const itemText = (item: PolicyItem) =>
    typeof item === "string" ? item : `${item.label}: ${item.value}`

describe("buildPrivacyPolicy", () => {
    it("[privacy-policy/AC-1] 節の識別子が重複せず、必須の節がこの順に並ぶ", () => {
        const ids = ja().map(s => s.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids).toEqual([
            "operator",
            "collected",
            "purpose",
            "external",
            "retention",
            "security",
            "cookies",
            "rights",
            "revision",
        ])
        for (const s of ja()) expect(s.title).not.toBe("")
    })

    it("[privacy-policy/AC-2] 収集する情報の節が、6つの区分をすべて持つ", () => {
        const keywords = [
            "ログイン",
            "予約投稿",
            "Cloudflare",
            "Google アナリティクス",
            "お問い合わせ",
            "不具合の報告",
        ]
        const list = items("collected").map(itemText)
        expect(list).toHaveLength(keywords.length)
        keywords.forEach((k, i) => expect(list[i]).toContain(k))
    })

    it("[privacy-policy/AC-3] 情報の共有の節が、5つの例外を1項目ずつ持つ", () => {
        const list = items("external").map(itemText)
        const keywords = [
            "利用者の操作",
            "Cloudflare",
            "Google",
            "GitHub",
            "法令",
        ]
        expect(list).toHaveLength(keywords.length)
        keywords.forEach((k, i) => expect(list[i]).toContain(k))
    })

    it("[privacy-policy/AC-4] 予約投稿の記載に、暗号化・保持期間・削除の方法が含まれる", () => {
        const text = allText()
        expect(text).toContain("暗号化して保管")
        expect(text).toContain("7日")
        expect(text).toContain("15日")
        expect(text).toContain("30日")
        expect(text).toContain("予約投稿を無効にすると")
    })

    it("[privacy-policy/AC-8] 表を使わず、箇条書きは1階層で、1文が長すぎず、見出しに条番号がない", () => {
        for (const section of ja()) {
            expect(section.title).not.toMatch(/第\d+条/)
            for (const block of section.blocks) {
                expect(["text", "list"]).toContain(block.kind)
                const lines =
                    block.kind === "list"
                        ? block.items.map(itemText)
                        : [block.text]
                for (const line of lines) {
                    for (const sentence of line.split("。")) {
                        expect(sentence.length).toBeLessThanOrEqual(80)
                    }
                }
            }
        }
        expect(allText()).not.toContain("AES")
    })

    it("[privacy-policy/AC-9] 連絡先が項目名つきで並び、ユーザーの権利に開示・訂正・削除と連絡先が含まれる", () => {
        expect(items("operator")).toEqual([
            { label: "運営者", value: operator.name },
            {
                label: "メールアドレス",
                value: operator.email,
                href: `mailto:${operator.email}`,
            },
            {
                label: "Bluesky",
                value: `@${operator.blueskyHandle}`,
                href: `https://bsky.app/profile/${operator.blueskyHandle}`,
            },
        ])
        const rights = JSON.stringify(find("rights").blocks)
        for (const k of ["開示", "訂正", "削除", "連絡先"])
            expect(rights).toContain(k)
    })

    it("[privacy-policy/AC-5] 記載の全体から、活動名・連絡先・制定日が設定の値で参照される", () => {
        const text = allText()
        expect(text).toContain(operator.name)
        expect(text).toContain(operator.email)
        expect(text).toContain(`@${operator.blueskyHandle}`)
        expect(text).toContain(operator.enactedAt)
        expect(text).toContain(operator.revisedAt)
        expect(text).not.toMatch(/\{\w+\}/)
    })

    it("[privacy-policy/AC-6] 表示言語が変わると見出しの文言が変わり、節の並びと識別子が変わらない", () => {
        expect(en().map(s => s.id)).toEqual(ja().map(s => s.id))
        expect(en()[0]!.title).not.toBe(ja()[0]!.title)
        expect(allText(en())).not.toMatch(/\{\w+\}/)
    })

    it("[privacy-policy/AC-10] アクセス解析を使わない設定では、その記載を除く", () => {
        const text = allText(ja({ ...config, analyticsId: null }))
        expect(text).not.toContain("Google")
        expect(
            ja({ ...config, analyticsId: null }).find(s => s.id === "cookies")!
                .title,
        ).toBe("Cookie")
        expect(allText()).toContain("Google アナリティクス")
    })

    it("[privacy-policy/AC-11] 窓口のハンドルが未設定なら、連絡先から Bluesky のアカウントを除く", () => {
        const sections = ja({
            ...config,
            operator: { ...config.operator, blueskyHandle: null },
        })
        const contact = items("operator", sections).map(itemText)
        expect(contact).toEqual([
            `運営者: ${config.operator.name}`,
            `メールアドレス: ${config.operator.email}`,
        ])
        expect(allText(sections)).not.toContain("bsky.app")
    })
})
