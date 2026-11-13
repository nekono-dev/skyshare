/**
 * 結果保管先の R2 読み書きと固定された失敗分類を確認する。
 */
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
    createSurveyRemote,
    RemoteError,
} from "../../../../hack/survey-cli/remote"
import type {
    CommandResult,
    RunCommand,
} from "../../../../hack/survey-cli/remote"

const id = "123e4567-e89b-42d3-a456-426614174000"
const resultBody = {
    schemaVersion: 1,
    id,
    opensAt: "2026-11-01T00:00:00+09:00",
    closesAt: "2026-12-01T00:00:00+09:00",
    questions: [],
}
const indexBody = {
    schemaVersion: 1,
    surveys: [],
}
const makeRunner =
    (
        response: {
            status?: number
            stdout?: string
            stderr?: string
            body?: unknown
        },
        calls: {
            command: string
            args: string[]
            input?: string
            fileBody?: string
        }[],
    ): RunCommand =>
    (command, args, input): CommandResult => {
        const call = { command, args, input } as (typeof calls)[number]
        calls.push(call)
        if (command === "wrangler") {
            const file = args[args.indexOf("--file") + 1]
            if ((response.status ?? 0) === 0 && response.body !== undefined) {
                writeFileSync(file!, JSON.stringify(response.body))
            } else if (args[2] === "put") {
                call.fileBody = readFileSync(file!, "utf8")
            }
        }
        return {
            status: response.status ?? 0,
            stdout: response.stdout ?? "",
            stderr: response.stderr ?? "",
        }
    }

const lastTempDir = (calls: { args: string[] }[]): string => {
    const file = calls[0]!.args[calls[0]!.args.indexOf("--file") + 1]!
    return path.dirname(file)
}

