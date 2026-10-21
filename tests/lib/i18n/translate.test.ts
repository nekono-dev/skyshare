import { describe, expect, it } from "vitest"

import { createTranslator, interpolate } from "@/lib/i18n/translate"

describe("interpolate", () => {
    it("プレースホルダを置換する", () => {
        expect(interpolate("{a}-{b}", { a: 1, b: "x" })).toBe("1-x")
    })
    it("params に無い名前はそのまま残す", () => {
        expect(interpolate("{a}-{b}", { a: 1 })).toBe("1-{b}")
    })
    it("params 省略時はそのまま返す", () => {
        expect(interpolate("{a}")).toBe("{a}")
    })
})

describe("createTranslator", () => {
    it("t は言語ごとの文言を返す", () => {
        expect(createTranslator("ja").t("common.cancel")).toBe("キャンセル")
        expect(createTranslator("en").t("common.cancel")).toBe("Cancel")
    })
    it("[i18n-messages/AC-2] tn は英語で 0/1/2 の単複を切り替える", () => {
        const { tn } = createTranslator("en")
        expect(tn("common.itemCount", 0)).toBe("0 items")
        expect(tn("common.itemCount", 1)).toBe("1 item")
        expect(tn("common.itemCount", 2)).toBe("2 items")
    })
    it("tn は日本語で _other のみを使う", () => {
        const { tn } = createTranslator("ja")
        expect(tn("common.itemCount", 1)).toBe("1件")
        expect(tn("common.itemCount", 5)).toBe("5件")
    })
    it("辞書に無いキーはキー文字列を返す", () => {
        const { t } = createTranslator("en")
        expect(t("no.such.key" as never)).toBe("no.such.key")
    })
})
