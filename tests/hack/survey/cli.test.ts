import { describe, expect, test } from "vitest"

import { run } from "../../../hack/survey/cli"
import type { SurveyRemote } from "../../../hack/survey/remote"

const draft = {
    opensAt: "2026-11-01T00:00:00+09:00",
    closesAt: "2026-11-30T23:59:00+09:00",
    title: {
        ja: "Skyshare v1 と v2 どちらの UI が好みか",
        en: "Which Skyshare UI do you prefer, v1 or v2?",
    },
    questions: [
        {
            id: "preferred-ui",
            kind: "single",
            title: {
                ja: "どちらの UI が好みですか？",
                en: "Which UI do you prefer?",
            },
            options: [
                { id: "v1", label: { ja: "Skyshare v1", en: "Skyshare v1" } },
                { id: "v2", label: { ja: "Skyshare v2", en: "Skyshare v2" } },
                {
                    id: "decline",
                    label: { ja: "回答しない", en: "Prefer not to answer" },
                    decline: true,
                },
            ],
        },
    ],
}

const oldDraft = {
    ...draft,
    opensAt: "2026-09-01T00:00:00+09:00",
    closesAt: "2026-09-30T23:59:00+09:00",
}

const baseConfig = () => ({ surveys: [] as Record<string, unknown>[] })

const makeRemote = (value?: string) => {
    let configValue = value
    const calls = {
        reads: 0,
        writes: [] as string[],
        deletes: 0,
        rowChecks: [] as string[],
    }
    const remote: SurveyRemote = {
        readConfigValue: async () => {
            calls.reads += 1
            return configValue
        },
        writeConfigValue: async next => {
            calls.writes.push(next)
            configValue = next
        },
        deleteConfigValue: async () => {
            calls.deletes += 1
            configValue = undefined
        },
        hasRows: async id => {
            calls.rowChecks.push(id)
            return ["none", "none"]
        },
    }
    return {
        remote,
        calls,
        get value() {
            return configValue
        },
    }
}

const current = (surveys: Record<string, unknown>[]) =>
    JSON.stringify({ surveys })

