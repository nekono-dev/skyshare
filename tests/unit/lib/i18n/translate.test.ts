/**
 * 翻訳の出力の特性化テスト（src-cycles 1.1・要件 1.2）。
 *
 * 責務と処理概要:
 * - 日本語と英語で、プレースホルダの有無・複数形・欠けたプレースホルダの出力を固定する。
 * - 辞書の型の移動の前後で、翻訳の出力が変わらないことを確かめる。
 */
import { describe, expect, it } from "vitest"
import { createTranslator } from "@/lib/i18n/translate"

describe("翻訳の出力（特性化）", () => {
    it("日本語: プレースホルダを置換し、複数形の単数と複数を選ぶ", () => {
        const tr = createTranslator("ja")
        expect(tr.t("common.pageStatus", { page: 3 })).toBe("ページ 3")
        expect(tr.tn("common.itemCount", 1)).toBe("1件")
        expect(tr.tn("common.itemCount", 5)).toBe("5件")
    })

    it("英語: プレースホルダを置換し、複数形の単数と複数を選ぶ", () => {
        const tr = createTranslator("en")
        expect(tr.t("common.pageStatus", { page: 3 })).toBe("Page 3")
        expect(tr.tn("common.itemCount", 1)).toBe("1 item")
        expect(tr.tn("common.itemCount", 5)).toBe("5 items")
    })

    it("プレースホルダを持たない文言はそのまま返す", () => {
        expect(createTranslator("ja").t("account.login.submit")).toBe(
            "ログイン",
        )
        expect(createTranslator("en").t("account.login.submit")).toBe("Log in")
    })

    it("パラメータが無い場合、プレースホルダをそのまま残す", () => {
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
