/** 回答の補正・完了・辞退判定と、匿名の送信本文の契約を確認する。 */
import { describe, expect, it } from "vitest"
import type { Survey, SurveyQuestion } from "@/lib/survey/definition"
import {
    changeSelection,
    draftHasDecline,
    emptyDraft,
    isDraftComplete,
    questionHasDecline,
    toAnswers,
} from "@/lib/survey/answerDraft"

const text = { ja: "質問", en: "Question" }
const single: SurveyQuestion = {
    id: "single",
    kind: "single",
    title: text,
    options: [
        { id: "decline", label: text, decline: false },
        { id: "ordinary", label: text },
        { id: "skip-single", label: text, decline: true },
    ],
}
const multiple: SurveyQuestion = {
    id: "multiple",
    kind: "multiple",
    title: text,
    maxSelect: 2,
    options: [
        { id: "b", label: text },
        { id: "a", label: text },
        { id: "c", label: text },
        { id: "skip-multiple", label: text, decline: true },
    ],
}
const survey: Survey = {
    id: "survey-2026",
    title: text,
    opensAt: "2026-01-01T00:00:00Z",
    closesAt: "2027-01-01T00:00:00Z",
    questions: [single, multiple],
}

describe("SurveyAnswerDraft", () => {
    it("[3.6] 全質問を未選択で作り、配列と呼出し間の状態を共有しない", () => {
        const draft = emptyDraft(survey)
        expect(draft).toEqual({ single: [], multiple: [] })
        draft.single.push("ordinary")
        expect(draft.multiple).toEqual([])
        expect(emptyDraft(survey)).toEqual({ single: [], multiple: [] })
    })

    it.each([
        { ids: [] },
        { ids: ["ordinary"] },
        { ids: ["skip-single"] },
        { ids: ["ordinary", "decline"] },
    ])(
        "[3.4] 単一選択は部品のnext $ids をそのまま採り、入力を変更しない",
        ({ ids }) => {
            const next = Object.freeze(ids)
            const current = Object.freeze(["decline"])
            const result = changeSelection(single, current, next)
            expect(result).toEqual(next)
            expect(result).not.toBe(next)
            expect(current).toEqual(["decline"])
        },
    )

    it("[3.4] 上限ちょうどの複数選択を保ち、入力を変更しない", () => {
        const current = Object.freeze(["a"])
        const next = Object.freeze(["a", "b"])
        const result = changeSelection(multiple, current, next)
        expect(result).toEqual(["a", "b"])
        expect(result).not.toBe(next)
        expect(current).toEqual(["a"])
    })

    it("[5.2] 通常選択から辞退が新たに含まれたら辞退1件だけにする", () => {
        expect(
            changeSelection(multiple, ["a", "b"], ["a", "b", "skip-multiple"]),
        ).toEqual(["skip-multiple"])
    })

    it("[5.2] 辞退選択中に通常選択が加わったら辞退を外す", () => {
        expect(
            changeSelection(
                multiple,
                ["skip-multiple"],
                ["skip-multiple", "a", "b"],
            ),
        ).toEqual(["a", "b"])
        expect(changeSelection(multiple, ["skip-multiple"], ["b"])).toEqual([
            "b",
        ])
    })

    it("[5.2] 辞退の維持・解除と通常選択の解除を保つ", () => {
        expect(
            changeSelection(multiple, ["skip-multiple"], ["skip-multiple"]),
        ).toEqual(["skip-multiple"])
        expect(changeSelection(multiple, ["skip-multiple"], [])).toEqual([])
        expect(changeSelection(multiple, ["a", "b"], ["b"])).toEqual(["b"])
    })

    it("[5.2] 辞退の印のない複数質問はIDがdeclineでも通常の選択として保つ", () => {
        const question: SurveyQuestion = {
            ...single,
            kind: "multiple",
            options: single.options.filter(option => option.decline !== true),
        }
        expect(
            changeSelection(question, ["ordinary"], ["ordinary", "decline"]),
        ).toEqual(["ordinary", "decline"])
    })

    it("[3.6] 未選択や質問キーの欠落は未完了、全問1件以上なら辞退を含んでも完了", () => {
        expect(isDraftComplete(survey, emptyDraft(survey))).toBe(false)
        expect(isDraftComplete(survey, { single: ["ordinary"] })).toBe(false)
        expect(isDraftComplete(survey, { single: [], multiple: ["a"] })).toBe(
            false,
        )
        expect(
            isDraftComplete(survey, {
                single: ["ordinary"],
                multiple: ["a", "b"],
            }),
        ).toBe(true)
        expect(
            isDraftComplete(survey, {
                single: ["skip-single"],
                multiple: ["skip-multiple"],
            }),
        ).toBe(true)
    })

    it("[5.3] どちらの種類の質問でもdecline印だけで辞退を検出する", () => {
        expect(draftHasDecline(survey, emptyDraft(survey))).toBe(false)
        expect(
            draftHasDecline(survey, { single: ["decline"], multiple: ["a"] }),
        ).toBe(false)
        expect(
            draftHasDecline(survey, {
                single: ["skip-single"],
                multiple: ["a"],
            }),
        ).toBe(true)
        expect(
            draftHasDecline(survey, {
                single: ["ordinary"],
                multiple: ["skip-multiple"],
            }),
        ).toBe(true)
    })

    it("[4.1, 4.8] 単一は文字列、複数は設定順の配列とし、質問以外のキーを送信本文へ混ぜない", () => {
        const draft = {
            single: ["ordinary"],
            multiple: ["a", "b"],
            did: ["did:plc:example"],
            answeredAt: ["2026-10-28T00:00:00Z"],
        }
        const result = toAnswers(survey, draft)
        expect(result).toEqual({ single: "ordinary", multiple: ["b", "a"] })
        expect(draft.multiple).toEqual(["a", "b"])
        expect(result.multiple).not.toBe(draft.multiple)
        expect(survey.questions[1].options.map(option => option.id)).toEqual([
            "b",
            "a",
            "c",
            "skip-multiple",
        ])
    })
})

describe("questionHasDecline（質問ごとの辞退判定）", () => {
    it("[5.3] この質問の選択に辞退があればtrue、他の質問の辞退は見ない", () => {
        expect(
            questionHasDecline(single, {
                single: ["skip-single"],
                multiple: [],
            }),
        ).toBe(true)
        expect(
            questionHasDecline(multiple, {
                single: ["skip-single"],
                multiple: ["a", "b"],
            }),
        ).toBe(false)
    })

    it("[5.3] 複数の質問で辞退を選んだ質問だけtrueになる", () => {
        const draft = { single: [], multiple: ["skip-multiple"] }
        expect(questionHasDecline(single, draft)).toBe(false)
        expect(questionHasDecline(multiple, draft)).toBe(true)
    })

    it("辞退の印がない選択肢や、キーがない質問はfalse", () => {
        expect(questionHasDecline(single, { single: ["ordinary"] })).toBe(false)
        expect(questionHasDecline(single, {})).toBe(false)
    })
})
