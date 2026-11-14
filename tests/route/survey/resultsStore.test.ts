/**
 * 統計結果と目録の R2 保管動作を検証する。
 */
import { env } from "cloudflare:test"
import type { SurveyResultsBucket } from "@/lib/platform/cfTypes"
import { describe, expect, it, vi } from "vitest"
import {
    appendIndexEntry,
    IndexConflictError,
    IndexInvalidError,
    readIndex,
    readMatchingResult,
    readResult,
    ResultInvalidError,
    ResultMismatchError,
    putResultOnce,
} from "@/lib/survey/results/store"
import {
    INDEX_KEY,
    resultKey,
    type SurveyResult,
} from "@/lib/survey/results/schema"

const bucket = env.SURVEY_RESULTS as unknown as SurveyResultsBucket
const uuid = (): string => crypto.randomUUID()
const period = {
    opensAt: "2026-11-01T00:00:00Z",
    closesAt: "2026-12-01T00:00:00Z",
}
const makeResult = (
    id: string,
    overrides: Partial<SurveyResult> = {},
): SurveyResult => ({
    schemaVersion: 1,
    id,
    ...period,
    questions: [],
    ...overrides,
})

describe("survey results store", () => {
    it("rejects invalid JSON, format, and requested id without exposing body text", async () => {
        const marker = `secret-${uuid()}`
        const invalidJsonId = uuid()
        const invalidFormatId = uuid()
        const wrongId = uuid()
        const output = vi.spyOn(console, "error").mockImplementation(() => {})
        await bucket.put(resultKey(invalidJsonId), `{${marker}`, {
            onlyIf: { etagDoesNotMatch: "*" },
        })
        await bucket.put(
            resultKey(invalidFormatId),
            JSON.stringify({ id: invalidFormatId, marker }),
            {
                onlyIf: { etagDoesNotMatch: "*" },
            },
        )
        await bucket.put(
            resultKey(wrongId),
            JSON.stringify(makeResult(uuid())),
            {
                onlyIf: { etagDoesNotMatch: "*" },
            },
        )
        for (const id of [invalidJsonId, invalidFormatId, wrongId]) {
            let caught: unknown
            try {
                await readResult(bucket, id)
            } catch (error) {
                caught = error
            }
            expect(caught).toBeInstanceOf(ResultInvalidError)
            expect((caught as Error).message).not.toContain(marker)
        }
        expect(output.mock.calls.flat().join(" ")).not.toContain(marker)
        output.mockRestore()
    })

    it("matches id and period and reports a mismatch with the named error", async () => {
        const id = uuid()
        await bucket.put(resultKey(id), JSON.stringify(makeResult(id)), {
            onlyIf: { etagDoesNotMatch: "*" },
        })
        expect(await readMatchingResult(bucket, { id, ...period })).toEqual(
            makeResult(id),
        )
        await expect(
            readMatchingResult(bucket, {
                id,
                ...period,
                closesAt: "2027-01-01T00:00:00Z",
            }),
        ).rejects.toBeInstanceOf(ResultMismatchError)

        const wrongBodyId = uuid()
        const requestedId = uuid()
        await bucket.put(
            resultKey(requestedId),
            JSON.stringify(makeResult(wrongBodyId)),
            { onlyIf: { etagDoesNotMatch: "*" } },
        )
        await expect(
            readMatchingResult(bucket, { id: requestedId, ...period }),
        ).rejects.toBeInstanceOf(ResultMismatchError)
        await expect(
            readMatchingResult(bucket, {
                id,
                ...period,
                opensAt: "2026-10-01T00:00:00Z",
            }),
        ).rejects.toBeInstanceOf(ResultMismatchError)
    })

    it("returns undefined for an absent result", async () => {
        expect(await readResult(bucket, uuid())).toBeUndefined()
    })

    it("confirms an exists outcome by rereading the stored matching body", async () => {
        const id = uuid()
        const result = makeResult(id)
        await bucket.put(resultKey(id), JSON.stringify(result), {
            onlyIf: { etagDoesNotMatch: "*" },
        })
        const get = vi.spyOn(bucket, "get")
        await expect(putResultOnce(bucket, result)).resolves.toBe("exists")
        expect(get).toHaveBeenCalledWith(resultKey(id))
        get.mockRestore()
    })

    it("does not accept exists when the reread body fails the expected period", async () => {
        const id = uuid()
        const expected = makeResult(id)
        const conflicting = makeResult(id, {
            opensAt: "2026-10-01T00:00:00Z",
        })
        await bucket.put(resultKey(id), JSON.stringify(conflicting), {
            onlyIf: { etagDoesNotMatch: "*" },
        })
        await expect(putResultOnce(bucket, expected)).rejects.toBeInstanceOf(
            ResultMismatchError,
        )
    })

    it("never overwrites an existing result", async () => {
        const id = uuid()
        const first = makeResult(id)
        const second = makeResult(id, {
            questions: [
                {
                    id: "q",
                    kind: "single",
                    title: { ja: "質問", en: "Question" },
                    options: [],
                },
            ],
        })
        await expect(putResultOnce(bucket, first)).resolves.toBe("created")
        await expect(putResultOnce(bucket, second)).resolves.toBe("exists")
        expect(await readResult(bucket, id)).toEqual(first)
    })

    it("creates a missing index and appends with compare-and-swap", async () => {
        const firstId = uuid()
        const entry = { id: firstId, ...period, outcome: "result" as const }
        await appendIndexEntry(bucket, entry)
        expect((await readIndex(bucket)).index.surveys).toContainEqual(entry)

        let content: string | undefined
        let etag = 0
        const absentIndexBucket: SurveyResultsBucket = {
            get: async key => {
                if (key !== INDEX_KEY || content === undefined) return null
                return { etag: String(etag), text: async () => content! }
            },
            put: async (key, value, options) => {
                if (key !== INDEX_KEY) return bucket.put(key, value, options)
                expect(options?.onlyIf).toEqual({ etagDoesNotMatch: "*" })
                if (content !== undefined) return null
                content = value
                etag++
                return { etag: String(etag) }
            },
        }
        const createdId = uuid()
        const createdEntry = {
            id: createdId,
            ...period,
            outcome: "empty" as const,
        }
        await appendIndexEntry(absentIndexBucket, createdEntry)
        expect((await readIndex(absentIndexBucket)).index.surveys).toEqual([
            createdEntry,
        ])
    })

    it("retries index compare-and-swap at most three times before failing", async () => {
        const id = uuid()
        let puts = 0
        const conflictBucket: SurveyResultsBucket = {
            get: bucket.get.bind(bucket),
            put: async (key, value, options) => {
                if (key === INDEX_KEY) {
                    puts++
                    return null
                }
                return bucket.put(key, value, options)
            },
        }
        await expect(
            appendIndexEntry(conflictBucket, {
                id,
                ...period,
                outcome: "empty",
            }),
        ).rejects.toBeInstanceOf(IndexConflictError)
        expect(puts).toBe(3)
    })

    it("rejects an invalid appended entry before attempting a write", async () => {
        const existing = { id: uuid(), ...period, outcome: "empty" as const }
        await appendIndexEntry(bucket, existing)
        const before = await bucket.get(INDEX_KEY)
        const body = await before!.text()
        const put = vi.spyOn(bucket, "put")
        await expect(
            appendIndexEntry(bucket, {
                id: uuid(),
                ...period,
                closesAt: "invalid",
                outcome: "empty",
            }),
        ).rejects.toBeInstanceOf(IndexInvalidError)
        expect(put).not.toHaveBeenCalled()
        expect(await (await bucket.get(INDEX_KEY))!.text()).toBe(body)
        put.mockRestore()
    })

    it("recovers a concurrent append by rereading and preserving both entries", async () => {
        const other = { id: uuid(), ...period, outcome: "empty" as const }
        const ours = { id: uuid(), ...period, outcome: "result" as const }
        let raced = false
        const racingBucket: SurveyResultsBucket = {
            get: bucket.get.bind(bucket),
            put: async (key, value, options) => {
                if (key !== INDEX_KEY) return bucket.put(key, value, options)
                if (!raced) {
                    raced = true
                    const current = await bucket.get(INDEX_KEY)
                    const updated = JSON.stringify({
                        schemaVersion: 1,
                        surveys: [other],
                    })
                    await bucket.put(
                        INDEX_KEY,
                        updated,
                        current
                            ? { onlyIf: { etagMatches: current.etag } }
                            : { onlyIf: { etagDoesNotMatch: "*" } },
                    )
                }
                return bucket.put(key, value, options)
            },
        }
        await appendIndexEntry(racingBucket, ours)
        expect((await readIndex(bucket)).index.surveys).toEqual(
            expect.arrayContaining([other, ours]),
        )
    })

    it("does not write an entry whose id is already indexed", async () => {
        const entry = { id: uuid(), ...period, outcome: "empty" as const }
        await appendIndexEntry(bucket, entry)
        const put = vi.spyOn(bucket, "put")
        await appendIndexEntry(bucket, { ...entry, outcome: "result" })
        expect(put).not.toHaveBeenCalled()
        put.mockRestore()
    })

    it("maps bucket I/O failures to sanitized errors", async () => {
        const marker = `private-${uuid()}`
        const throwingGet: SurveyResultsBucket = {
            get: async () => {
                throw new Error(marker)
            },
            put: bucket.put.bind(bucket),
        }
        await expect(readIndex(throwingGet)).rejects.toMatchObject({
            name: "IndexInvalidError",
        })

        const textFailure: SurveyResultsBucket = {
            get: async () => ({
                etag: "x",
                text: async () => {
                    throw new Error(marker)
                },
            }),
            put: bucket.put.bind(bucket),
        }
        await expect(readResult(textFailure, uuid())).rejects.toMatchObject({
            name: "ResultInvalidError",
        })

        const putFailure: SurveyResultsBucket = {
            get: bucket.get.bind(bucket),
            put: async () => {
                throw new Error(marker)
            },
        }
        await expect(
            putResultOnce(putFailure, makeResult(uuid())),
        ).rejects.toMatchObject({
            name: "ResultInvalidError",
        })
        await expect(
            appendIndexEntry(putFailure, {
                id: uuid(),
                ...period,
                outcome: "empty",
            }),
        ).rejects.toThrow()
        const appendedId = uuid()
        let appendError: unknown
        try {
            await appendIndexEntry(putFailure, {
                id: appendedId,
                ...period,
                outcome: "empty",
            })
        } catch (error) {
            appendError = error
        }
        expect(appendError).toBeInstanceOf(Error)
        const appendMessage = (appendError as Error).message
        expect(appendMessage).not.toContain(appendedId)
        expect(appendMessage).not.toContain("schemaVersion")
        for (const operation of [
            () => readIndex(throwingGet),
            () => readResult(textFailure, uuid()),
            () => putResultOnce(putFailure, makeResult(uuid())),
            () =>
                appendIndexEntry(putFailure, {
                    id: uuid(),
                    ...period,
                    outcome: "empty",
                }),
        ]) {
            try {
                await operation()
            } catch (error) {
                expect((error as Error).message).not.toContain(marker)
            }
        }
    })
})
