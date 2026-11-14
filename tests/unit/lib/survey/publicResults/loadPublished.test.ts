/**
 * 公開済みアンケートの取得・検証・失敗の扱いを検証する。
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import {
    DEFAULT_LOAD_LIMITS,
    SurveyResultsLoadError,
    loadPublishedSurveys,
} from "@/lib/survey/publicResults/loadPublished"
import {
    INDEX_KEY,
    resultKey,
    visibilityKey,
} from "@/lib/survey/results/schema"
import type { ResultsReader } from "@/lib/survey/publicResults/loadPublished"
import type { SurveyIndex, SurveyResult } from "@/lib/survey/results/schema"

const ids = {
    a: "00000000-0000-4000-8000-000000000001",
    b: "00000000-0000-4000-8000-000000000002",
    c: "00000000-0000-4000-8000-000000000003",
    d: "00000000-0000-4000-8000-000000000004",
}

const makeResult = (
    id: string,
    opensAt = "2026-11-01T00:00:00Z",
    closesAt = "2026-11-02T00:00:00Z",
): SurveyResult => ({
    schemaVersion: 1,
    id,
    opensAt,
    closesAt,
    questions: [],
})

const makeIndex = (entries: SurveyIndex["surveys"]): SurveyIndex => ({
    schemaVersion: 1,
    surveys: entries,
})

const makeEntry = (
    id: string,
    overrides: Partial<SurveyIndex["surveys"][number]> = {},
): SurveyIndex["surveys"][number] => ({
    id,
    opensAt: "2026-11-01T00:00:00Z",
    closesAt: "2026-11-02T00:00:00Z",
    outcome: "result",
    ...overrides,
})

const jsonObject = (value: unknown) => {
    const text = JSON.stringify(value)
    return {
        size: new TextEncoder().encode(text).byteLength,
        text: async () => text,
    }
}

const readerFor = (objects: Record<string, unknown>): ResultsReader => ({
    get: async key => (key in objects ? jsonObject(objects[key]) : null),
})

const objectsFor = (
    entries: SurveyIndex["surveys"],
    visibleIds: string[],
    results: SurveyResult[],
) => ({
    [INDEX_KEY]: makeIndex(entries),
    ...Object.fromEntries(
        visibleIds.map(id => [
            visibilityKey(id),
            { schemaVersion: 1, visible: true },
        ]),
    ),
    ...Object.fromEntries(
        results.map(result => [resultKey(result.id), result]),
    ),
})

const expectFailure = async (
    promise: Promise<unknown>,
    kind: string,
    surveyId?: string,
) => {
    try {
        await promise
        throw new Error("expected load failure")
    } catch (error) {
        expect(error).toBeInstanceOf(SurveyResultsLoadError)
        expect(error).toMatchObject({ kind, surveyId })
    }
}

afterEach(() => vi.useRealTimers())

describe("loadPublishedSurveys", () => {
    it("loads only visible result entries and skips empty, hidden, and missing flags", async () => {
        const entries = [
            makeEntry(ids.a),
            makeEntry(ids.b),
            makeEntry(ids.c, { outcome: "empty" }),
            makeEntry(ids.d),
        ]
        const requested: string[] = []
        const objects = objectsFor(entries, [ids.a], [makeResult(ids.a)])
        const base = readerFor(objects)
        const reader: ResultsReader = {
            get: async key => {
                requested.push(key)
                return base.get(key)
            },
        }

        await expect(loadPublishedSurveys(reader)).resolves.toEqual([
            makeResult(ids.a),
        ])
        expect(requested).not.toContain(visibilityKey(ids.c))
        expect(requested).not.toContain(resultKey(ids.b))
        expect(requested).not.toContain(resultKey(ids.c))
        expect(requested).not.toContain(resultKey(ids.d))
    })

    it("sorts by opening time, closing time, then id", async () => {
        const entries = [
            makeEntry(ids.b, {
                opensAt: "2026-11-01T00:00:00Z",
                closesAt: "2026-11-03T00:00:00Z",
            }),
            makeEntry(ids.d, { opensAt: "2026-11-02T00:00:00Z" }),
            makeEntry(ids.c, {
                opensAt: "2026-11-01T00:00:00Z",
                closesAt: "2026-11-03T00:00:00Z",
            }),
            makeEntry(ids.a, {
                opensAt: "2026-11-01T00:00:00Z",
                closesAt: "2026-11-04T00:00:00Z",
            }),
        ]
        const results = entries.map(entry =>
            makeResult(entry.id, entry.opensAt, entry.closesAt),
        )
        const visibleIds = entries.map(entry => entry.id)

        await expect(
            loadPublishedSurveys(
                readerFor(objectsFor(entries, visibleIds, results)),
            ),
        ).resolves.toEqual([results[1], results[3], results[0], results[2]])
    })

    it("returns no results when the index is absent", async () => {
        await expect(loadPublishedSurveys(readerFor({}))).resolves.toEqual([])
    })

    it("reports read failures with only the failure kind and survey id", async () => {
        const reader: ResultsReader = {
            get: async () => {
                throw new Error("PRIVATE BODY")
            },
        }
        await expectFailure(loadPublishedSurveys(reader), "read", undefined)
    })

    it.each([
        ["invalid JSON", "not-json", "invalid-json"],
        [
            "invalid index",
            { schemaVersion: 1, surveys: [{ id: "bad" }] },
            "invalid",
        ],
    ])("rejects an %s", async (_label, value, kind) => {
        const reader: ResultsReader = {
            get: async () =>
                typeof value === "string"
                    ? { size: value.length, text: async () => value }
                    : jsonObject(value),
        }
        await expectFailure(
            loadPublishedSurveys(reader),
            kind as string,
            undefined,
        )
    })

    it("rejects invalid flags and invalid result bodies without exposing their contents", async () => {
        const entry = makeEntry(ids.a)
        const planted = "PRIVATE BODY"
        const invalidFlag: ResultsReader = {
            get: async key =>
                key === INDEX_KEY
                    ? jsonObject(makeIndex([entry]))
                    : { size: planted.length, text: async () => planted },
        }
        await expectFailure(
            loadPublishedSurveys(invalidFlag),
            "invalid-json",
            ids.a,
        )

        const invalidResult: ResultsReader = {
            get: async key =>
                key === INDEX_KEY
                    ? jsonObject(makeIndex([entry]))
                    : key === visibilityKey(ids.a)
                      ? jsonObject({ schemaVersion: 1, visible: true })
                      : { size: planted.length, text: async () => planted },
        }
        await expectFailure(
            loadPublishedSurveys(invalidResult),
            "invalid-json",
            ids.a,
        )
        await expectFailure(
            loadPublishedSurveys(
                readerFor({
                    [INDEX_KEY]: makeIndex([entry]),
                    [visibilityKey(ids.a)]: {
                        schemaVersion: 1,
                        visible: true,
                    },
                    [resultKey(ids.a)]: {
                        ...makeResult(ids.a),
                        secret: planted,
                    },
                }),
            ),
            "invalid",
            ids.a,
        )
    })

    it.each([
        ["未知の版", { schemaVersion: 2, visible: true }],
        ["visible が真偽値でない", { schemaVersion: 1, visible: "yes" }],
        ["未知の項目", { schemaVersion: 1, visible: true, note: "x" }],
        ["配列", []],
    ])(
        "fails the build when the visibility flag has an invalid format (%s)",
        async (_name, flag) => {
            const entry = makeEntry(ids.a)

            await expectFailure(
                loadPublishedSurveys(
                    readerFor({
                        [INDEX_KEY]: makeIndex([entry]),
                        [visibilityKey(ids.a)]: flag,
                        [resultKey(ids.a)]: makeResult(ids.a),
                    }),
                ),
                "invalid",
                ids.a,
            )
        },
    )

    it("rejects a body larger than its declared size using the real byte length", async () => {
        const entry = makeEntry(ids.a)
        const largeBody = JSON.stringify({
            schemaVersion: 1,
            pad: "あ".repeat(400),
        })
        const reader: ResultsReader = {
            get: async key => {
                if (key === INDEX_KEY) return jsonObject(makeIndex([entry]))
                if (key === visibilityKey(ids.a))
                    return jsonObject({ schemaVersion: 1, visible: true })
                // 申告の大きさは小さいが、実際の本文は上限を超える
                return { size: 10, text: async () => largeBody }
            },
        }

        await expectFailure(
            loadPublishedSurveys(reader, {
                ...DEFAULT_LOAD_LIMITS,
                maxResultBytes: 1_000,
            }),
            "limit",
            ids.a,
        )
    })

    it("distinguishes a missing result from an id or period mismatch", async () => {
        const entry = makeEntry(ids.a)
        const visibility = {
            [visibilityKey(ids.a)]: { schemaVersion: 1, visible: true },
        }
        await expectFailure(
            loadPublishedSurveys(
                readerFor({ [INDEX_KEY]: makeIndex([entry]), ...visibility }),
            ),
            "missing",
            ids.a,
        )

        await expectFailure(
            loadPublishedSurveys(
                readerFor({
                    [INDEX_KEY]: makeIndex([entry]),
                    [visibilityKey(ids.a)]: { schemaVersion: 1, visible: true },
                    [resultKey(ids.a)]: makeResult(ids.b),
                }),
            ),
            "mismatch",
            ids.a,
        )
        await expectFailure(
            loadPublishedSurveys(
                readerFor({
                    [INDEX_KEY]: makeIndex([entry]),
                    [visibilityKey(ids.a)]: { schemaVersion: 1, visible: true },
                    [resultKey(ids.a)]: makeResult(
                        ids.a,
                        "2026-11-03T00:00:00Z",
                    ),
                }),
            ),
            "mismatch",
            ids.a,
        )
    })

    it("enforces object sizes and the index entry count", async () => {
        const entry = makeEntry(ids.a)
        const indexBody = jsonObject(makeIndex([entry]))
        const oversizedIndex: ResultsReader = {
            get: async key =>
                key === INDEX_KEY
                    ? {
                          ...indexBody,
                          size: DEFAULT_LOAD_LIMITS.maxIndexBytes + 1,
                      }
                    : null,
        }
        await expectFailure(
            loadPublishedSurveys(oversizedIndex),
            "limit",
            undefined,
        )

        const visibility = {
            [visibilityKey(ids.a)]: { schemaVersion: 1, visible: true },
        }
        const resultBody = jsonObject(makeResult(ids.a))
        const oversizedResult: ResultsReader = {
            get: async key =>
                key === INDEX_KEY
                    ? jsonObject(makeIndex([entry]))
                    : key === visibilityKey(ids.a)
                      ? jsonObject(visibility[visibilityKey(ids.a)])
                      : {
                            ...resultBody,
                            size: DEFAULT_LOAD_LIMITS.maxResultBytes + 1,
                        },
        }
        await expectFailure(
            loadPublishedSurveys(oversizedResult),
            "limit",
            ids.a,
        )

        const oversizedFlag: ResultsReader = {
            get: async key =>
                key === INDEX_KEY
                    ? jsonObject(makeIndex([entry]))
                    : {
                          ...jsonObject({ schemaVersion: 1, visible: true }),
                          size: DEFAULT_LOAD_LIMITS.maxVisibilityBytes + 1,
                      },
        }
        await expectFailure(loadPublishedSurveys(oversizedFlag), "limit", ids.a)

        const tooMany = Array.from(
            { length: DEFAULT_LOAD_LIMITS.maxSurveys + 1 },
            (_, index) =>
                makeEntry(
                    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
                    { outcome: "empty" },
                ),
        )
        await expectFailure(
            loadPublishedSurveys(
                readerFor({ [INDEX_KEY]: makeIndex(tooMany) }),
            ),
            "limit",
            undefined,
        )
    })

    it("fails when the total load timeout expires", async () => {
        vi.useFakeTimers()
        const reader: ResultsReader = {
            get: () => new Promise(() => undefined),
        }
        const pending = loadPublishedSurveys(reader, {
            ...DEFAULT_LOAD_LIMITS,
            totalTimeoutMs: 5,
        })
        const failure = expectFailure(pending, "timeout", undefined)
        await vi.advanceTimersByTimeAsync(5)
        await failure
    })

    it("keeps planted body text out of every failure message", async () => {
        const planted = "PRIVATE BODY"
        const reader: ResultsReader = {
            get: async () => ({
                size: planted.length,
                text: async () => planted,
            }),
        }
        try {
            await loadPublishedSurveys(reader)
        } catch (error) {
            expect(String(error)).not.toContain(planted)
            expect(JSON.stringify(error)).not.toContain(planted)
            return
        }
        throw new Error("expected load failure")
    })
})
