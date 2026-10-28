import { describe, expect, it } from "vitest"

import {
    isRespondent,
    purgeAnswers,
    purgeRespondents,
    registerRespondent,
    saveAnswer,
} from "@/lib/survey/store"
import { createFakeD1 } from "../../helpers/fakeD1"
import type { D1Database } from "@/lib/schedule/cfTypes"

const input = (over: Partial<Parameters<typeof saveAnswer>[1]> = {}) => ({
    surveyId: "s1",
    didHash: "h1",
    answerId: "a1",
    answersJson: '{"q":"x"}',
    answeredOn: "2026-11-02",
    ...over,
})

const count = async (db: D1Database, table: string) => {
    const row = await db
        .prepare(`SELECT COUNT(*) AS n FROM ${table}`)
        .first<{ n: number }>()
    return row?.n ?? -1
}

describe("isRespondent / registerRespondent", () => {
    it("[survey-api/3.2][survey-api/3.3][survey-api/3.5] 確認は読み取り 1 回で、登録前は false・登録後は true", async () => {
        const db = createFakeD1()
        let before = db.queryCount
        expect(await isRespondent(db, "s1", "h1")).toBe(false)
        expect(db.queryCount - before).toBe(1)
        await registerRespondent(db, "s1", "h1")
        before = db.queryCount
        expect(await isRespondent(db, "s1", "h1")).toBe(true)
        expect(db.queryCount - before).toBe(1)
        expect(await isRespondent(db, "s2", "h1")).toBe(false)
        expect(await isRespondent(db, "s1", "h2")).toBe(false)
    })

    it("[survey-api/4.1][survey-api/4.2][survey-api/4.4] 登録は書き込み 1 回で、繰り返しても 1 行のまま", async () => {
        const db = createFakeD1()
        const before = db.queryCount
        await registerRespondent(db, "s1", "h1")
        expect(db.queryCount - before).toBe(1)
        await registerRespondent(db, "s1", "h1")
        expect(await count(db, "survey_respondents")).toBe(1)
    })
})

describe("saveAnswer", () => {
    it("[survey-api/6.1][survey-api/9.3] 1 回の呼び出しで両表に入り saved を返す", async () => {
        const db = createFakeD1()
        const before = db.queryCount
        expect(await saveAnswer(db, input())).toBe("saved")
        expect(db.queryCount - before).toBe(1)
        expect(await count(db, "survey_respondents")).toBe(1)
        expect(await count(db, "survey_answers")).toBe(1)
        const row = await db
            .prepare("SELECT * FROM survey_answers")
            .first<Record<string, unknown>>()
        expect(row).toEqual({
            survey_id: "s1",
            id: "a1",
            answers: '{"q":"x"}',
            answered_on: "2026-11-02",
        })
    })

    it("[survey-api/7.1][survey-api/7.2][survey-api/7.5] 2 回目は duplicate で回答が増えない", async () => {
        const db = createFakeD1()
        await saveAnswer(db, input())
        expect(await saveAnswer(db, input({ answerId: "a2" }))).toBe(
            "duplicate",
        )
        expect(await count(db, "survey_answers")).toBe(1)
    })

    it("[survey-api/7.3] 登録だけ済ませた後の保存は duplicate", async () => {
        const db = createFakeD1()
        await registerRespondent(db, "s1", "h1")
        expect(await saveAnswer(db, input())).toBe("duplicate")
        expect(await count(db, "survey_answers")).toBe(0)
    })

    it("[survey-api/7.4] 別の回答者の値・別のアンケートは保存される", async () => {
        const db = createFakeD1()
        await saveAnswer(db, input())
        expect(
            await saveAnswer(db, input({ didHash: "h2", answerId: "a2" })),
        ).toBe("saved")
        expect(
            await saveAnswer(db, input({ surveyId: "s2", answerId: "a3" })),
        ).toBe("saved")
        expect(await count(db, "survey_answers")).toBe(3)
    })

    it("[survey-api/6.7] 集合以外の失敗は投げ、どちらの表にも残らない", async () => {
        const db = createFakeD1()
        await saveAnswer(db, input())
        // 回答の主キー違反（集合は新規）。集合側の違反ではないので投げる
        await expect(saveAnswer(db, input({ didHash: "h2" }))).rejects.toThrow(
            /survey_answers/,
        )
        expect(await count(db, "survey_respondents")).toBe(1)
        expect(await count(db, "survey_answers")).toBe(1)
    })

    it("[survey-api/6.7] 無関係な失敗はそのまま投げる", async () => {
        const failing = {
            prepare: () => {
                throw new Error("D1_ERROR: network lost")
            },
            batch: async () => [],
        } as unknown as D1Database
        await expect(saveAnswer(failing, input())).rejects.toThrow(
            "network lost",
        )
    })
})

describe("purgeRespondents / purgeAnswers", () => {
    it("[survey-api/8.1][survey-api/8.2][survey-api/8.7] 対象のアンケートだけを消し、削除済みでは 0 を返す", async () => {
        const db = createFakeD1()
        await saveAnswer(db, input())
        await saveAnswer(db, input({ didHash: "h2", answerId: "a2" }))
        await saveAnswer(db, input({ surveyId: "s2", answerId: "a3" }))

        expect(await purgeRespondents(db, "s1")).toBe(2)
        expect(await count(db, "survey_respondents")).toBe(1)
        expect(await count(db, "survey_answers")).toBe(3)
        expect(await purgeRespondents(db, "s1")).toBe(0)

        expect(await purgeAnswers(db, "s1")).toBe(2)
        expect(await count(db, "survey_answers")).toBe(1)
        expect(await purgeAnswers(db, "s1")).toBe(0)
    })
})