describe("survey CLI", () => {
    test("adds a new survey and does not include config text in its one-line summary", async () => {
        const state = makeRemote()
        const result = await run(["add", "--file", "draft.json"], {
            remote: state.remote,
            readFile: () => JSON.stringify(draft),
        })

        expect(result.code).toBe(0)
        expect(result.line).toMatch(/^add: created 2026-11-1 /)
        expect(result.line).not.toContain("Skyshare v1")
        expect(result.line.split("\n")).toHaveLength(1)
        expect(state.calls.writes).toHaveLength(1)
    })

    test("updates an existing id and skips a write when unchanged", async () => {
        const existing = { ...draft, id: "preferred-ui" }
        const state = makeRemote(current([existing]))
        const updated = await run(["add", "--file", "draft.json"], {
            remote: state.remote,
            readFile: () =>
                JSON.stringify({
                    ...draft,
                    title: { ja: "別の題", en: "A different title" },
                    id: "preferred-ui",
                }),
        })
        expect(updated.line).toMatch(/^add: updated preferred-ui /)
        expect(state.calls.writes).toHaveLength(1)

        const unchangedState = makeRemote(state.value)
        const unchanged = await run(["add", "--file", "draft.json"], {
            remote: unchangedState.remote,
            readFile: () =>
                JSON.stringify({
                    ...draft,
                    title: { ja: "別の題", en: "A different title" },
                    id: "preferred-ui",
                }),
        })
        expect(unchanged.line).toMatch(/^add: unchanged preferred-ui /)
        expect(unchangedState.calls.writes).toHaveLength(0)
    })

    test("dry-run add and unset variable do not write", async () => {
        const state = makeRemote()
        const result = await run(["add", "--file", "draft.json", "--dry-run"], {
            remote: state.remote,
            readFile: () => JSON.stringify(draft),
        })
        expect(result.line).toMatch(/^\[dry-run\] add: created /)
        expect(state.calls.writes).toHaveLength(0)

        const none = await run(["status"], { remote: state.remote })
        expect(none).toEqual({ code: 0, line: "status: no surveys" })
    })

    test("status reads only config and reports phases and size", async () => {
        const state = makeRemote(current([{ ...draft, id: "ui-2026" }]))
        const result = await run(["status"], {
            remote: state.remote,
            now: () => new Date("2026-10-28T00:00:00Z"),
        })
        expect(result.line).toMatch(
            /^status: surveys 1 \[ui-2026 upcoming\] \d+\.\d\/48 KB$/,
        )
        expect(state.calls.rowChecks).toHaveLength(0)
        expect(state.calls.writes).toHaveLength(0)
        expect(state.calls.deletes).toBe(0)
    })

    test("prune queries only expired candidates, retains rows and unknown, and deletes when all are removed", async () => {
        const ended = {
            ...draft,
            id: "expired-ui",
            opensAt: "2026-08-01T00:00:00Z",
            closesAt: "2026-09-01T00:00:00Z",
        }
        const upcoming = {
            ...draft,
            id: "upcoming-ui",
            opensAt: "2027-01-01T00:00:00Z",
            closesAt: "2027-02-01T00:00:00Z",
        }
        const state = makeRemote(current([ended, upcoming]))
        state.remote.hasRows = async id => {
            state.calls.rowChecks.push(id)
            return id === "expired-ui"
                ? ["none", "none"]
                : ["unknown", "unknown"]
        }
        const result = await run(["prune"], {
            remote: state.remote,
            now: () => new Date("2026-10-02T00:00:00Z"),
        })
        expect(result.line).toContain("removed expired-ui")
        expect(state.calls.rowChecks).toEqual(["expired-ui"])
        expect(state.calls.writes).toHaveLength(1)
        expect(state.value).toContain("upcoming-ui")

        const allRemoved = makeRemote(current([ended]))
        const removed = await run(["prune"], {
            remote: allRemoved.remote,
            now: () => new Date("2026-10-02T00:00:00Z"),
        })
        expect(removed.line).toContain("removed expired-ui")
        expect(allRemoved.calls.deletes).toBe(1)
        expect(allRemoved.value).toBeUndefined()

        const repeated = await run(["prune"], {
            remote: allRemoved.remote,
            now: () => new Date("2026-10-02T00:00:00Z"),
        })
        expect(repeated.line).toBe("prune: nothing to remove")
        expect(allRemoved.calls.deletes).toBe(1)
    })

    test("does not query when there are no prune candidates and preserves a dry-run", async () => {
        const state = makeRemote(current([{ ...draft, id: "upcoming-ui" }]))
        const result = await run(["prune", "--dry-run"], {
            remote: state.remote,
            now: () => new Date("2026-10-01T00:00:00Z"),
        })
        expect(result.line).toBe("[dry-run] prune: nothing to remove")
        expect(state.calls.rowChecks).toHaveLength(0)
        expect(state.calls.writes).toHaveLength(0)

        const candidate = {
            ...draft,
            id: "expired-ui",
            opensAt: "2026-08-01T00:00:00Z",
            closesAt: "2026-09-01T00:00:00Z",
        }
        const candidateState = makeRemote(current([candidate]))
        const candidateResult = await run(["prune", "--dry-run"], {
            remote: candidateState.remote,
            now: () => new Date("2026-10-02T00:00:00Z"),
        })
        expect(candidateResult.line).toMatch(
            /^\[dry-run\] prune: would remove expired-ui/,
        )
        expect(candidateState.calls.rowChecks).toEqual(["expired-ui"])
        expect(candidateState.calls.writes).toHaveLength(0)
        expect(candidateState.calls.deletes).toBe(0)
    })

    test("keeps candidates when either environment has rows or cannot be checked", async () => {
        const rows = {
            ...draft,
            id: "rows-ui",
            opensAt: "2026-08-01T00:00:00Z",
            closesAt: "2026-09-01T00:00:00Z",
        }
        const uncertain = {
            ...draft,
            id: "unknown-ui",
            opensAt: "2026-07-01T00:00:00Z",
            closesAt: "2026-08-01T00:00:00Z",
        }
        const state = makeRemote(current([rows, uncertain]))
        state.remote.hasRows = async id =>
            id === "rows-ui" ? ["present", "none"] : ["unknown", "none"]
        const result = await run(["prune"], {
            remote: state.remote,
            now: () => new Date("2026-10-02T00:00:00Z"),
        })
        expect(result.line).toContain("rows-ui(rows)")
        expect(result.line).toContain("unknown-ui(unknown)")
        expect(state.calls.writes).toHaveLength(0)
        expect(state.calls.deletes).toBe(0)
    })

    test("returns one fixed error line for invalid arguments and invalid old config", async () => {
        const bad = makeRemote("not valid json")
        const result = await run(["status"], { remote: bad.remote })
        expect(result).toEqual({
            code: 1,
            line: "error: invalid: 設定を読み取れません",
        })
        expect(result.line.split("\n")).toHaveLength(1)
        expect((await run(["add"])).line).toMatch(/^error: usage:/)
    })
})
