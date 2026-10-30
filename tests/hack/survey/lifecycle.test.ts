import { describe, expect, test } from "vitest"

import type { Survey, SurveyConfig } from "@/lib/survey/definition"
import {
    decidePrune,
    pruneCandidates,
    surveyPhase,
} from "../../../hack/survey/lifecycle"

const survey: Survey = {
    id: "sample",
    opensAt: "2026-01-01T00:00:00Z",
    closesAt: "2026-01-10T00:00:00Z",
    title: { ja: "見出し", en: "Title" },
    questions: [
        {
            id: "q1",
            kind: "single",
            title: { ja: "質問", en: "Question" },
            options: [
                { id: "a", label: { ja: "A", en: "A" } },
                { id: "b", label: { ja: "B", en: "B" } },
            ],
        },
    ],
}

const at = (value: string) => new Date(value)

describe("survey lifecycle", () => {
    test("classifies the opening, closing, retention, and expiry boundaries", () => {
        expect(surveyPhase(survey, at("2025-12-31T23:59:59Z"))).toBe("upcoming")
        expect(surveyPhase(survey, at("2026-01-01T00:00:00Z"))).toBe("active")
        expect(surveyPhase(survey, at("2026-01-10T00:00:00Z"))).toBe("retained")
        expect(surveyPhase(survey, at("2026-02-09T23:59:59Z"))).toBe("retained")
        expect(surveyPhase(survey, at("2026-02-10T00:00:00Z"))).toBe("expired")
    })

    test("returns only expired surveys as prune candidates", () => {
        const config: SurveyConfig = {
            surveys: [
                { ...survey, id: "upcoming", opensAt: "2026-03-01T00:00:00Z" },
                { ...survey, id: "active", closesAt: "2026-03-01T00:00:00Z" },
                survey,
            ],
        }

        expect(pruneCandidates(config, at("2026-02-10T00:00:00Z"))).toEqual([
            survey,
        ])
    })

    test("removes only candidates with no rows in every database", () => {
        const candidates = [
            { ...survey, id: "empty" },
            { ...survey, id: "has-rows" },
            { ...survey, id: "uncertain" },
            { ...survey, id: "both" },
            { ...survey, id: "missing" },
            { ...survey, id: "no-checks" },
        ]
        const presence = {
            empty: ["none", "none"] as const,
            "has-rows": ["none", "present"] as const,
            uncertain: ["none", "unknown"] as const,
            both: ["present", "unknown"] as const,
            "no-checks": [] as const,
        }

        expect(decidePrune(candidates, presence)).toEqual({
            remove: ["empty"],
            kept: [
                { id: "has-rows", reason: "rows" },
                { id: "uncertain", reason: "unknown" },
                { id: "both", reason: "rows" },
                { id: "missing", reason: "unknown" },
                { id: "no-checks", reason: "unknown" },
            ],
        })
    })

    test("is deterministic and does not mutate the input", () => {
        const candidates = [{ ...survey }]
        const before = structuredClone(candidates)
        const presence = { sample: ["none", "none"] as const }

        expect(decidePrune(candidates, presence)).toEqual(
            decidePrune(candidates, presence),
        )
        expect(candidates).toEqual(before)
    })
})
