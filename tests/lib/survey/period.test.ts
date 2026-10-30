import { describe, expect, it } from "vitest"

import type { Survey, SurveyConfig } from "@/lib/survey/definition"
import {
    currentSurvey,
    retentionDeadlines,
    retentionExpired,
} from "@/lib/survey/period"

const makeSurvey = (id: string, opensAt: string, closesAt: string): Survey => ({
    id,
    opensAt,
    closesAt,
    title: { ja: "題", en: "title" },
    questions: [],
})

const config: SurveyConfig = {
    surveys: [
        makeSurvey(
            "a",
            "2026-11-01T00:00:00+09:00",
            "2026-12-01T00:00:00+09:00",
        ),
        makeSurvey(
            "b",
            "2026-12-01T00:00:00+09:00",
            "2027-01-01T00:00:00+09:00",
        ),
    ],
}

describe("currentSurvey", () => {
    it("[survey-definition/3.4] 開始ちょうどで現在のアンケートになる", () => {
        expect(
            currentSurvey(config, new Date("2026-11-01T00:00:00+09:00"))?.id,
        ).toBe("a")
    })

    it("[survey-definition/3.4] 終了の直前までは現在のアンケートで、終了ちょうどは次の開始のアンケートになる", () => {
        expect(
            currentSurvey(config, new Date("2026-11-30T23:59:59.999+09:00"))
                ?.id,
        ).toBe("a")
        expect(
            currentSurvey(config, new Date("2026-12-01T00:00:00+09:00"))?.id,
        ).toBe("b")
    })

    it("[survey-definition/3.5] 開始の直前は無い", () => {
        expect(
            currentSurvey(config, new Date("2026-10-31T23:59:59.999+09:00")),
        ).toBeUndefined()
    })

    it("[survey-definition/3.5] 最後の終了ちょうどと以後は無い", () => {
        expect(
            currentSurvey(config, new Date("2027-01-01T00:00:00+09:00")),
        ).toBeUndefined()
        expect(
            currentSurvey(config, new Date("2027-06-01T00:00:00+09:00")),
        ).toBeUndefined()
    })

    it("[survey-definition/3.5] アンケートが無い設定では無い", () => {
        expect(currentSurvey({ surveys: [] }, new Date())).toBeUndefined()
    })
})

describe("retentionDeadlines", () => {
    const answersUntil = (closesAt: string) =>
        retentionDeadlines(
            makeSurvey("x", "2020-01-01T00:00:00+09:00", closesAt),
        ).answersUntil.toISOString()

    it("[survey-definition/3.6] 回答済みの集合の期限は終了時刻", () => {
        const d = retentionDeadlines(config.surveys[0])
        expect(d.respondentsUntil.toISOString()).toBe(
            new Date("2026-12-01T00:00:00+09:00").toISOString(),
        )
    })

    it("[survey-definition/3.7] 通常の月は翌月の同じ日", () => {
        expect(answersUntil("2026-12-01T00:00:00+09:00")).toBe(
            new Date("2027-01-01T00:00:00+09:00").toISOString(),
        )
        expect(answersUntil("2026-11-15T12:34:56+09:00")).toBe(
            new Date("2026-12-15T12:34:56+09:00").toISOString(),
        )
    })

    it("[survey-definition/3.7] 1/31 は平年で 2/28、うるう年で 2/29", () => {
        expect(answersUntil("2027-01-31T00:00:00+09:00")).toBe(
            new Date("2027-02-28T00:00:00+09:00").toISOString(),
        )
        expect(answersUntil("2028-01-31T00:00:00+09:00")).toBe(
            new Date("2028-02-29T00:00:00+09:00").toISOString(),
        )
    })

    it("[survey-definition/3.7] うるう年の 1/29 は 2/29、平年の 1/29 は 2/28", () => {
        expect(answersUntil("2028-01-29T00:00:00+09:00")).toBe(
            new Date("2028-02-29T00:00:00+09:00").toISOString(),
        )
        expect(answersUntil("2027-01-29T00:00:00+09:00")).toBe(
            new Date("2027-02-28T00:00:00+09:00").toISOString(),
        )
    })

    it("[survey-definition/3.7] 12 月は翌年 1 月に繰り上がる", () => {
        expect(answersUntil("2026-12-31T00:00:00+09:00")).toBe(
            new Date("2027-01-31T00:00:00+09:00").toISOString(),
        )
    })

    it("[survey-definition/3.7] 日本標準時の暦で数える（UTC では 1/30 でも JST では 1/31）", () => {
        expect(answersUntil("2027-01-30T15:00:00Z")).toBe(
            new Date("2027-02-28T00:00:00+09:00").toISOString(),
        )
    })

    it("[survey-definition/3.7] 月末が 31 日の 3/31 は 4/30", () => {
        expect(answersUntil("2026-03-31T00:00:00+09:00")).toBe(
            new Date("2026-04-30T00:00:00+09:00").toISOString(),
        )
    })
})

describe("retentionExpired", () => {
    const survey = makeSurvey(
        "x",
        "2026-11-01T00:00:00+09:00",
        "2027-01-31T00:00:00+09:00",
    )

    it("[survey-definition/3.8] 期限の直前は過ぎていない", () => {
        expect(
            retentionExpired(survey, new Date("2027-01-30T23:59:59.999+09:00")),
        ).toEqual({
            respondents: false,
            answers: false,
        })
        expect(
            retentionExpired(survey, new Date("2027-02-27T23:59:59.999+09:00")),
        ).toEqual({
            respondents: true,
            answers: false,
        })
    })

    it("[survey-definition/3.8] 期限ちょうどは過ぎたものとする", () => {
        expect(
            retentionExpired(survey, new Date("2027-01-31T00:00:00+09:00"))
                .respondents,
        ).toBe(true)
        expect(
            retentionExpired(survey, new Date("2027-02-28T00:00:00+09:00"))
                .answers,
        ).toBe(true)
    })

    it("[survey-definition/3.8] 期限の直後は過ぎている", () => {
        expect(
            retentionExpired(survey, new Date("2027-02-28T00:00:00.001+09:00")),
        ).toEqual({
            respondents: true,
            answers: true,
        })
    })
})
