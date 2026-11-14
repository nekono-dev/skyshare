/**
 * 公開結果の時期・割合・最大選択肢の表示規則を確認する。
 */
import { describe, expect, it } from "vitest"
import {
    formatPercent,
    formatSurveyPeriod,
    topOptionIds,
} from "@/lib/survey/publicResults/presentation"

describe("formatSurveyPeriod", () => {
    it("formats same-year periods without the end year", () => {
        expect(
            formatSurveyPeriod(
                "2026-09-01T00:00:00+09:00",
                "2026-10-01T00:00:00+09:00",
            ),
        ).toEqual({ start: "2026/09/01", end: "09/30" })
    })

    it("keeps the end year when the period crosses a year", () => {
        expect(
            formatSurveyPeriod("2026-12-31T12:00:00Z", "2027-01-01T00:00:00Z"),
        ).toEqual({ start: "2026/12/31", end: "12/31" })
        expect(
            formatSurveyPeriod(
                "2026-12-31T00:00:00-05:00",
                "2027-01-02T00:00:00-05:00",
            ),
        ).toEqual({ start: "2026/12/31", end: "2027/01/01" })
    })

    it("uses the stored offset calendar for midnight and non-midnight closes", () => {
        expect(
            formatSurveyPeriod("2026-09-01T00:00:00Z", "2026-09-30T12:00:00Z")
                .end,
        ).toBe("09/30")
        expect(
            formatSurveyPeriod(
                "2026-09-01T00:00:00+05:30",
                "2026-10-01T00:00:00+05:30",
            ).end,
        ).toBe("09/30")
        expect(
            formatSurveyPeriod("2026-02-01T00:00:00Z", "2026-03-01T00:00:00Z")
                .end,
        ).toBe("02/28")
        expect(
            formatSurveyPeriod(
                "2024-02-01T00:00:00+09:00",
                "2024-03-01T00:00:00+09:00",
            ).end,
        ).toBe("02/29")
    })
})

describe("formatSurveyPeriod の日付の境目", () => {
    it.each([
        ["ちょうど 0 時", "2026-10-01T00:00:00.000+09:00", "09/30"],
        ["ミリ秒を省いた 0 時", "2026-10-01T00:00:00+09:00", "09/30"],
        ["0 時 0 分 0 秒 001 ミリ秒", "2026-10-01T00:00:00.001+09:00", "10/01"],
        ["0 時 0 分 1 秒", "2026-10-01T00:00:01+09:00", "10/01"],
        ["小数の 0 が続く 0 時", "2026-10-01T00:00:00.000000+09:00", "09/30"],
        [
            "前日の 23 時 59 分 59 秒 999",
            "2026-09-30T23:59:59.999+09:00",
            "09/30",
        ],
        ["1 ミリ秒未満（.0001 秒）", "2026-10-01T00:00:00.0001+09:00", "09/30"],
        [
            "1 ミリ秒未満（.000999 秒）",
            "2026-10-01T00:00:00.000999+09:00",
            "09/30",
        ],
        [
            "ちょうど 1 ミリ秒（.0010 秒）",
            "2026-10-01T00:00:00.0010+09:00",
            "10/01",
        ],
        ["1 桁の小数（.0 秒）", "2026-10-01T00:00:00.0+09:00", "09/30"],
        ["1 桁の小数（.1 秒）", "2026-10-01T00:00:00.1+09:00", "10/01"],
        ["2 桁の小数（.00 秒）", "2026-10-01T00:00:00.00+09:00", "09/30"],
        ["2 桁の小数（.01 秒）", "2026-10-01T00:00:00.01+09:00", "10/01"],
        [
            "9 桁の小数（ナノ秒 .000000001）",
            "2026-10-01T00:00:00.000000001+09:00",
            "09/30",
        ],
        [
            "9 桁の小数（.001000000）",
            "2026-10-01T00:00:00.001000000+09:00",
            "10/01",
        ],
    ])(
        "終了時刻が%sのとき、最後の日は %s の日付になる",
        (_name, closesAt, end) => {
            expect(
                formatSurveyPeriod("2026-09-01T00:00:00+09:00", closesAt).end,
            ).toBe(end)
        },
    )
})

describe("formatPercent", () => {
    it.each([
        [33.3, "ja", "33.3"],
        [50, "ja", "50"],
        [0, "ja", "0"],
        [100, "ja", "100"],
        [33.3, "en", "33.3"],
        [33.3, "ja", "33.3"],
    ] as const)("formats %s for %s", (value, locale, expected) => {
        expect(formatPercent(value, locale)).toBe(expected)
    })
})

describe("formatPercent の書式", () => {
    it("小数点以下 1 桁を超える値は 1 桁に丸め、整数は小数なしで表す", () => {
        expect(formatPercent(33.333, "en")).toBe("33.3")
        expect(formatPercent(66.66, "en")).toBe("66.7")
        expect(formatPercent(12.0, "en")).toBe("12")
    })
})

describe("topOptionIds", () => {
    it("returns the sole maximum option", () => {
        expect(
            topOptionIds([
                { id: "a", percent: 20 },
                { id: "b", percent: 80 },
            ]),
        ).toEqual(new Set(["b"]))
    })

    it("returns every tied maximum and none when all values are zero", () => {
        expect(
            topOptionIds([
                { id: "a", percent: 40 },
                { id: "b", percent: 40 },
                { id: "c", percent: 20 },
            ]),
        ).toEqual(new Set(["a", "b"]))
        expect(
            topOptionIds([
                { id: "a", percent: 0 },
                { id: "b", percent: 0 },
            ]),
        ).toEqual(new Set())
    })

    it("supports a single option", () => {
        expect(topOptionIds([{ id: "only", percent: 100 }])).toEqual(
            new Set(["only"]),
        )
    })
})
