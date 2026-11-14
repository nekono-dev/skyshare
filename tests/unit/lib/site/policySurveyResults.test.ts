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
    })

    it("英語: 冗長な記述を持たない", () => {
        const text = policyText("en")

        expect(text).not.toContain("Regular posts and drafts")
        expect(text).not.toMatch(/duplicate detection/i)
        expect(text).not.toContain("give your password")
    })

    it("日本語: 目的は「サービス品質の向上及び改善」で、公表の範囲を保つ", () => {
        const text = policyText("ja")

        expect(text).toContain(
            "アンケート回答を集計し、サービス品質の向上及び改善に使います。",
        )
        expect(text).not.toContain("重複回答の防止")
    })

    it("日本語: 不具合の報告・機能の提案は「バグ報告または機能提案内容」とし、掲載先を重ねて書かない", () => {
        const text = policyText("ja")

        expect(text).toContain("バグ報告または機能提案内容")
        expect(text).not.toContain("公開の Issue として掲載すること")
    })

    it("日本語: 許可が無効になった後に何が残るかを、認可の情報との違いで説明する", () => {
        const text = policyText("ja")

        expect(text).toContain(
            "許可が無効になったとき（Bluesky で許可を取り消した場合など）も、認可の情報は削除します。",
        )
        expect(text).toContain(
            "アカウントの識別子と「許可が無効である」旨などの情報を残し、最後に使ってから180日を過ぎた後に削除します。",
        )
    })

    it("英語: 許可が無効になった後に何が残るかを、認可の情報との違いで説明する", () => {
        const text = policyText("en")

        expect(text).toContain(
            "When the permission becomes invalid (for example, because you revoked it on Bluesky), the authorization itself is also deleted.",
        )
        expect(text).toContain(
            "the account identifier and information such as the fact that the permission is invalid, and delete them once 180 days have passed since you last used it",
        )
    })
})
