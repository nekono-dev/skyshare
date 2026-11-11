/**
 * Verifies translation output for placeholders and plural forms.
 */
import { describe, expect, it } from "vitest"
import { createTranslator } from "@/lib/i18n/translate"

describe("translation output", () => {
    it("Japanese: replaces placeholders and selects singular or plural forms", () => {
        const tr = createTranslator("ja")
        expect(tr.t("common.pageStatus", { page: 3 })).toBe("ページ 3")
        expect(tr.tn("common.itemCount", 1)).toBe("1件")
        expect(tr.tn("common.itemCount", 5)).toBe("5件")
    })

    it("English: replaces placeholders and selects singular or plural forms", () => {
        const tr = createTranslator("en")
        expect(tr.t("common.pageStatus", { page: 3 })).toBe("Page 3")
        expect(tr.tn("common.itemCount", 1)).toBe("1 item")
        expect(tr.tn("common.itemCount", 5)).toBe("5 items")
    })

    it("returns text without placeholders unchanged", () => {
        expect(createTranslator("ja").t("account.login.submit")).toBe(
            "ログイン",
        )
        expect(createTranslator("en").t("account.login.submit")).toBe("Log in")
    })

    it("preserves placeholders when parameters are missing", () => {
        // パラメータ不足は型で拒否される。実行時の出力（プレースホルダの残存）だけを固定する
        // @ts-expect-error プレースホルダの欠落を意図的に渡す
        expect(createTranslator("ja").t("common.pageStatus")).toBe(
            "ページ {page}",
        )
        // @ts-expect-error プレースホルダの欠落を意図的に渡す
        expect(createTranslator("en").t("common.pageStatus")).toBe(
            "Page {page}",
        )
    })
})
