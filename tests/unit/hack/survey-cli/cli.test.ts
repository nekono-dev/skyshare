/**
 * survey CLI の登録・状態確認の流れと、固定された出力を確認する。
 */
import { describe, expect, it, vi } from "vitest"

import { createValidSurveyConfig } from "../../../fixtures/survey/config"
import newDraft from "../../../fixtures/survey-operation/without-id.json"
import updateDraft from "../../../fixtures/survey-operation/with-id.json"
import { run } from "../../../../hack/survey-cli/cli"
import type { SurveyRemote } from "../../../../hack/survey-cli/remote"

const id = "survey-2026-a"
const generatedId = "123e4567-e89b-42d3-a456-426614174000"
const configValue = JSON.stringify(createValidSurveyConfig())
const current = new Date("2026-11-15T12:00:00.000Z")
const index = (...ids: string[]) => ({
    schemaVersion: 1 as const,
    surveys: ids.map(id => ({
        id,
        opensAt: "2026-11-01T00:00:00+09:00",
        closesAt: "2026-12-01T00:00:00+09:00",
        outcome: "result" as const,
    })),
})

const makeRemote = (
    overrides: Partial<SurveyRemote> = {},
    calls: string[] = [],
): SurveyRemote => ({
    async readConfigValue() {
        calls.push("config")
        return configValue
    },
    async writeConfigValue() {
        calls.push("write")
    },
    async deleteConfigValue() {
        calls.push("delete")
    },
    async readIndex(env) {
        calls.push(`index:${env}`)
        return undefined
    },
    async readVisibility() {
        return "hidden"
    },
    async readResult() {
        return undefined
    },
    async writeVisibility() {},
    async listReleaseBranches() {
        return []
    },
    async startDeploy() {},
    ...overrides,
})

const deps = (remote: SurveyRemote, extra: Record<string, unknown> = {}) => ({
    remote,
    now: () => new Date(current),
    readFile: () => JSON.stringify(newDraft),
    createId: () => generatedId,
    ...extra,
})

