/**
 * プライバシーポリシーの組み立て結果に、アンケートの扱い・公表・削除時期と、整理した記述が過不足なく書かれていることを確かめる。
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

/** 指定した節の箇条書きの項目（文字列だけ）を返す */
const policyItems = (locale: Locale, sectionId: string): string[] =>
    buildPrivacyPolicy(createTranslator(locale).t, siteConfig)
        .filter(section => section.id === sectionId)
        .flatMap(section => section.blocks)
        .flatMap(block =>
            block.kind === "list"
                ? block.items.filter(
                      (item): item is string => typeof item === "string",
                  )
                : [],
        )

describe("プライバシーポリシーのアンケート結果の記述", () => {
    it("日本語: 利用目的の 2 項目で、集計して改善に使うことと、回答の割合を公開することがあることを書く", () => {
        const items = policyItems("ja", "purpose")

        expect(items).toContain(
            "アンケート結果は集計し、サービス品質の向上及び改善に使います。",
        )
        expect(items).toContain(
            "アンケート結果は回答の割合を公開することがあります。",
        )
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

    it("英語: 利用目的の 2 項目で、集計して改善に使うことと、回答の割合を公開することがあることを書く", () => {
        const items = policyItems("en", "purpose")

        expect(items).toContain(
            "We aggregate survey results and use them to improve the quality of the Service.",
        )
        expect(items).toContain(
            "We may publish survey results as the percentage of answers.",
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

describe("プライバシーポリシーの簡潔な記述", () => {
    it("日本語: 回答内容は回答したアカウントと結びつけず保存すると書き、実装の詳細を書かない", () => {
        const text = policyText("ja")

        expect(text).toContain(
            "アンケートの回答内容は、回答したアカウントとは結びつけず保存します。",
        )
        expect(text).not.toContain("ハッシュ")
        expect(text).not.toContain("localStorage")
    })

    it("英語: 回答はアカウントと結びつけず保存すると書き、実装の詳細を書かない", () => {
        const text = policyText("en")

        expect(text).toContain(
            "Survey answers are saved without being linked to the account that submitted them.",
        )
        expect(text).not.toMatch(/hash|localStorage/i)
    })

    it("日本語: 冗長な記述（通常の投稿の保管・重複判定用ハッシュの削除・パスワードの預け入れ）を持たない", () => {
        const text = policyText("ja")

        expect(text).not.toContain("通常の投稿や下書きは")
        expect(text).not.toContain("重複判定用")
        expect(text).not.toContain("パスワードを本サービスに預ける必要")
        expect(text).not.toContain("端末の記録")
    })

    it("英語: 冗長な記述を持たない", () => {
        const text = policyText("en")

        expect(text).not.toContain("Regular posts and drafts")
        expect(text).not.toMatch(/duplicate detection/i)
        expect(text).not.toContain("give your password")
        expect(text).not.toContain("Device records")
    })

    it("日本語: 目的に重複回答の防止や、公開しない旨の長い文を残さない", () => {
        const text = policyText("ja")

        expect(text).not.toContain("重複回答の防止")
        expect(text).not.toContain("回答者の数は公開しません")
    })

    it("英語: 目的に、公開しない旨の長い文を残さない", () => {
        const text = policyText("en")

        expect(text).not.toContain("only as the percentage for each choice")
        expect(text).not.toMatch(/number of respondents/i)
    })

    it("日本語: 不具合の報告・機能の提案は「バグ報告または機能提案内容」とし、掲載先を重ねて書かない", () => {
        const text = policyText("ja")

        expect(text).toContain("バグ報告または機能提案内容")
        expect(text).not.toContain("公開の Issue として掲載すること")
    })

    it("日本語: 認可の情報は無効になったとき・30日の未使用のときに削除し、識別子を残す記述を持たない", () => {
        const text = policyText("ja")

        expect(text).toContain(
            "予約用の認可の情報は、許可が無効になったとき、または予約がないまま30日使われないときに削除します。",
        )
        expect(text).not.toContain("180日")
        expect(text).not.toContain("再度の許可をご案内")
    })

    it("英語: 認可の情報は無効になったとき・30日の未使用のときに削除し、識別子を残す記述を持たない", () => {
        const text = policyText("en")

        expect(text).toContain(
            "Authorization for scheduled posts is deleted when the permission becomes invalid, or after 30 days of no use with nothing scheduled.",
        )
        expect(text).not.toContain("180 days")
        expect(text).not.toContain("grant it again")
    })
})