describe("R2 operations", () => {
    it.each([
        ["production", "skyshare-survey-results", "index.json"],
        ["develop", "skyshare-survey-results-develop", "index.json"],
    ] as const)(
        "reads the index from %s with exact wrangler arguments",
        async (env, bucket, key) => {
            const calls: { command: string; args: string[] }[] = []
            const remote = createSurveyRemote({
                run: makeRunner({ body: indexBody }, calls),
            })

            await expect(remote.readIndex(env)).resolves.toEqual(indexBody)
            expect(calls).toHaveLength(1)
            expect(calls[0]!.command).toBe("wrangler")
            expect(calls[0]!.args.slice(0, 5)).toEqual([
                "r2",
                "object",
                "get",
                `${bucket}/${key}`,
                "--remote",
            ])
            expect(calls[0]!.args.slice(5, 7)).toEqual([
                "--file",
                expect.any(String),
            ])
            expect(existsSync(lastTempDir(calls))).toBe(false)
        },
    )

    it.each([
        ["未知の版", { schemaVersion: 999, surveys: [] }],
        ["未知の項目", { schemaVersion: 1, surveys: [], count: 1 }],
        ["配列でない目録", { schemaVersion: 1, surveys: "x" }],
    ])(
        "rejects an index with %s as a parse error without exposing the body",
        async (_name, body) => {
            const calls: { command: string; args: string[] }[] = []
            const remote = createSurveyRemote({
                run: makeRunner({ body }, calls),
            })

            const failure = await remote
                .readIndex("production")
                .catch(error => error)

            expect(failure).toBeInstanceOf(RemoteError)
            expect((failure as RemoteError).kind).toBe("parse")
            expect((failure as RemoteError).message).not.toContain("999")
        },
    )

    it.each([
        [
            "SURVEY_RESULTS の宣言が無い",
            '{ "r2_buckets": [{ "binding": "OTHER", "bucket_name": "x" }] }',
        ],
        [
            "バケット名が空",
            '{ "r2_buckets": [{ "binding": "SURVEY_RESULTS", "bucket_name": "" }] }',
        ],
        ["r2_buckets が無い", "{}"],
        ["テンプレートが読めない", "{ not json"],
    ])(
        "classifies a bad bucket declaration (%s) as parse before running any command",
        async (_name, template) => {
            const directory = mkdtempSync(
                path.join(os.tmpdir(), "survey-template-"),
            )
            const templatePath = path.join(directory, "template.jsonc")
            writeFileSync(templatePath, template)
            const calls: { command: string; args: string[] }[] = []
            const remote = createSurveyRemote({
                run: makeRunner({ body: indexBody }, calls),
                bucketTemplatePath: templatePath,
            })
            try {
                for (const operation of [
                    () => remote.readIndex("production"),
                    () => remote.writeVisibility("develop", id, true),
                ]) {
                    const failure = await operation().catch(error => error)

                    expect(failure).toBeInstanceOf(RemoteError)
                    expect((failure as RemoteError).kind).toBe("parse")
                }
                expect(calls).toHaveLength(0)
            } finally {
                rmSync(directory, { recursive: true, force: true })
            }
        },
    )

    it("reads and validates a result, returning parse for invalid bodies", async () => {
        const okCalls: { command: string; args: string[] }[] = []
        const remote = createSurveyRemote({
            run: makeRunner({ body: resultBody }, okCalls),
        })
        await expect(remote.readResult("develop", id)).resolves.toEqual(
            resultBody,
        )
        expect(okCalls[0]!.args[3]).toBe(
            `skyshare-survey-results-develop/surveys/${id}.json`,
        )

        const invalid = createSurveyRemote({
            run: makeRunner({ body: { secretBody: "BODY-SECRET" } }, []),
        })
        let error: unknown
        try {
            await invalid.readResult("production", id)
        } catch (caught) {
            error = caught
        }
        expect(error).toMatchObject({ kind: "parse" })
        expect(String(error)).not.toContain("BODY-SECRET")
    })

    it.each([
        [undefined, "hidden"],
        [{ schemaVersion: 1, visible: true }, "visible"],
        [{ schemaVersion: 1, visible: false }, "hidden"],
        [{ visible: "bad" }, "invalid"],
    ] as const)("reads visibility state %s as %s", async (body, expected) => {
        const calls: { command: string; args: string[] }[] = []
        const response =
            body === undefined
                ? { status: 1, stderr: "The specified key does not exist" }
                : { body }
        const remote = createSurveyRemote({ run: makeRunner(response, calls) })
        await expect(remote.readVisibility("production", id)).resolves.toBe(
            expected,
        )
        expect(calls[0]!.args[3]).toBe(
            `skyshare-survey-results/visibility/${id}.json`,
        )
    })

    it("writes only a validated visibility object with exact put arguments", async () => {
        const calls: {
            command: string
            args: string[]
            fileBody?: string
        }[] = []
        const remote = createSurveyRemote({ run: makeRunner({}, calls) })
        await remote.writeVisibility("develop", id, true)
        await remote.writeVisibility("production", id, false)
        expect(calls[0]!.args.slice(0, 5)).toEqual([
            "r2",
            "object",
            "put",
            `skyshare-survey-results-develop/visibility/${id}.json`,
            "--remote",
        ])
        expect(calls[0]!.args.slice(5, 7)).toEqual([
            "--file",
            expect.any(String),
        ])
        expect(calls[0]!.args.slice(7)).toEqual([
            "--content-type",
            "application/json",
        ])
        expect(JSON.parse(calls[0]!.fileBody!)).toEqual({
            schemaVersion: 1,
            visible: true,
        })
        expect(calls[1]!.args.slice(0, 5)).toEqual([
            "r2",
            "object",
            "put",
            `skyshare-survey-results/visibility/${id}.json`,
            "--remote",
        ])
        expect(calls[1]!.args.slice(7)).toEqual([
            "--content-type",
            "application/json",
        ])
        expect(JSON.parse(calls[1]!.fileBody!)).toEqual({
            schemaVersion: 1,
            visible: false,
        })
        expect(calls.every(call => /\/visibility\//.test(call.args[3]!))).toBe(
            true,
        )
        expect(
            calls.every(call => !existsSync(path.dirname(call.args[6]!))),
        ).toBe(true)
    })

    it("rejects an invalid id before running a command", async () => {
        const calls: { command: string; args: string[] }[] = []
        const remote = createSurveyRemote({ run: makeRunner({}, calls) })
        await expect(
            remote.writeVisibility("production", "BAD-ID", true),
        ).rejects.toMatchObject({ kind: "parse" })
        expect(calls).toHaveLength(0)
    })

    it("removes the temporary directory when a put fails without exposing command text", async () => {
        const calls: { command: string; args: string[]; fileBody?: string }[] =
            []
        const remote = createSurveyRemote({
            run: makeRunner(
                {
                    status: 1,
                    stdout: "STDOUT-SECRET",
                    stderr: "offline STDERR-SECRET",
                },
                calls,
            ),
        })
        let error: unknown
        try {
            await remote.writeVisibility("production", id, false)
        } catch (caught) {
            error = caught
        }
        expect(error).toMatchObject({ kind: "unavailable" })
        expect(String(error)).not.toMatch(/SECRET|offline/)
        expect(existsSync(lastTempDir(calls))).toBe(false)
    })

    it.each([
        ["The specified key does not exist", undefined],
        ["authentication required AUTH-SECRET", "auth"],
        ["offline STDERR-SECRET", "unavailable"],
    ] as const)("classifies get failure %s", async (stderr, kind) => {
        const remote = createSurveyRemote({
            run: makeRunner({ status: 1, stderr }, []),
        })
        if (kind === undefined) {
            await expect(
                remote.readIndex("production"),
            ).resolves.toBeUndefined()
        } else {
            await expect(remote.readIndex("production")).rejects.toMatchObject({
                kind,
            })
            await expect(remote.readIndex("production")).rejects.not.toThrow(
                /SECRET|offline/,
            )
        }
    })

    it("removes the temporary directory when a get fails and never exposes external text", async () => {
        const calls: { command: string; args: string[] }[] = []
        const remote = createSurveyRemote({
            run: makeRunner(
                {
                    status: 1,
                    stdout: "STDOUT-SECRET",
                    stderr: "offline STDERR-SECRET",
                },
                calls,
            ),
        })
        let error: unknown
        try {
            await remote.readResult("production", id)
        } catch (caught) {
            error = caught
        }
        expect(error).toBeInstanceOf(RemoteError)
        expect(String(error)).not.toMatch(/SECRET|offline/)
        expect(existsSync(lastTempDir(calls))).toBe(false)
    })
})