describe("survey CLI add", () => {
    it("allows an empty config after reading both indexes and issues an id only after validation", async () => {
        const calls: string[] = []
        const remote = makeRemote(
            {
                async readConfigValue() {
                    calls.push("config")
                    return undefined
                },
                async readIndex(env) {
                    calls.push(`index:${env}`)
                    return undefined
                },
                async writeConfigValue() {
                    calls.push("write")
                },
            },
            calls,
        )
        const createId = vi.fn(() => generatedId)
        const result = await run(["add", "--file", "draft.json"], {
            ...deps(remote),
            createId,
        })
        expect(result.lines[0]).toMatch(/^add: created /)
        expect(calls).toEqual([
            "config",
            "index:production",
            "index:develop",
            "write",
        ])
        expect(createId).toHaveBeenCalledOnce()
    })

    it("allows registration when every configured id exists in both indexes", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                const past = createValidSurveyConfig()
                past.surveys[0]!.opensAt = "2026-10-01T00:00:00+09:00"
                past.surveys[0]!.closesAt = "2026-11-01T00:00:00+09:00"
                return JSON.stringify(past)
            },
            async readIndex() {
                return index(id)
            },
        })
        const result = await run(["add", "--file", "draft.json"], deps(remote))
        expect(result.code).toBe(0)
        expect(result.lines).toHaveLength(1)
    })

    it("refuses when any configured id is missing from one environment, including a before-start survey", async () => {
        const beforeStart = JSON.parse(configValue)
        beforeStart.surveys[0].opensAt = "2026-11-20T00:00:00+09:00"
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(beforeStart)
            },
            async readIndex(env) {
                return env === "production" ? index(id) : undefined
            },
        })
        const createId = vi.fn(() => generatedId)
        const result = await run(["add", "--file", "draft.json"], {
            ...deps(remote),
            createId,
        })
        expect(result.lines).toEqual([
            "error: refused: 未集計のアンケートがあります。集計を待つか、開始前なら remove、開催中なら締切を前倒しして両環境へ配備し、集計を待ってください。",
        ])
        expect(createId).not.toHaveBeenCalled()
    })

    it("does not block on aggregated past surveys retained in config", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                const past = createValidSurveyConfig()
                past.surveys[0]!.opensAt = "2026-10-01T00:00:00+09:00"
                past.surveys[0]!.closesAt = "2026-11-01T00:00:00+09:00"
                return JSON.stringify(past)
            },
            async readIndex() {
                return {
                    ...index(id),
                    surveys: [
                        { ...index(id).surveys[0]!, id: "survey-2026-a" },
                    ],
                }
            },
        })
        const result = await run(["add", "--file", "draft.json"], deps(remote))
        expect(result.code).toBe(0)
    })

    it.each(["auth", "unavailable", "parse"] as const)(
        "fails closed on %s index read errors without exposing secrets",
        async kind => {
            const remote = makeRemote({
                async readIndex(env) {
                    if (env === "develop")
                        throw Object.assign(new Error("BODY-SECRET"), { kind })
                    return undefined
                },
            })
            const result = await run(
                ["add", "--file", "draft.json"],
                deps(remote),
            )
            expect(result.code).toBe(1)
            expect(result.lines.join(" ")).not.toContain("BODY-SECRET")
            expect(result.lines[0]).toMatch(
                /^error: (auth|unavailable|invalid):/,
            )
        },
    )

    it("rejects a returned index that does not pass the shared schema", async () => {
        const remote = makeRemote({
            async readIndex() {
                return {
                    schemaVersion: 99,
                    surveys: [],
                    secret: "BODY-SECRET",
                } as never
            },
        })
        const result = await run(["add", "--file", "draft.json"], deps(remote))
        expect(result.lines[0]).toMatch(/^error: invalid:/)
        expect(result.lines.join(" ")).not.toContain("BODY-SECRET")
    })

    it("dry-run performs both index checks and does not write or issue an id", async () => {
        const calls: string[] = []
        const remote = makeRemote(
            {
                async readConfigValue() {
                    calls.push("config")
                    return undefined
                },
                async readIndex(env) {
                    calls.push(`index:${env}`)
                    return undefined
                },
                async writeConfigValue() {
                    calls.push("write")
                },
            },
            calls,
        )
        const createId = vi.fn(() => generatedId)
        const result = await run(["add", "--file", "draft.json", "--dry-run"], {
            ...deps(remote),
            createId,
        })
        expect(result.lines[0]).toMatch(/^\[dry-run\] add: created /)
        expect(calls).toEqual(["config", "index:production", "index:develop"])
        expect(createId).not.toHaveBeenCalled()
    })

    it("does not fail a dry-run when an existing configured id equals the first placeholder id", async () => {
        const collidingId = "123e4567-e89b-42d3-a456-000000000000"
        const past = createValidSurveyConfig()
        past.surveys[0]!.id = collidingId
        past.surveys[0]!.opensAt = "2026-10-01T00:00:00+09:00"
        past.surveys[0]!.closesAt = "2026-11-01T00:00:00+09:00"
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(past)
            },
            async readIndex() {
                return index(collidingId)
            },
        })

        const dryRun = await run(
            ["add", "--file", "draft.json", "--dry-run"],
            deps(remote),
        )
        const real = await run(["add", "--file", "draft.json"], deps(remote))

        expect(dryRun.code).toBe(0)
        expect(dryRun.lines[0]).toMatch(/^\[dry-run\] add: created /)
        expect(dryRun.lines[0]).not.toContain(collidingId)
        expect(real.code).toBe(0)
    })

    it("accepts a specified date deadline and returns exactly one line", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                return undefined
            },
            async readIndex() {
                return undefined
            },
        })
        const result = await run(["add", "--file", "draft.json"], deps(remote))
        expect(result.lines).toHaveLength(1)
        expect(result.code).toBe(0)
    })

    it("returns not-found for an unknown explicit id without creating a survey", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                return configValue
            },
        })
        const result = await run(["add", "--file", "draft.json"], {
            ...deps(remote),
            readFile: () =>
                JSON.stringify({ ...updateDraft, id: "survey-missing" }),
        })
        expect(result.lines[0]).toMatch(/^error: not-found:/)
    })

    it("refuses a deadline at or after the current deadline", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                return configValue
            },
        })
        const result = await run(["add", "--file", "draft.json"], {
            ...deps(remote),
            readFile: () =>
                JSON.stringify({ ...updateDraft, closesAt: "2026-12-02" }),
        })
        expect(result.lines[0]).toContain("締切は現在の締切より前の日付")
    })

    it("refuses a deadline at or before opening and uses the fixed no-earlier-midnight sentence", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                return configValue
            },
        })
        const atOpening = await run(["add", "--file", "draft.json"], {
            ...deps(remote),
            readFile: () =>
                JSON.stringify({ ...updateDraft, closesAt: "2026-11-01" }),
        })
        expect(atOpening.lines[0]).toMatch(/^error: invalid:/)

        const sameDayConfig = JSON.stringify({
            surveys: [
                {
                    ...createValidSurveyConfig().surveys[0],
                    opensAt: "2026-11-01T00:00:00+09:00",
                    closesAt: "2026-11-02T00:00:00+09:00",
                },
            ],
        })
        const noEarlier = await run(["add", "--file", "draft.json"], {
            ...deps(
                makeRemote({
                    async readConfigValue() {
                        return sameDayConfig
                    },
                }),
            ),
            now: () => new Date("2026-11-01T01:00:00+09:00"),
            readFile: () =>
                JSON.stringify({ ...updateDraft, closesAt: "2026-11-03" }),
        })
        expect(noEarlier.lines).toEqual([
            "error: refused: 前倒しできません。自然な終了と集計を待ってください。",
        ])
    })

    it("refuses a deadline change when either index contains the id and refuses reopening a closed survey", async () => {
        const aggregated = await run(["add", "--file", "draft.json"], {
            ...deps(
                makeRemote({
                    async readConfigValue() {
                        return configValue
                    },
                    async readIndex(env) {
                        return env === "develop" ? index(id) : undefined
                    },
                }),
            ),
            readFile: () =>
                JSON.stringify({ ...updateDraft, closesAt: "2026-11-30" }),
        })
        expect(aggregated.lines[0]).toMatch(/^error: refused:/)

        const closed = await run(["add", "--file", "draft.json"], {
            ...deps(
                makeRemote({
                    async readConfigValue() {
                        return configValue
                    },
                }),
            ),
            now: () => new Date("2026-12-02T00:00:00Z"),
            readFile: () =>
                JSON.stringify({ ...updateDraft, closesAt: "2026-12-31" }),
        })
        expect(closed.lines[0]).toContain(
            "終了済みのアンケートは再開できません",
        )
    })
})

