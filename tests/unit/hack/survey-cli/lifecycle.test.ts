/**
 * survey CLI の段階・表・除去・配備先の純粋な判定を検証する。
 */
import { describe, expect, it } from "vitest"

import type { Survey, SurveyConfig } from "@/lib/survey/definition"
import {
    buildStatusRows,
    decidePrune,
    decideRemove,
    formatJst,
    latestReleaseBranch,
    surveyStage,
    type Aggregation,
    type Period,
} from "@/../hack/survey-cli/lifecycle"

const period: Period = {
    opensAt: "2026-11-10T00:00:00Z",
    closesAt: "2026-11-12T00:00:00Z",
}
const now = (value: string): Date => new Date(value)
const survey = (
    id: string,
    opensAt = period.opensAt,
    closesAt = period.closesAt,
): Survey => ({
    id,
    opensAt,
    closesAt,
    questions: [],
})
const config = (...surveys: Survey[]): SurveyConfig => ({ surveys })
const aggregation = (
    visibility: "visible" | "hidden" | "invalid" = "hidden",
): Aggregation => ({
    outcome: "result",
    visibility,
})
const aggregated = (...ids: string[]) => new Set(ids)

describe("surveyStage", () => {
    it("開始時刻ちょうどから active、終了時刻ちょうどから集計結果の段階にする", () => {
        expect(
            surveyStage(period, undefined, now("2026-11-09T23:59:59.999Z")),
        ).toBe("upcoming")
        expect(surveyStage(period, undefined, now(period.opensAt))).toBe(
            "active",
        )
        expect(
            surveyStage(period, undefined, now("2026-11-11T23:59:59.999Z")),
        ).toBe("active")
        expect(surveyStage(period, undefined, now(period.closesAt))).toBe(
            "closed",
        )
        expect(
            surveyStage(period, { outcome: "empty" }, now(period.closesAt)),
        ).toBe("empty")
        expect(
            surveyStage(period, aggregation("visible"), now(period.closesAt)),
        ).toBe("published")
        expect(
            surveyStage(period, aggregation("hidden"), now(period.closesAt)),
        ).toBe("hidden")
    })

    it("終了前は集計済みでも期間による段階を優先する", () => {
        expect(
            surveyStage(
                period,
                aggregation("visible"),
                now("2026-11-11T00:00:00Z"),
            ),
        ).toBe("active")
    })

    it("不正な可視状態を hidden として行の末尾に警告マーカーを付ける", () => {
        const rows = buildStatusRows(
            config(survey("configured")),
            new Map([
                ["configured", { period, aggregation: aggregation("invalid") }],
            ]),
            now(period.closesAt),
        )
        expect(rows).toEqual([
            {
                id: "configured",
                stage: "hidden",
                closesAt: period.closesAt,
                inConfig: true,
                invalidVisibility: true,
            },
        ])
    })
})

describe("buildStatusRows", () => {
    it("設定と目録だけの記録を開始時刻順・同時刻は ID 順で返し題を含めない", () => {
        const rows = buildStatusRows(
            config(survey("later")),
            new Map([
                ["later", { period, aggregation: undefined }],
                [
                    "earlier-z",
                    {
                        period: { ...period, opensAt: "2026-11-01T00:00:00Z" },
                        aggregation: { outcome: "empty" },
                    },
                ],
                [
                    "earlier-a",
                    {
                        period: { ...period, opensAt: "2026-11-01T00:00:00Z" },
                        aggregation: undefined,
                    },
                ],
            ]),
            now("2026-11-02T00:00:00Z"),
        )
        expect(rows.map(({ id }) => id)).toEqual([
            "earlier-a",
            "earlier-z",
            "later",
        ])
        expect(rows.map(({ inConfig }) => inConfig)).toEqual([
            false,
            false,
            true,
        ])
        expect(rows.every(row => !("title" in row))).toBe(true)
    })
})

describe("decidePrune", () => {
    it("終了時刻ちょうどで指定環境に記録があれば除去する", () => {
        expect(
            decidePrune(
                config(survey("finished")),
                aggregated("finished"),
                now(period.closesAt),
            ),
        ).toEqual({ remove: ["finished"], kept: [] })
    })

    it("終了済みでも指定環境の記録が無ければ残す", () => {
        expect(
            decidePrune(
                config(survey("unfinished")),
                aggregated(),
                now("2026-11-13T00:00:00Z"),
            ),
        ).toEqual({ remove: [], kept: [{ id: "unfinished" }] })
    })

    it("開始前と開催中は指定環境に記録があっても対象にしない", () => {
        expect(
            decidePrune(
                config(
                    survey(
                        "upcoming",
                        "2026-11-20T00:00:00Z",
                        "2026-11-22T00:00:00Z",
                    ),
                    survey(
                        "active",
                        "2026-11-11T00:00:00Z",
                        "2026-11-14T00:00:00Z",
                    ),
                ),
                aggregated("upcoming", "active"),
                now("2026-11-13T00:00:00Z"),
            ),
        ).toEqual({ remove: [], kept: [] })
    })
})

describe("decideRemove", () => {
    it("開始前は集計状況によらず除去する", () => {
        expect(
            decideRemove(
                survey("s"),
                aggregated(),
                now("2026-11-09T23:59:59Z"),
            ),
        ).toEqual({ kind: "remove" })
    })

    it("開催中は集計済みでも拒否する", () => {
        expect(
            decideRemove(survey("s"), aggregated("s"), now(period.opensAt)),
        ).toEqual({ kind: "refused", reason: "active" })
    })

    it.each([
        [aggregated("s"), { kind: "remove" }],
        [aggregated(), { kind: "refused", reason: "not-aggregated" }],
    ] as const)(
        "終了後の集計状態から除去可否を決める",
        (aggregated, expected) => {
            expect(
                decideRemove(survey("s"), aggregated, now(period.closesAt)),
            ).toEqual(expected)
        },
    )
})

describe("release branch and JST formatting", () => {
    it("空・1件・複数・同時刻で最新更新、同時刻は名前降順を選ぶ", () => {
        expect(latestReleaseBranch([])).toBeUndefined()
        expect(
            latestReleaseBranch([
                { name: "release/a", committedAt: "2026-01-01T00:00:00Z" },
            ]),
        ).toBe("release/a")
        expect(
            latestReleaseBranch([
                { name: "release/a", committedAt: "2026-01-01T00:00:00Z" },
                { name: "release/z", committedAt: "2026-01-02T00:00:00Z" },
                { name: "release/b", committedAt: "2026-01-02T00:00:00Z" },
            ]),
        ).toBe("release/z")
    })

    it("日時を日本標準時の YYYY-MM-DD HH:mm にする", () => {
        expect(formatJst("2026-11-12T15:04:00Z")).toBe("2026-11-13 00:04")
    })
})
