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

describe("deployment and release branch operations", () => {
    it.each([
        ["option repo", { repo: "owner/repo" }, false],
        ["resolved repo", {}, true],
    ] as const)(
        "starts a real deployment with exact arguments (%s)",
        async (_name, options, resolvesRepo) => {
            const calls: { command: string; args: string[] }[] = []
            const runner: RunCommand = (command, args) => {
                calls.push({ command, args })
                return {
                    status: 0,
                    stdout: resolvesRepo
                        ? "https://github.com/owner/repo.git\n"
                        : "",
                    stderr: "",
                }
            }
            const remote = createSurveyRemote({ ...options, run: runner })
            await remote.startDeploy("release/2026-11")
            expect(calls).toEqual(
                resolvesRepo
                    ? [
                          {
                              command: "git",
                              args: ["remote", "get-url", "origin"],
                          },
                          {
                              command: "gh",
                              args: [
                                  "workflow",
                                  "run",
                                  "deploy.yaml",
                                  "--ref",
                                  "release/2026-11",
                                  "-f",
                                  "dry_run=false",
                                  "-R",
                                  "owner/repo",
                              ],
                          },
                      ]
                    : [
                          {
                              command: "gh",
                              args: [
                                  "workflow",
                                  "run",
                                  "deploy.yaml",
                                  "--ref",
                                  "release/2026-11",
                                  "-f",
                                  "dry_run=false",
                                  "-R",
                                  "owner/repo",
                              ],
                          },
                      ],
            )
        },
    )

    it.each(["", "bad ref", "-danger", "bad\nref"])(
        "rejects invalid deployment ref %j before running commands",
        async ref => {
            const calls: { command: string; args: string[] }[] = []
            const remote = createSurveyRemote({
                repo: "owner/repo",
                run: (command, args) => {
                    calls.push({ command, args })
                    return { status: 0, stdout: "", stderr: "" }
                },
            })
            await expect(remote.startDeploy(ref)).rejects.toMatchObject({
                kind: "parse",
            })
            expect(calls).toHaveLength(0)
        },
    )

    it("lists refs and maps each head commit date", async () => {
        const calls: { command: string; args: string[] }[] = []
        const runner: RunCommand = (command, args) => {
            calls.push({ command, args })
            const output = args[1].endsWith("git/matching-refs/heads/release/")
                ? JSON.stringify([
                      {
                          ref: "refs/heads/release/2026-10",
                          object: { sha: "a".repeat(40) },
                      },
                      {
                          ref: "refs/heads/release/2026-11",
                          object: { sha: "b".repeat(40) },
                      },
                  ])
                : JSON.stringify({
                      commit: {
                          committer: {
                              date: args[1].includes("a".repeat(40))
                                  ? "2026-10-01T00:00:00Z"
                                  : "2026-11-01T00:00:00Z",
                          },
                      },
                  })
            return { status: 0, stdout: output, stderr: "" }
        }
        const remote = createSurveyRemote({ repo: "owner/repo", run: runner })
        await expect(remote.listReleaseBranches()).resolves.toEqual([
            { name: "release/2026-10", committedAt: "2026-10-01T00:00:00Z" },
            { name: "release/2026-11", committedAt: "2026-11-01T00:00:00Z" },
        ])
        expect(calls).toEqual([
            {
                command: "gh",
                args: [
                    "api",
                    "repos/owner/repo/git/matching-refs/heads/release/",
                ],
            },
            {
                command: "gh",
                args: ["api", `repos/owner/repo/commits/${"a".repeat(40)}`],
            },
            {
                command: "gh",
                args: ["api", `repos/owner/repo/commits/${"b".repeat(40)}`],
            },
        ])
    })

    it("returns an empty branch list and classifies failures without exposing command text", async () => {
        const empty = createSurveyRemote({
            repo: "owner/repo",
            run: () => ({ status: 0, stdout: "[]", stderr: "" }),
        })
        await expect(empty.listReleaseBranches()).resolves.toEqual([])
        for (const [stderr, kind] of [
            ["authentication required SECRET", "auth"],
            ["offline SECRET", "unavailable"],
        ] as const) {
            const remote = createSurveyRemote({
                repo: "owner/repo",
                run: () => ({ status: 1, stdout: "OUTPUT-SECRET", stderr }),
            })
            for (const operation of [
                () => remote.startDeploy("develop"),
                () => remote.listReleaseBranches(),
            ]) {
                const error = await operation().catch(value => value)
                expect(error).toMatchObject({ kind })
                expect(String(error)).not.toMatch(/SECRET|offline|OUTPUT/)
            }
        }
    })

    it.each([
        ["配列でない応答", JSON.stringify({ ref: "refs/heads/release/x" })],
        ["null", "null"],
    ])("rejects a refs response that is %s as parse", async (_name, stdout) => {
        const remote = createSurveyRemote({
            repo: "owner/repo",
            run: () => ({ status: 0, stdout, stderr: "" }),
        })

        await expect(remote.listReleaseBranches()).rejects.toMatchObject({
            kind: "parse",
        })
    })

    it.each([
        ["日付でない", "yesterday"],
        ["実在しない日付", "2026-02-30T00:00:00Z"],
        ["時刻帯が無い", "2026-11-01T00:00:00"],
        ["文字列でない", 20261101],
    ])("rejects a commit date that is %s as parse", async (_name, date) => {
        const remote = createSurveyRemote({
            repo: "owner/repo",
            run: (_command, args) => ({
                status: 0,
                stdout: args[1]!.endsWith("git/matching-refs/heads/release/")
                    ? JSON.stringify([
                          {
                              ref: "refs/heads/release/x",
                              object: { sha: "a".repeat(40) },
                          },
                      ])
                    : JSON.stringify({ commit: { committer: { date } } }),
                stderr: "",
            }),
        })

        await expect(remote.listReleaseBranches()).rejects.toMatchObject({
            kind: "parse",
        })
    })

    it.each([
        "not-json",
        JSON.stringify([
            { ref: "refs/heads/release/x", object: { sha: "short" } },
        ]),
        JSON.stringify([
            { ref: "refs/heads/other", object: { sha: "a".repeat(40) } },
        ]),
    ])("rejects malformed branch data as parse: %s", async stdout => {
        let calls = 0
        const remote = createSurveyRemote({
            repo: "owner/repo",
            run: () => {
                calls += 1
                return { status: 0, stdout, stderr: "BODY-SECRET" }
            },
        })
        await expect(remote.listReleaseBranches()).rejects.toMatchObject({
            kind: "parse",
        })
        expect(calls).toBe(1)
    })
})
