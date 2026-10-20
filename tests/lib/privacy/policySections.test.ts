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
            "security",
            "rights",
            "revision",
        ])
        for (const s of ja()) expect(s.title).not.toBe("")
    })

    it("[privacy-policy/AC-2] 取得する情報の節が、5つの区分をすべて持つ", () => {
        const table = find("collected").blocks.find(b => b.kind === "table")
        if (table?.kind !== "table") throw new Error("表がない")
        expect(table.rows.map(r => r[0])).toEqual([
            "ログイン",
            "投稿とエントリ",
            "予約投稿",
            "端末内の保存",
            "アクセスログ",
        ])
        for (const row of table.rows) {
            expect(row).toHaveLength(3)
            for (const cell of row) expect(cell).not.toBe("")
        }
    })

    it("[privacy-policy/AC-3] 外部への送信の節が、送信先ごとに送信する情報と目的を持つ", () => {
        const table = find("external").blocks.find(b => b.kind === "table")
        if (table?.kind !== "table") throw new Error("表がない")
        expect(table.head).toHaveLength(3)
        expect(table.rows.length).toBeGreaterThanOrEqual(9)
        for (const row of table.rows) {
            expect(row).toHaveLength(3)
            for (const cell of row) expect(cell).not.toBe("")
        }
    })

    it("[privacy-policy/AC-4] 予約投稿の記載に、暗号化・保存期間・削除の方法が含まれる", () => {
        const text = allText()
        expect(text).toContain("AES-GCM")
        expect(text).toContain("7日")
        expect(text).toContain("45日")
        expect(text).toContain("一覧のページからいつでも削除")
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
