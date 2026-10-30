/**
 * アンケート画面の固定文言が両言語の辞書から取得できることを検証する。
 * 設定が所有するタイトル・説明・質問・選択肢を辞書へ混ぜないことも確認する。
 */
import { describe, expect, it } from "vitest"

import { en } from "@/lib/i18n/messages/en"
import { ja } from "@/lib/i18n/messages/ja"
import { createTranslator } from "@/lib/i18n/translate"

const expectedMessages = [
    {
        key: "survey.submit",
        ja: "送信する",
        en: "Submit",
    },
    {
        key: "survey.close",
        ja: "閉じる",
        en: "Close",
    },
    {
        key: "survey.irreversible",
        ja: "回答は匿名で保存されます。送信後に取り消し・訂正はできません。",
        en: "Your answers are saved anonymously. Once submitted, they cannot be withdrawn or changed.",
    },
    {
        key: "survey.incomplete",
        ja: "すべての質問に答えると送信できます。",
        en: "Answer all questions to submit.",
    },
    {
        key: "survey.declineHint",
        ja: "「回答しない」を選んで閉じると、回答は送信されません。次の起動でもう一度お聞きします。",
        en: 'If you select "Prefer not to answer" and close, your answers will not be sent. We will ask again the next time you open the app.',
    },
    {
        key: "survey.submitFailed",
        ja: "回答を送信できませんでした。もう一度送信してください。",
        en: "Your answers could not be sent. Please try submitting again.",
    },
] as const

describe("アンケート画面の辞書", () => {
    it.each(expectedMessages)("$key を両言語で取得できる", message => {
        expect(createTranslator("ja").t(message.key)).toBe(message.ja)
        expect(createTranslator("en").t(message.key)).toBe(message.en)
    })

    it.each([
        { locale: "ja", dictionary: ja },
        { locale: "en", dictionary: en },
    ])("$locale には固定文言6件だけを持つ", ({ dictionary }) => {
        const keys = Object.keys(dictionary).filter(key =>
            key.startsWith("survey."),
        )
        expect(keys.sort()).toEqual(
            expectedMessages.map(message => message.key).sort(),
        )
    })
})
