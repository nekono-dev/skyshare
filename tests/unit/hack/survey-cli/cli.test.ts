/**
 * survey CLI の登録・状態確認の流れと、固定された出力を確認する。
 */
import { describe, expect, it, vi } from "vitest"

import { createValidSurveyConfig } from "../../../fixtures/survey/config"
import newDraft from "../../../fixtures/survey-operation/without-id.json"
import updateDraft from "../../../fixtures/survey-operation/with-id.json"
import { run } from "../../../../hack/survey-cli/cli"
import {
    RemoteError,
    type SurveyRemote,
} from "../../../../hack/survey-cli/remote"

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
const validResult = (surveyId: string) => ({
    schemaVersion: 1 as const,
    id: surveyId,
    opensAt: "2026-11-01T00:00:00+09:00",
    closesAt: "2026-12-01T00:00:00+09:00",
    questions: [
        {
            id: "q-purpose",
            kind: "single" as const,
            title: { ja: "主な目的は？", en: "Main purpose?" },
            options: [
                {
                    id: "share",
                    label: { ja: "共有", en: "Share" },
                    percent: 100,
                },
            ],
        },
    ],
})

const makeRemote = (
    overrides: Partial<SurveyRemote> = {},
    calls: string[] = [],
): SurveyRemote => ({
    async readConfigValue(_env) {
        calls.push("config")
        return configValue
    },
    async writeConfigValue(_env, _value) {
        calls.push("write")
    },
    async deleteConfigValue(_env) {
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
    it("allows an empty config and reads only the selected index", async () => {
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
        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            {
                ...deps(remote),
                createId,
            },
        )
        expect(result.lines[0]).toMatch(/^add: created /)
        expect(calls).toEqual(["config", "index:develop", "write"])
        expect(createId).toHaveBeenCalledOnce()
    })

    it("allows registration when every configured id exists in the selected index", async () => {
        const calls: string[] = []
        const remote = makeRemote({
            async readConfigValue() {
                const past = createValidSurveyConfig()
                past.surveys[0]!.opensAt = "2026-10-01T00:00:00+09:00"
                past.surveys[0]!.closesAt = "2026-11-01T00:00:00+09:00"
                return JSON.stringify(past)
            },
            async readIndex(env) {
                calls.push(env)
                return index(id)
            },
        })
        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            deps(remote),
        )
        expect(result.code).toBe(0)
        expect(result.lines).toHaveLength(1)
        expect(calls).toEqual(["develop"])
    })

    it("refuses when a before-start configured id is missing from the selected index", async () => {
        const beforeStart = JSON.parse(configValue)
        beforeStart.surveys[0].opensAt = "2026-11-17T00:00:00+09:00"
        beforeStart.surveys[0].closesAt = "2026-11-19T00:00:00+09:00"
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(beforeStart)
            },
            async readIndex(env) {
                return env === "production" ? index(id) : undefined
            },
        })
        const createId = vi.fn(() => generatedId)
        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            {
                ...deps(remote),
                createId,
                readFile: () =>
                    JSON.stringify({ ...newDraft, closesAt: "2026-11-16" }),
            },
        )
        expect(result.lines).toEqual([
            "error: refused: この環境に未集計のアンケートがあります。集計を待つか、開始前なら remove、開催中なら締切を前倒しして配備し、集計を待ってください。",
        ])
        expect(createId).not.toHaveBeenCalled()
    })

    it("treats a zero-response record as aggregated", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                const past = createValidSurveyConfig()
                past.surveys[0]!.opensAt = "2026-10-01T00:00:00+09:00"
                past.surveys[0]!.closesAt = "2026-11-01T00:00:00+09:00"
                return JSON.stringify(past)
            },
            async readIndex() {
                return {
                    schemaVersion: 1 as const,
                    surveys: [
                        {
                            id,
                            opensAt: "2026-10-01T00:00:00+09:00",
                            closesAt: "2026-11-01T00:00:00+09:00",
                            outcome: "empty" as const,
                        },
                    ],
                }
            },
        })
        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            deps(remote),
        )
        expect(result.code).toBe(0)
    })

    it.each(["auth", "unavailable", "parse"] as const)(
        "fails closed on %s index read errors without exposing secrets",
        async kind => {
            const writeConfigValue = vi.fn()
            const remote = makeRemote({
                async readIndex(env) {
                    if (env === "develop")
                        throw Object.assign(new Error("BODY-SECRET"), { kind })
                    return undefined
                },
                writeConfigValue,
            })
            const result = await run(
                ["add", "--file", "draft.json", "--env", "develop"],
                deps(remote),
            )
            expect(result.code).toBe(1)
            expect(result.lines.join(" ")).not.toContain("BODY-SECRET")
            expect(result.lines[0]).toMatch(
                /^error: (auth|unavailable|invalid):/,
            )
            expect(writeConfigValue).not.toHaveBeenCalled()
        },
    )

    it("rejects a returned index that does not pass the shared schema", async () => {
        const writeConfigValue = vi.fn()
        const remote = makeRemote({
            async readIndex() {
                return {
                    schemaVersion: 99,
                    surveys: [],
                    secret: "BODY-SECRET",
                } as never
            },
            writeConfigValue,
        })
        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            deps(remote),
        )
        expect(result.lines[0]).toMatch(/^error: invalid:/)
        expect(result.lines.join(" ")).not.toContain("BODY-SECRET")
        expect(writeConfigValue).not.toHaveBeenCalled()
    })

    it("dry-run reads only the selected index and does not write or issue an id", async () => {
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
        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop", "--dry-run"],
            {
                ...deps(remote),
                createId,
            },
        )
        expect(result.lines[0]).toMatch(/^\[dry-run\] add: created /)
        expect(calls).toEqual(["config", "index:develop"])
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
            ["add", "--file", "draft.json", "--env", "develop", "--dry-run"],
            deps(remote),
        )
        const real = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            deps(remote),
        )

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
        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            deps(remote),
        )
        expect(result.lines).toHaveLength(1)
        expect(result.code).toBe(0)
    })

    it("returns not-found for an unknown explicit id without creating a survey", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                return configValue
            },
        })
        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            {
                ...deps(remote),
                readFile: () =>
                    JSON.stringify({ ...updateDraft, id: "survey-missing" }),
            },
        )
        expect(result.lines[0]).toMatch(/^error: not-found:/)
    })

    it("refuses a deadline at or after the current deadline", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                return configValue
            },
        })
        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            {
                ...deps(remote),
                readFile: () =>
                    JSON.stringify({ ...updateDraft, closesAt: "2026-12-02" }),
            },
        )
        expect(result.lines[0]).toContain("締切は現在の締切より前の日付")
    })

    it("refuses a deadline at or before opening and uses the fixed no-earlier-midnight sentence", async () => {
        const remote = makeRemote({
            async readConfigValue() {
                return configValue
            },
        })
        const atOpening = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            {
                ...deps(remote),
                readFile: () =>
                    JSON.stringify({ ...updateDraft, closesAt: "2026-11-01" }),
            },
        )
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
        const noEarlier = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            {
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
            },
        )
        expect(noEarlier.lines).toEqual([
            "error: refused: 前倒しできません。自然な終了と集計を待ってください。",
        ])
    })

    it("refuses a deadline change only when the selected index contains the id and refuses reopening a closed survey", async () => {
        const aggregated = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            {
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
            },
        )
        expect(aggregated.lines[0]).toMatch(/^error: refused:/)

        const closed = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            {
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
            },
        )
        expect(closed.lines[0]).toContain(
            "終了済みのアンケートは再開できません",
        )

        const otherEnvironmentOnly = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            {
                ...deps(
                    makeRemote({
                        async readConfigValue() {
                            return configValue
                        },
                        async readIndex(env) {
                            return env === "production" ? index(id) : undefined
                        },
                    }),
                ),
                readFile: () =>
                    JSON.stringify({ ...updateDraft, closesAt: "2026-11-30" }),
            },
        )
        expect(otherEnvironmentOnly.code).toBe(0)
        expect(otherEnvironmentOnly.lines[0]).toMatch(/^add: updated /)
    })

    it("refuses registration when the configured id is recorded only in the other environment", async () => {
        const past = createValidSurveyConfig()
        past.surveys[0]!.opensAt = "2026-10-01T00:00:00+09:00"
        past.surveys[0]!.closesAt = "2026-11-01T00:00:00+09:00"
        const selectedReads: string[] = []
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(past)
            },
            async readIndex(env) {
                selectedReads.push(env)
                return env === "production" ? undefined : index(id)
            },
        })

        const result = await run(
            ["add", "--file", "draft.json", "--env", "production"],
            deps(remote),
        )

        expect(result.code).toBe(1)
        expect(result.lines[0]).toBe(
            "error: refused: この環境に未集計のアンケートがあります。集計を待つか、開始前なら remove、開催中なら締切を前倒しして配備し、集計を待ってください。",
        )
        expect(selectedReads).toEqual(["production"])
    })

    it("keeps identical drafts and issued identifiers independent across environments", async () => {
        const configReads: string[] = []
        const configs = new Map<string, string | undefined>([
            ["production", undefined],
            ["develop", undefined],
        ])
        const writes: Array<[string, string]> = []
        const remote = makeRemote({
            async readConfigValue(env) {
                configReads.push(env)
                return configs.get(env)
            },
            async readIndex() {
                return undefined
            },
            async writeConfigValue(env, value) {
                writes.push([env, value])
                configs.set(env, value)
            },
        })
        const issueIds = vi
            .fn()
            .mockReturnValueOnce("123e4567-e89b-42d3-a456-426614174001")
            .mockReturnValueOnce("123e4567-e89b-42d3-a456-426614174002")
        const args = ["add", "--file", "draft.json"]

        const production = await run([...args, "--env", "production"], {
            ...deps(remote),
            createId: issueIds,
        })
        const develop = await run([...args, "--env", "develop"], {
            ...deps(remote),
            createId: issueIds,
        })

        expect(production.code).toBe(0)
        expect(develop.code).toBe(0)
        expect(configReads).toEqual(["production", "develop"])
        expect(writes.map(([env]) => env)).toEqual(["production", "develop"])
        expect(JSON.parse(configs.get("production")!).surveys[0].id).toBe(
            "123e4567-e89b-42d3-a456-426614174001",
        )
        expect(JSON.parse(configs.get("develop")!).surveys[0].id).toBe(
            "123e4567-e89b-42d3-a456-426614174002",
        )
    })

    it("rejects a config that exceeds the environment variable byte limit", async () => {
        const oversized = {
            ...newDraft,
            questions: newDraft.questions.map(question => ({
                ...question,
                title: { ja: "調査".repeat(9000), en: "Survey" },
            })),
        }
        const remote = makeRemote({
            async readConfigValue() {
                return undefined
            },
            async readIndex() {
                return undefined
            },
            async writeConfigValue() {
                throw new Error("oversized config must not be written")
            },
        })

        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            deps(remote, { readFile: () => JSON.stringify(oversized) }),
        )

        expect(result.lines[0]).toMatch(/^error: too-large:/)
    })
})

