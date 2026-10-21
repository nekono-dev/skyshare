/**
 * プライバシーポリシーの節の組み立ての検証。
 *
 * 責務と処理概要:
 * - 節の識別子・並び、取得する情報の区分、外部送信の組、予約投稿の記載、定数の参照、表示言語による違いを検証する。
 */
import { describe, expect, it } from "vitest"
import { operator } from "@/lib/privacy/operator"
import { buildPrivacyPolicy } from "@/lib/privacy/policySections"
import { createTranslator } from "@/lib/i18n/translate"

const ja = () => buildPrivacyPolicy(createTranslator("ja").t)
const en = () => buildPrivacyPolicy(createTranslator("en").t)
const find = (id: string) => ja().find(s => s.id === id)!
const allText = (sections = ja()) =>
    JSON.stringify(sections.map(s => [s.title, s.blocks]))

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
            "cookies",
            "rights",
            "revision",
        ])
        for (const s of ja()) expect(s.title).not.toBe("")
    })

    it("[privacy-policy/AC-2] 取得する情報の節が、5つの区分をすべて持つ", () => {
        const list = find("collected").blocks.find(b => b.kind === "list")
        if (list?.kind !== "list") throw new Error("箇条書きがない")
        const keywords = [
            "ログイン",
            "予約投稿",
            "ブラウザにのみ",
            "アクセスログ",
            "Google アナリティクス",
        ]
        expect(list.items).toHaveLength(keywords.length)
        keywords.forEach((k, i) => expect(list.items[i]).toContain(k))
    })

    it("[privacy-policy/AC-3] 第三者への提供の節が、提供する場合ごとに1項目を持つ", () => {
        const list = find("external").blocks.find(b => b.kind === "list")
        if (list?.kind !== "list") throw new Error("箇条書きがない")
        expect(list.items.length).toBeGreaterThanOrEqual(4)
        const joined = list.items.join()
        for (const k of ["法令", "Bluesky", "Cloudflare", "Google"])
            expect(joined).toContain(k)
    })

    it("[privacy-policy/AC-4] 予約投稿の記載に、暗号化・保存期間・削除の方法が含まれる", () => {
        const text = allText()
        expect(text).toContain("暗号化して保管")
        expect(text).toContain("7日")
        expect(text).toContain("45日")
        expect(text).toContain("いつでも自分で削除")
    })

    it("[privacy-policy/AC-8] 表を使わず、箇条書きは1階層で、1文が長すぎない", () => {
        for (const section of ja()) {
            for (const block of section.blocks) {
                expect(["text", "list"]).toContain(block.kind)
                const lines = block.kind === "list" ? block.items : [block.text]
                for (const line of lines) {
                    for (const sentence of line.split("。")) {
                        expect(sentence.length).toBeLessThanOrEqual(80)
                    }
                }
            }
        }
        expect(allText()).not.toContain("AES")
    })

    it("[privacy-policy/AC-5] 記載の全体から、事業者名・連絡先・制定日が定数の値で参照される", () => {
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
})