describe("survey CLI status and output", () => {
    it("returns the heading and rows for config-only, r2-only, and invalid visibility records", async () => {
        const withConfigOnly = createValidSurveyConfig()
        withConfigOnly.surveys.push({
            ...withConfigOnly.surveys[0]!,
            id: "survey-config-only",
            opensAt: "2026-12-10T00:00:00+09:00",
            closesAt: "2026-12-20T00:00:00+09:00",
        })
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(withConfigOnly)
            },
            async readIndex() {
                return {
                    schemaVersion: 1,
                    surveys: [
                        ...index(id).surveys,
                        {
                            id: "survey-r2-only",
                            opensAt: "2026-10-01T00:00:00+09:00",
                            closesAt: "2026-11-01T00:00:00+09:00",
                            outcome: "result",
                        },
                    ],
                }
            },
            async readVisibility(_env, surveyId) {
                return surveyId === id ? "invalid" : "hidden"
            },
        })
        const result = await run(
            ["status", "--env", "production"],
            deps(remote),
        )
        expect(result.lines[0]).toMatch(
            /^status: env=production surveys 3, config \d+\.\d\/48 KB$/,
        )
        expect(
            result.lines.some(line => line.includes("!invalid-visibility")),
        ).toBe(true)
        expect(result.lines.some(line => line.endsWith("config"))).toBe(true)
        expect(result.lines.some(line => line.endsWith("r2-only"))).toBe(true)
        expect(result.lines.length).toBeGreaterThan(1)
    })

    it("returns the fixed empty heading and fails on an invalid index without exposing its body", async () => {
        const empty = await run(["status", "--env", "develop"], {
            ...deps(
                makeRemote({
                    async readConfigValue() {
                        return undefined
                    },
                    async readIndex() {
                        return undefined
                    },
                }),
            ),
        })
        expect(empty.lines).toEqual(["status: env=develop no surveys"])

        const invalid = await run(["status", "--env", "develop"], {
            ...deps(
                makeRemote({
                    async readIndex() {
                        throw Object.assign(new Error("BODY-SECRET"), {
                            kind: "parse",
                        })
                    },
                }),
            ),
        })
        expect(invalid.lines[0]).toMatch(/^error: invalid:/)
        expect(invalid.lines.join(" ")).not.toContain("BODY-SECRET")
    })

    it("uses one line for every non-status command and only fixed refusal text", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                return undefined
            },
            async readIndex() {
                return undefined
            },
        })
        const result = await run(["add", "--file", "draft.json"], {
            ...deps(remote),
            readFile: () => "SECRET-DRAFT",
        })
        expect(result.lines).toHaveLength(1)
        expect(result.lines.join(" ")).not.toContain("SECRET-DRAFT")
    })

    it("returns the fixed interim refusal for commands implemented by later tasks", async () => {
        const commands = [
            ["prune"],
            ["remove", id],
            ["publish", id, "--env", "develop"],
            ["unpublish", id, "--env", "production"],
        ]
        for (const command of commands) {
            const result = await run(command)
            expect(result.lines).toEqual([
                "error: refused: このコマンドはまだ使えません",
            ])
        }
    })
})
