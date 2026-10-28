import { describe, expect, test } from "vitest"

import type { Survey, SurveyConfig } from "@/lib/survey/definition"
import {
    VARIABLE_LIMIT_BYTES,
    addSurvey,
    byteLength,
    removeSurveys,
    serializeConfig,
} from "../../../hack/survey/config"

const makeSurvey = (
    overrides: Partial<Survey> = {},
): Omit<Survey, "id"> & { id?: string } => ({
    opensAt: "2026-11-01T00:00:00+09:00",
    closesAt: "2026-11-08T00:00:00+09:00",
    title: { ja: "SkyshareのUI", en: "Skyshare UI" },
    questions: [
        {
            id: "ui-choice",
            kind: "single",
            title: { ja: "どちらが好みですか", en: "Which do you prefer?" },
            options: [
                { id: "v1", label: { ja: "Skyshare v1", en: "Skyshare v1" } },
                { id: "v2", label: { ja: "Skyshare v2", en: "Skyshare v2" } },
            ],
        },
    ],
    ...overrides,
})

const configWith = (...surveys: Survey[]): SurveyConfig => ({ surveys })

describe("survey config helpers", () => {
    test("creates an item with the JST month and smallest available sequence", () => {
        const result = addSurvey({ surveys: [] }, makeSurvey())

        expect(result).toMatchObject({
            status: "created",
            id: "2026-11-1",
            config: { surveys: [{ id: "2026-11-1" }] },
        })
        expect(result.status === "created" && result.value).toBe(
            serializeConfig({
                surveys: [{ id: "2026-11-1", ...makeSurvey() }],
            }),
        )
    })

    test("reuses the id of an existing survey with identical normalized content", () => {
        const existing = { id: "existing-survey", ...makeSurvey() } as Survey
        const result = addSurvey(configWith(existing), makeSurvey())

        expect(result).toMatchObject({
            status: "unchanged",
            id: "existing-survey",
            config: configWith(existing),
        })
    })

    test("chooses the next noncolliding id for another survey in the same month", () => {
        const existing = {
            id: "2026-11-1",
            ...makeSurvey({
                opensAt: "2026-11-10T00:00:00+09:00",
                closesAt: "2026-11-17T00:00:00+09:00",
            }),
        } as Survey
        const result = addSurvey(configWith(existing), makeSurvey())

        expect(result).toMatchObject({
            status: "created",
            id: "2026-11-2",
            config: { surveys: [{ id: "2026-11-2" }, { id: "2026-11-1" }] },
        })
        expect(result.status === "created" && result.config.surveys[1]).toEqual(
            existing,
        )
    })

    test("replaces the survey with the explicitly supplied id", () => {
        const existing = { id: "picked-ui", ...makeSurvey() } as Survey
        const revised = makeSurvey({
            title: { ja: "新しい題", en: "New title" },
        })
        const result = addSurvey(configWith(existing), {
            ...revised,
            id: "picked-ui",
        })

        expect(result).toMatchObject({
            status: "updated",
            id: "picked-ui",
            config: { surveys: [{ id: "picked-ui", title: revised.title }] },
        })
    })

    test("returns fixed issues for an invalid draft without echoing input values", () => {
        const secret = "private-invalid-input-value"
        const result = addSurvey(
            { surveys: [] },
            {
                ...makeSurvey(),
                opensAt: secret,
            },
        )

        expect(result).toMatchObject({ status: "invalid" })
        expect(JSON.stringify(result)).not.toContain(secret)
        expect(result).toHaveProperty("issues")
    })

    test("rejects normalized config exceeding the UTF-8 byte limit", () => {
        const result = addSurvey(
            { surveys: [] },
            makeSurvey({
                title: { ja: "あ".repeat(VARIABLE_LIMIT_BYTES), en: "Title" },
            }),
        )

        expect(result.status).toBe("too-large")
        expect(result.status === "too-large" && result.bytes).toBeGreaterThan(
            VARIABLE_LIMIT_BYTES,
        )
        expect(byteLength("あ")).toBe(3)
    })

    test("serializes survey order and schema keys deterministically", () => {
        const earlier = { id: "early", ...makeSurvey() } as Survey
        const later = {
            id: "late",
            ...makeSurvey({
                opensAt: "2026-11-10T00:00:00+09:00",
                closesAt: "2026-11-17T00:00:00+09:00",
            }),
        } as Survey
        const first = serializeConfig(configWith(later, earlier))
        const second = serializeConfig(configWith(earlier, later))

        expect(first).toBe(second)
        expect(
            JSON.parse(first).surveys.map((survey: Survey) => survey.id),
        ).toEqual(["early", "late"])
        expect(Object.keys(JSON.parse(first).surveys[0])).toEqual([
            "id",
            "opensAt",
            "closesAt",
            "title",
            "questions",
        ])
    })

    test("preserves other surveys and removes only requested ids idempotently", () => {
        const keep = { id: "keep", ...makeSurvey() } as Survey
        const remove = {
            id: "remove",
            ...makeSurvey({
                opensAt: "2026-11-10T00:00:00+09:00",
                closesAt: "2026-11-17T00:00:00+09:00",
            }),
        } as Survey
        const initial = configWith(keep, remove)
        const once = removeSurveys(initial, ["remove", "missing"])

        expect(once).toEqual(configWith(keep))
        expect(removeSurveys(once, ["remove"])).toEqual(once)
        expect(initial).toEqual(configWith(keep, remove))
    })
})