describe("survey CLI status and output", () => {
    it("reads only the selected environment config and formats its byte size in decimal KB", async () => {
        const selected = createValidSurveyConfig()
        selected.surveys[0]!.questions[0]!.title.ja = "調査".repeat(600)
        const selectedValue = JSON.stringify(selected)
        const configReads: string[] = []
        const remote = makeRemote({
            async readConfigValue(env) {
                configReads.push(env)
                return env === "develop" ? selectedValue : undefined
            },
            async readIndex() {
                return undefined
            },
        })

        const result = await run(["status", "--env", "develop"], deps(remote))

        expect(configReads).toEqual(["develop"])
        expect(result.lines[0]).toBe(
            `status: env=develop surveys 1, config ${(Buffer.byteLength(selectedValue) / 1000).toFixed(1)}/48 KB`,
        )
    })

    it("treats a missing selected environment config as empty", async () => {
        const configReads: string[] = []
        const remote = makeRemote({
            async readConfigValue(env) {
                configReads.push(env)
                return undefined
            },
            async readIndex() {
                return undefined
            },
        })

        const result = await run(
            ["status", "--env", "production"],
            deps(remote),
        )

        expect(configReads).toEqual(["production"])
        expect(result.lines).toEqual(["status: env=production no surveys"])
    })

    it("maps an uncreated environment write to the fixed failure line", async () => {
        const remote = makeRemote({
            async readConfigValue(_env) {
                return JSON.stringify({ surveys: [] })
            },
            async readIndex() {
                return undefined
            },
            async writeConfigValue(_env, _value) {
                throw new RemoteError("no-environment")
            },
        })

        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            deps(remote),
        )

        expect(result).toEqual({
            code: 1,
            lines: [
                "error: no-environment: GitHub の環境が未作成か、権限が足りません。DEVELOP.md 6.2.1 の手順で環境を作り、gh auth status で権限を確かめてください",
            ],
        })
    })

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
                        return {
                            schemaVersion: 99,
                            surveys: [],
                            secret: "BODY-SECRET",
                        } as never
                    },
                }),
            ),
        })
        expect(invalid.lines).toEqual([
            "error: invalid: 目録の形式が正しくありません",
        ])
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
        const result = await run(
            ["add", "--file", "draft.json", "--env", "develop"],
            {
                ...deps(remote),
                readFile: () => "SECRET-DRAFT",
            },
        )
        expect(result.lines).toHaveLength(1)
        expect(result.lines.join(" ")).not.toContain("SECRET-DRAFT")
    })

    it("publishes an indexed result and starts the selected deployment", async () => {
        const calls: string[] = []
        const config = createValidSurveyConfig()
        config.surveys[0]!.closesAt = "2026-11-10T00:00:00+09:00"
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(config)
            },
            async readIndex() {
                calls.push("index")
                return {
                    schemaVersion: 1,
                    surveys: [
                        {
                            id,
                            opensAt: "2026-11-01T00:00:00+09:00",
                            closesAt: "2026-11-10T00:00:00+09:00",
                            outcome: "result",
                        },
                    ],
                }
            },
            async readVisibility() {
                calls.push("visibility")
                return "hidden"
            },
            async readResult() {
                calls.push("result")
                return {
                    schemaVersion: 1,
                    id,
                    opensAt: "2026-11-01T00:00:00+09:00",
                    closesAt: "2026-11-10T00:00:00+09:00",
                    questions: [
                        {
                            id: "q-purpose",
                            kind: "single",
                            title: { ja: "主な目的は？", en: "Main purpose?" },
                            options: [
                                {
                                    id: "share",
                                    label: { ja: "共有", en: "Share" },
                                    percent: 100,
                                },
                            ],
                        },
                    ],
                }
            },
            async writeVisibility(env, surveyId, visible) {
                calls.push(`write:${env}:${surveyId}:${visible}`)
            },
            async startDeploy(ref) {
                calls.push(`deploy:${ref}`)
            },
        })
        const result = await run(["publish", id, "--env", "develop"], {
            ...deps(remote),
            now: () => new Date("2026-11-15T12:00:00Z"),
        })
        expect(result).toEqual({
            code: 0,
            lines: [
                "publish: published survey-2026-a (develop); deploy started (develop)",
            ],
        })
        expect(calls).toEqual([
            "index",
            "visibility",
            "result",
            "write:develop:survey-2026-a:true",
            "deploy:develop",
        ])
    })

    it.each([
        [
            "upcoming",
            "2026-11-20T00:00:00+09:00",
            "result",
            "results would be lost",
        ],
        [
            "active",
            "2026-11-15T00:00:00+09:00",
            "result",
            "results would be lost",
        ],
        ["closed", undefined, undefined, "not aggregated: develop"],
        ["empty", "2026-11-10T00:00:00+09:00", "empty", "nothing to publish"],
    ] as const)(
        "refuses a %s survey before writing",
        async (stage, opensAt, outcome, reason) => {
            const calls: string[] = []
            const config = createValidSurveyConfig()
            if (stage !== "closed") {
                config.surveys[0]!.opensAt = opensAt!
                config.surveys[0]!.closesAt = "2026-12-01T00:00:00+09:00"
            }
            const remote = makeRemote({
                async readConfigValue() {
                    return JSON.stringify(config)
                },
                async readIndex() {
                    return outcome
                        ? {
                              schemaVersion: 1,
                              surveys: [
                                  {
                                      id,
                                      opensAt: "2026-11-01T00:00:00+09:00",
                                      closesAt: "2026-11-10T00:00:00+09:00",
                                      outcome,
                                  },
                              ],
                          }
                        : undefined
                },
                async readVisibility() {
                    return "hidden"
                },
                async writeVisibility() {
                    calls.push("write")
                },
                async startDeploy() {
                    calls.push("deploy")
                },
            })
            const result = await run(["publish", id, "--env", "develop"], {
                ...deps(remote),
                now: () =>
                    new Date(
                        stage === "upcoming"
                            ? "2026-11-15T00:00:00Z"
                            : stage === "active"
                              ? "2026-11-15T12:00:00Z"
                              : "2027-01-01T00:00:00Z",
                    ),
            })
            expect(result.lines[0]).toContain(`is ${stage}: ${reason}`)
            expect(calls).toEqual([])
        },
    )

    it("refuses an unknown id and invalid or mismatched results without writing", async () => {
        const calls: string[] = []
        const remote = makeRemote({
            async readIndex() {
                return index(id)
            },
            async readVisibility() {
                return "hidden"
            },
            async readResult() {
                return { broken: "SECRET" } as never
            },
            async writeVisibility() {
                calls.push("write")
            },
        })
        const lateDeps = {
            ...deps(remote),
            now: () => new Date("2027-01-01T00:00:00Z"),
        }
        const missing = await run(
            ["publish", "survey-2026-b", "--env", "develop"],
            lateDeps,
        )
        expect(missing.lines[0]).toMatch(/^error: not-found:/)
        const invalid = await run(["publish", id, "--env", "develop"], lateDeps)
        expect(invalid.lines).toEqual([
            "error: invalid: 結果が目録と一致しません",
        ])
        expect(invalid.lines.join(" ")).not.toContain("SECRET")
        const mismatchRemote = makeRemote({
            async readIndex() {
                return index(id)
            },
            async readVisibility() {
                return "hidden"
            },
            async readResult() {
                return validResult("survey-2026-b")
            },
            async writeVisibility() {
                calls.push("write")
            },
        })
        const mismatch = await run(["publish", id, "--env", "develop"], {
            ...deps(mismatchRemote),
            now: () => new Date("2027-01-01T00:00:00Z"),
        })
        expect(mismatch.lines).toEqual([
            "error: invalid: 結果が目録と一致しません",
        ])
        expect(calls).toEqual([])
    })

    it("unpublishes despite a broken result body and overwrites invalid visibility", async () => {
        const calls: string[] = []
        const remote = makeRemote({
            async readIndex() {
                return index(id)
            },
            async readVisibility() {
                return "invalid"
            },
            async readResult() {
                calls.push("result")
                throw Object.assign(new Error("SECRET"), { kind: "parse" })
            },
            async writeVisibility(env, surveyId, visible) {
                calls.push(`write:${env}:${surveyId}:${visible}`)
            },
        })
        const result = await run(
            ["unpublish", id, "--env", "develop", "--no-deploy"],
            { ...deps(remote), now: () => new Date("2027-01-01T00:00:00Z") },
        )
        expect(result.lines).toEqual([
            "unpublish: hidden survey-2026-a (develop); deploy skipped (--no-deploy)",
        ])
        expect(calls).toEqual(["write:develop:survey-2026-a:false"])
    })

    it("overwrites invalid visibility when publishing instead of treating it as unchanged", async () => {
        const calls: string[] = []
        const remote = makeRemote({
            async readIndex() {
                return index(id)
            },
            async readVisibility() {
                return "invalid"
            },
            async readResult() {
                return validResult(id)
            },
            async writeVisibility(env, surveyId, visible) {
                calls.push(`write:${env}:${surveyId}:${visible}`)
            },
        })
        const result = await run(
            ["publish", id, "--env", "develop", "--no-deploy"],
            { ...deps(remote), now: () => new Date("2027-01-01T00:00:00Z") },
        )
        expect(result.lines).toEqual([
            "publish: published survey-2026-a (develop); deploy skipped (--no-deploy)",
        ])
        expect(calls).toEqual(["write:develop:survey-2026-a:true"])
    })

    it("starts deployment without rewriting an already desired flag", async () => {
        const calls: string[] = []
        const remote = makeRemote({
            async readIndex() {
                return index(id)
            },
            async readVisibility() {
                return "visible"
            },
            async readResult() {
                return validResult(id)
            },
            async writeVisibility() {
                calls.push("write")
            },
            async startDeploy(ref) {
                calls.push(`deploy:${ref}`)
            },
        })
        const result = await run(["publish", id, "--env", "develop"], {
            ...deps(remote),
            now: () => new Date("2027-01-01T00:00:00Z"),
        })
        expect(result.lines).toEqual([
            "publish: unchanged survey-2026-a (develop); deploy started (develop)",
        ])
        expect(calls).toEqual(["deploy:develop"])
    })

    it("does not write when production has no release branch", async () => {
        const calls: string[] = []
        const remote = makeRemote({
            async readIndex() {
                return index(id)
            },
            async readVisibility() {
                return "hidden"
            },
            async readResult() {
                return validResult(id)
            },
            async listReleaseBranches() {
                return []
            },
            async writeVisibility() {
                calls.push("write")
            },
        })
        const lateDeps = {
            ...deps(remote),
            now: () => new Date("2027-01-01T00:00:00Z"),
        }
        const result = await run(
            ["publish", id, "--env", "production"],
            lateDeps,
        )
        expect(result.lines[0]).toMatch(/^error: no-release:/)
        expect(calls).toEqual([])
    })

    it("reports deploy failure after saving the flag and supports dry-run without side effects", async () => {
        const calls: string[] = []
        const remote = makeRemote({
            async readIndex() {
                return index(id)
            },
            async readVisibility() {
                return "hidden"
            },
            async readResult() {
                return validResult(id)
            },
            async listReleaseBranches() {
                return [
                    { name: "release/a", committedAt: "2026-01-01T00:00:00Z" },
                    { name: "release/z", committedAt: "2026-01-01T00:00:00Z" },
                ]
            },
            async writeVisibility() {
                calls.push("write")
            },
            async startDeploy(ref) {
                calls.push(`deploy:${ref}`)
                throw new Error("SECRET")
            },
        })
        const lateDeps = {
            ...deps(remote),
            now: () => new Date("2027-01-01T00:00:00Z"),
        }
        const failed = await run(
            ["publish", id, "--env", "production"],
            lateDeps,
        )
        expect(failed.lines).toEqual([
            "error: deploy: 可視フラグは保存済み。同じコマンドの再実行で配備だけを起動できる",
        ])
        expect(failed.lines.join(" ")).not.toContain("SECRET")
        expect(calls).toEqual(["write", "deploy:release/z"])
        calls.length = 0
        const dryRun = await run(
            ["publish", id, "--env", "production", "--dry-run"],
            lateDeps,
        )
        expect(dryRun.lines).toEqual([
            "[dry-run] publish: would publish survey-2026-a (production); would deploy release/z",
        ])
        expect(calls).toEqual([])
    })

    it("prunes a recorded closed survey using only the selected index and deletes its config", async () => {
        const pastSurvey = createValidSurveyConfig()
        pastSurvey.surveys[0]!.opensAt = "2026-10-01T00:00:00Z"
        pastSurvey.surveys[0]!.closesAt = "2026-11-01T00:00:00Z"
        const calls: string[] = []
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(pastSurvey)
            },
            async readIndex(env) {
                calls.push(`index:${env}`)
                return index(id)
            },
            async writeConfigValue() {
                calls.push("write")
            },
            async deleteConfigValue() {
                calls.push("delete")
            },
        })
        const result = await run(["prune", "--env", "develop"], deps(remote))
        expect(result).toEqual({
            code: 0,
            lines: ["prune: removed survey-2026-a (surveys 1 -> 0)"],
        })
        expect(calls).toEqual(["index:develop", "delete"])
    })

    it("keeps an unaggregated closed survey with the selected environment and guidance", async () => {
        const pastSurvey = createValidSurveyConfig()
        pastSurvey.surveys[0]!.opensAt = "2026-10-01T00:00:00Z"
        pastSurvey.surveys[0]!.closesAt = "2026-11-01T00:00:00Z"
        const calls: string[] = []
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(pastSurvey)
            },
            async readIndex(env) {
                calls.push(`index:${env}`)
                return undefined
            },
            async writeConfigValue() {
                calls.push("write")
            },
            async deleteConfigValue() {
                calls.push("delete")
            },
        })
        const result = await run(["prune", "--env", "develop"], deps(remote))
        expect(result.lines[0]).toContain(
            "kept survey-2026-a(not-aggregated: develop)",
        )
        expect(result.lines[0]).toMatch(
            / ; see DEVELOP\.md 5\.4 \/ survey-run \(not-aggregated\)$/,
        )
        expect(calls).toEqual(["index:develop"])
    })

    it("removes recorded closed surveys, keeps unrecorded closed surveys, and writes the selected config", async () => {
        const config = createValidSurveyConfig()
        config.surveys[0]!.opensAt = "2026-10-01T00:00:00Z"
        config.surveys[0]!.closesAt = "2026-11-01T00:00:00Z"
        config.surveys.push({
            ...config.surveys[0]!,
            id: "survey-2026-b",
            opensAt: "2026-08-01T00:00:00Z",
            closesAt: "2026-09-01T00:00:00Z",
        })
        const calls: string[] = []
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(config)
            },
            async readIndex(env) {
                calls.push(`index:${env}`)
                return index(id)
            },
            async writeConfigValue(env, value) {
                calls.push(
                    `write:${env}:${JSON.parse(value)
                        .surveys.map((item: { id: string }) => item.id)
                        .join(",")}`,
                )
            },
            async deleteConfigValue(env) {
                calls.push(`delete:${env}`)
            },
        })
        const result = await run(["prune", "--env", "develop"], deps(remote))
        expect(result.lines[0]).toBe(
            "prune: removed survey-2026-a (surveys 2 -> 1); kept survey-2026-b(not-aggregated: develop) ; see DEVELOP.md 5.4 / survey-run (not-aggregated)",
        )
        expect(calls).toEqual(["index:develop", "write:develop:survey-2026-b"])
    })

    it.each([
        ["before-start", "2026-11-17T00:00:00Z", "2026-11-19T00:00:00Z"],
        ["active", "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"],
    ])(
        "does not prune a %s survey even when its id is recorded",
        async (_stage, opensAt, closesAt) => {
            const config = createValidSurveyConfig()
            config.surveys[0]!.opensAt = opensAt
            config.surveys[0]!.closesAt = closesAt
            const calls: string[] = []
            const remote = makeRemote({
                async readConfigValue() {
                    return JSON.stringify(config)
                },
                async readIndex(env) {
                    calls.push(`index:${env}`)
                    return index(id)
                },
                async writeConfigValue() {
                    calls.push("write")
                },
                async deleteConfigValue() {
                    calls.push("delete")
                },
            })
            const result = await run(
                ["prune", "--env", "develop"],
                deps(remote),
            )
            expect(result.lines).toEqual(["prune: nothing to remove"])
            expect(calls).toEqual(["index:develop"])
        },
    )

    it.each(["auth", "unavailable", "parse"] as const)(
        "does not modify config when the %s index read fails for prune or remove",
        async kind => {
            const calls: string[] = []
            const remote = makeRemote({
                async readIndex(env) {
                    calls.push(`index:${env}`)
                    throw Object.assign(new Error("SECRET"), { kind })
                },
                async writeConfigValue() {
                    calls.push("write")
                },
                async deleteConfigValue() {
                    calls.push("delete")
                },
            })
            const prune = await run(["prune", "--env", "develop"], deps(remote))
            const remove = await run(
                ["remove", id, "--env", "develop"],
                deps(remote),
            )
            expect(prune.code).toBe(1)
            expect(remove.code).toBe(1)
            expect(`${prune.lines} ${remove.lines}`).not.toContain("SECRET")
            expect(calls).toEqual(["index:develop", "index:develop"])
        },
    )

    it("removes a configured survey before its start without requiring aggregation", async () => {
        const config = createValidSurveyConfig()
        config.surveys[0]!.opensAt = "2026-11-20T00:00:00Z"
        const calls: string[] = []
        const remote = makeRemote({
            async readIndex(env) {
                calls.push(`index:${env}`)
                return undefined
            },
            async readConfigValue() {
                return JSON.stringify(config)
            },
            async writeConfigValue(env, value) {
                calls.push(`write:${env}:${JSON.parse(value).surveys.length}`)
            },
            async deleteConfigValue(env) {
                calls.push(`delete:${env}`)
            },
        })
        const result = await run(
            ["remove", id, "--env", "develop"],
            deps(remote),
        )
        expect(result).toEqual({
            code: 0,
            lines: ["remove: removed survey-2026-a (surveys 1 -> 0)"],
        })
        expect(calls).toEqual(["index:develop", "delete:develop"])
    })

    it("refuses active removal with a result-loss message and leaves config unchanged", async () => {
        const config = createValidSurveyConfig()
        config.surveys[0]!.opensAt = "2026-11-01T00:00:00Z"
        config.surveys[0]!.closesAt = "2026-12-01T00:00:00Z"
        const writes = vi.fn()
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(config)
            },
            async readIndex() {
                return index(id)
            },
            writeConfigValue: writes,
            deleteConfigValue: writes,
        })
        const active = await run(
            ["remove", id, "--env", "develop"],
            deps(remote),
        )
        expect(active.lines[0]).toContain(
            "error: refused: survey-2026-a is active",
        )
        expect(active.lines[0]).toContain("results would be lost")
        expect(writes).not.toHaveBeenCalled()
    })

    it("refuses unaggregated closed removal with a result-loss message and selected-environment guidance", async () => {
        const config = createValidSurveyConfig()
        config.surveys[0]!.opensAt = "2026-10-01T00:00:00Z"
        config.surveys[0]!.closesAt = "2026-11-01T00:00:00Z"
        const writes = vi.fn()
        const closedRemote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(config)
            },
            async readIndex() {
                return undefined
            },
            writeConfigValue: writes,
            deleteConfigValue: writes,
        })
        const closed = await run(
            ["remove", id, "--env", "develop"],
            deps(closedRemote),
        )
        expect(closed.lines[0]).toContain(
            "results would be lost; not aggregated: develop",
        )
        expect(closed.lines[0]).toMatch(
            / ; see DEVELOP\.md 5\.4 \/ survey-run \(not-aggregated\)$/,
        )
        expect(writes).not.toHaveBeenCalled()
    })

    it("removes a closed and aggregated survey through deleteConfigValue", async () => {
        const config = createValidSurveyConfig()
        config.surveys[0]!.opensAt = "2026-10-01T00:00:00Z"
        config.surveys[0]!.closesAt = "2026-11-01T00:00:00Z"
        const calls: string[] = []
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(config)
            },
            async readIndex(env) {
                calls.push(`index:${env}`)
                return index(id)
            },
            async writeConfigValue(env) {
                calls.push(`write:${env}`)
            },
            async deleteConfigValue(env) {
                calls.push(`delete:${env}`)
            },
        })
        const result = await run(
            ["remove", id, "--env", "develop"],
            deps(remote),
        )
        expect(result.lines[0]).toBe(
            "remove: removed survey-2026-a (surveys 1 -> 0)",
        )
        expect(calls).toEqual(["index:develop", "delete:develop"])
    })

    it("fails closed on a malformed selected index without touching either config", async () => {
        const calls: string[] = []
        const remote = makeRemote({
            async readIndex(env) {
                calls.push(`index:${env}`)
                return { schemaVersion: 99, surveys: [] } as never
            },
            async writeConfigValue() {
                calls.push("write")
            },
            async deleteConfigValue() {
                calls.push("delete")
            },
        })
        const prune = await run(["prune", "--env", "develop"], deps(remote))
        const remove = await run(
            ["remove", id, "--env", "develop"],
            deps(remote),
        )
        expect(prune.lines[0]).toMatch(/^error: invalid:/)
        expect(remove.lines[0]).toMatch(/^error: invalid:/)
        expect(calls).toEqual(["index:develop", "index:develop"])
    })

    it("reports missing ids and supports dry-run without writing or deleting", async () => {
        const calls: string[] = []
        const remote = makeRemote({
            async readConfigValue() {
                return JSON.stringify({ surveys: [] })
            },
            async writeConfigValue() {
                calls.push("write")
            },
            async deleteConfigValue() {
                calls.push("delete")
            },
        })
        expect(
            (await run(["remove", id, "--env", "develop"], deps(remote)))
                .lines[0],
        ).toMatch(/^error: not-found:/)
        expect(
            (await run(["prune", "--env", "develop"], deps(remote))).lines,
        ).toEqual(["prune: nothing to remove"])
        const pastSurvey = createValidSurveyConfig()
        pastSurvey.surveys[0]!.opensAt = "2026-10-01T00:00:00Z"
        pastSurvey.surveys[0]!.closesAt = "2026-11-01T00:00:00Z"
        const dryRemote = makeRemote({
            async readConfigValue() {
                return JSON.stringify(pastSurvey)
            },
            async readIndex() {
                return index(id)
            },
            async writeConfigValue() {
                calls.push("write")
            },
            async deleteConfigValue() {
                calls.push("delete")
            },
        })
        const dryRemove = await run(
            ["remove", id, "--env", "develop", "--dry-run"],
            deps(dryRemote),
        )
        expect(dryRemove.lines[0]).toContain(
            "[dry-run] remove: would remove survey-2026-a",
        )
        const dryPrune = await run(
            ["prune", "--env", "develop", "--dry-run"],
            deps(dryRemote),
        )
        expect(dryPrune.code).toBe(0)
        expect(dryPrune.lines[0]).toBe(
            "[dry-run] prune: would remove survey-2026-a (surveys 1 -> 0)",
        )
        expect(calls).toEqual([])
    })
})
