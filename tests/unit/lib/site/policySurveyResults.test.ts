/**
 * プライバシーポリシーの組み立て結果に、アンケート結果の公表と回答の削除時期が書かれていることを確かめる。
 */
import { describe, expect, it } from "vitest"
import { createTranslator } from "@/lib/i18n/translate"
import { buildPrivacyPolicy } from "@/lib/site/policySections"
import { siteConfig } from "@/lib/site/siteConfig"
import type { Locale } from "@/lib/i18n/locale"

/** 組み立てた全節の本文を、1 つの文字列に連ねる */
const policyText = (locale: Locale): string =>
    buildPrivacyPolicy(createTranslator(locale).t, siteConfig)
        .flatMap(section => section.blocks)
        .flatMap(block =>
            block.kind === "text"
                ? [block.text]
                : block.items.map(item =>
                      typeof item === "string"
                          ? item
                          : `${item.label} ${item.value}`,
                  ),
        )
        .join("\n")

describe("プライバシーポリシーのアンケート結果の記述", () => {
    it("日本語: 割合だけの公表と、個別の回答・回答者の数を公開しないことを書く", () => {
        const text = policyText("ja")

        expect(text).toContain("選択肢ごとの割合だけを公開することがあります")
        expect(text).toContain("個別の回答や回答者の数は公開しません")
    })

    it("日本語: 回答は集計の結果を保存した時点で削除し、1 か月後の記述を残さない", () => {
        const text = policyText("ja")

        expect(text).toContain("終了後に集計の結果を保存した時点で削除します")
        const answerLine = text
            .split("\n")
            .filter(line => line.includes("アンケートの回答"))
        expect(answerLine.length).toBeGreaterThan(0)
        expect(answerLine.join("\n")).not.toMatch(/か月|ヶ月|1か月/)
        expect(text).not.toContain("終了から1か月後")
    })

    it("英語: 割合だけの公表と、個別の回答・回答者の数を公開しないことを書く", () => {
        const text = policyText("en")

        expect(text).toContain("only as the percentage for each choice")
        expect(text).toContain(
            "never publish individual responses or the number of respondents",
        )
    })

    it("英語: 回答は集計の結果を保存した時点で削除し、1 か月後の記述を残さない", () => {
        const text = policyText("en")

        expect(text).toContain("aggregated result has been saved")
        // 無関係な項目（予約用の認可の情報など）の期間と区別するため、アンケートの回答の行だけを調べる
        const answerLine = text
            .split("\n")
            .filter(line => /survey answers/i.test(line))
        expect(answerLine.length).toBeGreaterThan(0)
        expect(answerLine.join("\n")).not.toMatch(/month|days/i)
    })
})
