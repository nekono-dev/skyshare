/**
 * フォームの入力の状態と送信の本文の組み立ての検証。
 *
 * 責務と処理概要:
 * - 種別ごとの送信の可否（必須の項目・上限）と、種別に合う項目だけを載せた本文を検証する。
 */
import { describe, expect, it } from "vitest"
import {
    emptyDraft,
    isDraftSubmittable,
    toFeedbackRequest,
} from "@/lib/feedback/feedbackDraft"

const env = {
    os: "iOS 18.1",
    browser: "Safari 18.1",
    userAgent: "UA",
    standalone: true,
}
const build = { version: "2.0.0", commit: null }

describe("isDraftSubmittable", () => {
    it("[feedback-form/2.6] 必須の項目が空なら送れず、埋めると送れ、上限を超えると送れない", () => {
        const bug = emptyDraft("bug")
        expect(isDraftSubmittable(bug)).toBe(false)
        const filled = {
            ...bug,
            title: "落ちる",
            steps: "送信した",
            reproducibility: "always" as const,
        }
        expect(isDraftSubmittable(filled)).toBe(true)
        expect(isDraftSubmittable({ ...filled, title: "  " })).toBe(false)
        expect(isDraftSubmittable({ ...filled, reproducibility: null })).toBe(
            false,
        )
        expect(isDraftSubmittable({ ...filled, title: "あ".repeat(101) })).toBe(
            false,
        )
        expect(isDraftSubmittable({ ...filled, steps: "a".repeat(2001) })).toBe(
            false,
        )

        const enhancement = {
            ...emptyDraft("enhancement"),
            title: "並べ替え",
            description: "日付順にしたい",
        }
        expect(isDraftSubmittable(enhancement)).toBe(true)
        expect(
            isDraftSubmittable({
                ...enhancement,
                technicalNotes: "a".repeat(2001),
            }),
        ).toBe(false)
    })
})

describe("toFeedbackRequest", () => {
    it("[feedback-form/2.1,2.4] 種別に合う項目だけを載せ、他の種別の入力は送らない", () => {
        const draft = {
            ...emptyDraft("enhancement"),
            title: "並べ替え",
            description: "日付順にしたい",
            steps: "不具合の欄に残った入力",
            technicalNotes: "  ",
        }
        expect(toFeedbackRequest(draft, env, build)).toEqual({
            kind: "enhancement",
            title: "並べ替え",
            description: "日付順にしたい",
            environment: {
                ...env,
                version: "2.0.0",
                commit: "",
            },
        })

        const bug = toFeedbackRequest(
            {
                ...draft,
                kind: "bug",
                steps: "送信した",
                reproducibility: "sometimes",
            },
            env,
            { version: "2.0.0", commit: "a".repeat(40) },
        )
        expect(bug).toMatchObject({
            kind: "bug",
            steps: "送信した",
            reproducibility: "sometimes",
        })
        expect(bug).not.toHaveProperty("description")
        expect(bug.environment.commit).toBe("a".repeat(40))
    })
})
