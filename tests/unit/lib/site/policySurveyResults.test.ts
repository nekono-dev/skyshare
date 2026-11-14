/**
 * プライバシーポリシーの組み立て結果に、収集する情報・共有・保持の整理した記述が、日本語・英語で過不足なく書かれていることを確かめる。
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

/** 指定した節のブロック（種類と本文）を返す */
const policyBlocks = (locale: Locale, sectionId: string) =>
    buildPrivacyPolicy(createTranslator(locale).t, siteConfig)
        .filter(section => section.id === sectionId)
        .flatMap(section => section.blocks)

/** アクセス解析を使う設定の組み立て結果（解析の項目の記載を確かめる） */
const itemsWithAnalytics = (locale: Locale, sectionId: string): string[] =>
    buildPrivacyPolicy(createTranslator(locale).t, {
        ...siteConfig,
        analyticsId: "G-TEST",
    })
        .filter(section => section.id === sectionId)
        .flatMap(section => section.blocks)
        .flatMap(block =>
            block.kind === "list"
                ? block.items.filter(
                      (item): item is string => typeof item === "string",
                  )
                : [],
        )

describe("収集する情報の記述", () => {
    it("日本語: 簡潔な記述に整理している", () => {
        const items = itemsWithAnalytics("ja", "collected")

        expect(items).toContain("Blueskyアカウントに関する認証情報")
        expect(items).toContain(
            "予約投稿機能有効化時は、添付画像を含む投稿内容およびBlueskyアカウントに関する認証情報",
        )
        expect(items).toContain(
            "ホスティングプロバイダが収集するIPアドレスやブラウザ情報",
        )
        expect(items).toContain("Google アナリティクスによる利用状況")
        expect(items).toContain(
            "不具合の報告・機能の提案フォーム利用時は、入力情報及びアカウント識別情報、利用者端末情報および本サービスに関する情報",
        )
        expect(items).toContain(
            "アンケート回答時は、アンケート回答内容と重複回答防止の為の識別子",
        )
    })

    it("英語: 同じ内容を整理している", () => {
        const items = itemsWithAnalytics("en", "collected")

        expect(items).toContain("Credentials for your Bluesky account")
        expect(items).toContain(
            "When scheduled posts are enabled: the post content, including attached images, and credentials for your Bluesky account",
        )
        expect(items).toContain(
            "Your IP address and browser information collected by the hosting provider",
        )
        expect(items).toContain("Usage data collected by Google Analytics")
        expect(items).toContain(
            "When you use the bug report and feature request form: the information you enter, account identification information, your device information, and information about the Service",
        )
        expect(items).toContain(
            "When you answer a survey: your answers and an identifier used to prevent duplicate responses",
        )
    })

    it("日本語: 共有・セキュリティの用語を「ホスティングプロバイダ」「本サービス」「認証情報」に揃える", () => {
        const text = policyText("ja")

        expect(policyItems("ja", "external")).toContain(
            "本サービスの配信とデータの保管を委託するホスティングプロバイダでの取り扱い",
        )
        expect(text).not.toContain("Cloudflare")
        expect(text).not.toContain("本アプリケーション")
        expect(text).not.toContain("認可の情報")
    })

    it("英語: 共有・セキュリティの用語を揃える", () => {
        const text = policyText("en")

        expect(policyItems("en", "external")).toContain(
            "Handling by the hosting provider, which we use to deliver the Service and store its data",
        )
        expect(text).not.toContain("Cloudflare")
        expect(text).not.toContain("this application")
        expect(text).not.toMatch(/authorization for scheduled/i)
    })

    it("日本語: 旧文面の細かい説明を残さない", () => {
        const text = policyText("ja")

        expect(text).not.toContain("パスワードは保存しません")
        expect(text).not.toContain(
            "本サービスを配信する Cloudflare が通信の処理",
        )
        expect(text).not.toContain("閲覧したページ・端末やブラウザの種類")
        expect(text).not.toContain("実行に必要なアカウントの識別子")
        expect(text).not.toContain("端末と Skyshare の版の情報")
        expect(text).not.toContain("結びつけず保存します")
        expect(text).not.toContain("ハッシュ")
        expect(text).not.toContain("localStorage")
    })

    it("英語: 旧文面の細かい説明を残さない", () => {
        const text = policyText("en")

        expect(text).not.toContain("the password is not stored")
        expect(text).not.toContain("handled by Cloudflare")
        expect(text).not.toContain("pages viewed, device and browser type")
        expect(text).not.toContain("without being linked to the account")
        expect(text).not.toMatch(/hash|localStorage/i)
    })
})

