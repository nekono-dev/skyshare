/**
 * Verifies anonymous survey persistence and cleanup.
 */
import { env } from "cloudflare:test"
import type { D1Database } from "@/lib/platform/cfTypes"
import { describe, expect, it } from "vitest"
import {
    isRespondent,
    purgeAnswers,
    purgeRespondents,
    purgeRespondentsBatch,
    purgeSurveysBatch,
    readDailyRows,
    registerRespondent,
    saveAnswer,
} from "@/lib/survey/store"
import { TEST_DID } from "../../fixtures/identities"

const DID_HASH = "a".repeat(64)
const OTHER_HASH = "b".repeat(64)

const countRows = async (table: string, surveyId: string): Promise<number> => {
    const row = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM ${table} WHERE survey_id = ?`,
    )
        .bind(surveyId)
        .first<{ n: number }>()
    return row?.n ?? 0
}

describe("survey store (anonymity)", () => {
    it("saves an answer once per respondent and reports a duplicate for the second attempt", async () => {
        const input = {
            surveyId: "survey-2026-a",
            didHash: DID_HASH,
            answerId: "ans-1",
            answersJson: "{}",
            answeredOn: "2026-11-02",
        }
        expect(await saveAnswer(env.DB, input)).toBe("saved")
        expect(await saveAnswer(env.DB, { ...input, answerId: "ans-2" })).toBe(
            "duplicate",
        )
        const count = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM survey_answers",
        ).first<{ n: number }>()
        expect(count?.n).toBe(1)
    })

    it("never stores the DID itself, only its hash, in any survey table", async () => {
        await saveAnswer(env.DB, {
            surveyId: "survey-2026-a",
            didHash: DID_HASH,
            answerId: "ans-1",
            answersJson: '{"q-purpose":"share"}',
            answeredOn: "2026-11-02",
        })
        const respondents = await env.DB.prepare(
            "SELECT * FROM survey_respondents",
        ).all()
        const answers = await env.DB.prepare(
            "SELECT * FROM survey_answers",
        ).all()
        const stored = JSON.stringify([respondents.results, answers.results])
        expect(stored).not.toContain(TEST_DID)
        expect(Object.keys(respondents.results[0] ?? {}).sort()).toEqual([
            "did_hash",
            "survey_id",
        ])
    })

    it("answers the membership question for a registered respondent only", async () => {
        expect(await isRespondent(env.DB, "survey-2026-a", OTHER_HASH)).toBe(
            false,
        )
        await registerRespondent(env.DB, "survey-2026-a", OTHER_HASH)
        expect(await isRespondent(env.DB, "survey-2026-a", OTHER_HASH)).toBe(
            true,
        )
    })

    it("purges only the rows of the given survey, leaving other surveys intact", async () => {
        await registerRespondent(env.DB, "survey-2026-a", DID_HASH)
        await registerRespondent(env.DB, "survey-2026-b", DID_HASH)
        expect(
            await purgeRespondents(env.DB, "survey-2026-a"),
        ).toBeGreaterThanOrEqual(1)
        expect(await isRespondent(env.DB, "survey-2026-a", DID_HASH)).toBe(
            false,
        )
        expect(await isRespondent(env.DB, "survey-2026-b", DID_HASH)).toBe(true)
    })

    it("purges the answers of the given survey", async () => {
        await saveAnswer(env.DB, {
            surveyId: "survey-2026-c",
            didHash: OTHER_HASH,
            answerId: "ans-9",
            answersJson: "{}",
            answeredOn: "2026-11-02",
        })
        expect(await purgeAnswers(env.DB, "survey-2026-c")).toBe(1)
    })
})

describe("survey store (failure classes)", () => {
    it("rethrows a failure that is not a duplicate respondent (an answer id already used)", async () => {
        await saveAnswer(env.DB, {
            surveyId: "survey-2026-d",
            didHash: "d".repeat(64),
            answerId: "ans-x",
            answersJson: "{}",
            answeredOn: "2026-11-02",
        })
        await expect(
            saveAnswer(env.DB, {
                surveyId: "survey-2026-d",
                didHash: "e".repeat(64),
                answerId: "ans-x",
                answersJson: "{}",
                answeredOn: "2026-11-02",
            }),
        ).rejects.toThrow()
    })

    it("reports zero removed rows when the survey has no respondents", async () => {
        expect(await purgeRespondents(env.DB, "survey-none")).toBe(0)
    })
})

describe("survey store (missing change count)", () => {
    it("reports zero removed rows when the database result carries no change count", async () => {
        const db = {
            prepare: () => ({
                bind: () => ({ run: async () => ({}) }),
            }),
        } as unknown as D1Database
        expect(await purgeRespondents(db, "survey-2026-a")).toBe(0)
        expect(await purgeAnswers(db, "survey-2026-a")).toBe(0)
    })
})

describe("survey store (daily batch operations)", () => {
    it("reads answers and residual membership with one batch and no individual execution", async () => {
        await saveAnswer(env.DB, {
            surveyId: "daily-a",
            didHash: DID_HASH,
            answerId: "daily-ans",
            answersJson: '{"q":1}',
            answeredOn: "2026-11-02",
        })
        await registerRespondent(env.DB, "daily-b", OTHER_HASH)
        let batches = 0
        let individualRuns = 0
        const db = {
            prepare: (sql: string) => {
                const statement = env.DB.prepare(sql)
                return {
                    ...statement,
                    bind: (...args: unknown[]) => {
                        const bound = statement.bind(...args)
                        return {
                            ...bound,
                            run: async () => {
                                individualRuns++
                                return bound.run()
                            },
                        }
                    },
                }
            },
            batch: (statements: Parameters<D1Database["batch"]>[0]) => {
                batches++
                return env.DB.batch(statements)
            },
        } as unknown as D1Database
        const result = await readDailyRows(db, {
            answerSurveyIds: ["daily-a", "daily-none"],
            residualSurveyIds: ["daily-a", "daily-b", "daily-none"],
        })
        expect(batches).toBe(1)
        expect(individualRuns).toBe(0)
        expect(result.answers).toEqual(
            new Map([
                ["daily-a", ['{"q":1}']],
                ["daily-none", []],
            ]),
        )
        expect(result.residual).toEqual(new Set(["daily-a", "daily-b"]))
    })

    it("sends no batch for empty read and delete inputs", async () => {
        let batches = 0
        const db = {
            prepare: env.DB.prepare.bind(env.DB),
            batch: async () => {
                batches++
                return []
            },
        } as unknown as D1Database
        expect(
            await readDailyRows(db, {
                answerSurveyIds: [],
                residualSurveyIds: [],
            }),
        ).toEqual({ answers: new Map(), residual: new Set() })
        await purgeRespondentsBatch(db, [])
        await purgeSurveysBatch(db, [])
        expect(batches).toBe(0)
    })

    it("purges multiple respondent ids while keeping answers and non-target rows", async () => {
        for (const [id, hash] of [
            ["pr-a", DID_HASH],
            ["pr-b", OTHER_HASH],
            ["pr-keep", "c".repeat(64)],
        ] as const) {
            await saveAnswer(env.DB, {
                surveyId: id,
                didHash: hash,
                answerId: `${id}-ans`,
                answersJson: "{}",
                answeredOn: "2026-11-02",
            })
        }
        let batches = 0
        const db = {
            prepare: env.DB.prepare.bind(env.DB),
            batch: (statements: Parameters<D1Database["batch"]>[0]) => {
                batches++
                return env.DB.batch(statements)
            },
        } as unknown as D1Database
        await purgeRespondentsBatch(db, ["pr-a", "pr-b"])
        expect(batches).toBe(1)
        for (const id of ["pr-a", "pr-b"]) {
            expect(await countRows("survey_respondents", id)).toBe(0)
            expect(await countRows("survey_answers", id)).toBe(1)
        }
        expect(await countRows("survey_respondents", "pr-keep")).toBe(1)
        expect(await countRows("survey_answers", "pr-keep")).toBe(1)
    })

    it("purges multiple ids from both tables while keeping a separately seeded non-target", async () => {
        for (const [id, hash] of [
            ["ps-a", DID_HASH],
            ["ps-b", OTHER_HASH],
            ["ps-keep", "d".repeat(64)],
        ] as const) {
            await saveAnswer(env.DB, {
                surveyId: id,
                didHash: hash,
                answerId: `${id}-ans`,
                answersJson: "{}",
                answeredOn: "2026-11-02",
            })
        }
        let batches = 0
        const db = {
            prepare: env.DB.prepare.bind(env.DB),
            batch: (s: Parameters<D1Database["batch"]>[0]) => {
                batches++
                return env.DB.batch(s)
            },
        } as unknown as D1Database
        await purgeSurveysBatch(db, ["ps-a", "ps-b"])
        expect(batches).toBe(1)
        for (const id of ["ps-a", "ps-b"]) {
            expect(await countRows("survey_answers", id)).toBe(0)
            expect(await countRows("survey_respondents", id)).toBe(0)
        }
        expect(await countRows("survey_answers", "ps-keep")).toBe(1)
        expect(await countRows("survey_respondents", "ps-keep")).toBe(1)
    })

    it("chunks read parameters under D1's limit in one batch and merges residual membership", async () => {
        const residualIds = Array.from({ length: 200 }, (_, i) => `lim-r-${i}`)
        const answerIds = Array.from({ length: 120 }, (_, i) => `lim-a-${i}`)
        for (const i of [49, 50, 51, 99, 100, 101, 199])
            await registerRespondent(
                env.DB,
                residualIds[i],
                `${String(i).padStart(3, "0")}${"e".repeat(61)}`,
            )
        await saveAnswer(env.DB, {
            surveyId: answerIds[119],
            didHash: "f".repeat(64),
            answerId: "lim-answer",
            answersJson: '{"ok":true}',
            answeredOn: "2026-11-02",
        })
        let batches = 0
        const boundCounts: number[] = []
        const db = {
            prepare: (sql: string) => {
                const statement = env.DB.prepare(sql)
                return {
                    ...statement,
                    bind: (...args: unknown[]) => {
                        boundCounts.push(args.length)
                        return statement.bind(...args)
                    },
                }
            },
            batch: (s: Parameters<D1Database["batch"]>[0]) => {
                batches++
                return env.DB.batch(s)
            },
        } as unknown as D1Database
        const result = await readDailyRows(db, {
            answerSurveyIds: answerIds,
            residualSurveyIds: residualIds,
        })
        expect(batches).toBe(1)
        expect(Math.max(...boundCounts)).toBeLessThanOrEqual(100)
        expect(result.answers.get(answerIds[119])).toEqual(['{"ok":true}'])
        expect(result.answers.get(answerIds[0])).toEqual([])
        expect(result.residual).toEqual(
            new Set([49, 50, 51, 99, 100, 101, 199].map(i => residualIds[i])),
        )
    })

    it("chunks 120-id purge inputs into one batch per operation", async () => {
        const respIds = Array.from({ length: 120 }, (_, i) => `lim-pr-${i}`)
        const surveyIds = Array.from({ length: 120 }, (_, i) => `lim-ps-${i}`)
        for (const id of [...respIds, ...surveyIds])
            await registerRespondent(env.DB, id, "a".repeat(64))
        let batches = 0
        const boundCounts: number[] = []
        const db = {
            prepare: (sql: string) => {
                const st = env.DB.prepare(sql)
                return {
                    ...st,
                    bind: (...args: unknown[]) => {
                        boundCounts.push(args.length)
                        return st.bind(...args)
                    },
                }
            },
            batch: (s: Parameters<D1Database["batch"]>[0]) => {
                batches++
                return env.DB.batch(s)
            },
        } as unknown as D1Database
        await purgeRespondentsBatch(db, respIds)
        expect(batches).toBe(1)
        await purgeSurveysBatch(db, surveyIds)
        expect(batches).toBe(2)
        expect(Math.max(...boundCounts)).toBeLessThanOrEqual(100)
        expect(await countRows("survey_respondents", respIds[119])).toBe(0)
        expect(await countRows("survey_respondents", surveyIds[119])).toBe(0)
    })

    it("propagates a batch failure without individual fallback", async () => {
        let runs = 0
        const failure = new Error("batch failed")
        const db = {
            prepare: (sql: string) => {
                const statement = env.DB.prepare(sql)
                return {
                    ...statement,
                    bind: (...args: unknown[]) => {
                        const bound = statement.bind(...args)
                        return {
                            ...bound,
                            run: async () => {
                                runs++
                                return bound.run()
                            },
                        }
                    },
                }
            },
            batch: async () => {
                throw failure
            },
        } as unknown as D1Database
        await expect(
            readDailyRows(db, {
                answerSurveyIds: ["x"],
                residualSurveyIds: [],
            }),
        ).rejects.toBe(failure)
        await expect(purgeRespondentsBatch(db, ["x"])).rejects.toBe(failure)
        await expect(purgeSurveysBatch(db, ["x"])).rejects.toBe(failure)
        expect(runs).toBe(0)
    })
})