describe("セキュリティの記述", () => {
    it("日本語: 箇条書きにせず、1 つの文で書く", () => {
        expect(policyBlocks("ja", "security")).toEqual([
            {
                kind: "text",
                text: "利用者の情報を守るため、通信は暗号化され、本サービスへ保存される認証情報は暗号化して保管されます。",
            },
        ])
        expect(policyText("ja")).not.toContain("情報を扱うのは運営者に限ります")
    })

    it("英語: 箇条書きにせず、1 つの文で書く", () => {
        expect(policyBlocks("en", "security")).toEqual([
            {
                kind: "text",
                text: "To protect your information, communication is encrypted, and credentials saved in the Service are stored encrypted.",
            },
        ])
        expect(policyText("en")).not.toContain("Only the Operator handles")
    })
})

describe("アンケートの記述", () => {
    it("日本語: 利用目的にアンケートの項目を持たず、共有の最後に結果の公表を書く", () => {
        const purpose = policyItems("ja", "purpose")
        const sharing = policyItems("ja", "external")

        expect(purpose.join("\n")).not.toContain("アンケート")
        expect(sharing.at(-1)).toBe("アンケートの結果公表")
    })

    it("英語: 利用目的にアンケートの項目を持たず、共有の最後に結果の公表を書く", () => {
        const purpose = policyItems("en", "purpose")
        const sharing = policyItems("en", "external")

        expect(purpose.join("\n")).not.toMatch(/survey/i)
        expect(sharing.at(-1)).toBe("Publication of survey results")
    })

    it("日本語: 匿名であることなどの説明や、公開しない旨の長い文を書かない", () => {
        const text = policyText("ja")

        expect(text).not.toContain("匿名")
        expect(text).not.toContain("回答者の数は公開しません")
        expect(text).not.toContain("アンケート結果は回答の割合を公開すること")
        expect(text).not.toContain("重複回答の防止")
    })

    it("英語: 匿名であることなどの説明や、公開しない旨の長い文を書かない", () => {
        const text = policyText("en")

        expect(text).not.toMatch(/anonymous/i)
        expect(text).not.toMatch(/number of respondents/i)
        expect(text).not.toContain("percentage of answers")
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

describe("保持期間と権利の記述", () => {
    it("日本語: 予約の認証情報の削除、通信の情報の保持、予約の操作を整理している", () => {
        const retention = policyItems("ja", "retention")
        const text = policyText("ja")

        expect(retention).toContain(
            "予約投稿機能有効化時は、認証情報が無効になった、または機能が30日使われていない場合に削除されます。",
        )
        expect(retention).toContain(
            "通信の情報は、ホスティングプロバイダが定める期間に限り保持されます。",
        )
        expect(text).toContain(
            "予約投稿の変更・取消・削除は投稿フォームの「下書き・予約」から行えます。予約機能を無効化した場合、予約内容およびBlueskyアカウントに関する認証情報は削除されます。",
        )
        expect(text).not.toContain("180日")
        expect(text).not.toContain("再度の許可をご案内")
        expect(text).not.toContain("Bluesky での許可も取り消します")
    })

    it("英語: 同じ内容を整理している", () => {
        const retention = policyItems("en", "retention")
        const text = policyText("en")

        expect(retention).toContain(
            "When scheduled posts are enabled, credentials are deleted if they become invalid or the feature goes unused for 30 days.",
        )
        expect(retention).toContain(
            "Traffic information is kept only for the period set by the hosting provider.",
        )
        expect(text).toContain(
            "You can change, cancel, or delete scheduled posts from “Drafts & scheduled” in the post form. If you turn off scheduled posts, the scheduled post contents and credentials for your Bluesky account are deleted.",
        )
        expect(text).not.toContain("180 days")
        expect(text).not.toContain("grant it again")
        expect(text).not.toContain("revokes the permission")
    })
})

describe("プライバシーポリシーの簡潔な記述", () => {
    it("日本語: 冗長な記述（通常の投稿の保管・重複判定用ハッシュの削除・パスワードの預け入れ・端末の記録）を持たない", () => {
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

    it("日本語: 不具合の報告・機能の提案は「バグ報告または機能提案内容」とし、掲載先を重ねて書かない", () => {
        const text = policyText("ja")

        expect(text).toContain("バグ報告または機能提案内容")
        expect(text).not.toContain("公開の Issue として掲載すること")
    })
})
