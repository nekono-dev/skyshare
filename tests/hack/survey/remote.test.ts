import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

import {
    createSurveyRemote,
    RemoteError,
    wranglerEnvironment,
} from "../../../hack/survey/remote"

const fixture = (name: string) =>
    readFileSync(`tests/fixtures/survey-operation/commands/${name}`, "utf8")

const absent = JSON.parse(fixture("gh-variable-absent.json"))
const authFailure = JSON.parse(fixture("gh-auth-failure.json"))

describe("survey remote", () => {
    test("reads one repository variable through the API and writes through stdin", async () => {
        const calls: { command: string; args: string[]; input?: string }[] = []
        const remote = createSurveyRemote({
            repo: "owner/repo",
            run: (command, args, input) => {
                calls.push({ command, args, input })
                return command === "gh" &&
                    args[0] === "api" &&
                    args[1] ===
                        "repos/owner/repo/actions/variables/SURVEY_CONFIG"
                    ? {
                          status: 0,
                          stdout: '{"name":"SURVEY_CONFIG","value":"safe-config"}',
                          stderr: "",
                      }
                    : { status: 0, stdout: "", stderr: "" }
            },
        })

        expect(await remote.readConfigValue()).toBe("safe-config")
        await remote.writeConfigValue("private-survey-config")
        await remote.deleteConfigValue()

        expect(calls[0]).toEqual({
            command: "gh",
            args: ["api", "repos/owner/repo/actions/variables/SURVEY_CONFIG"],
            input: undefined,
        })
        expect(calls).toHaveLength(3)
        expect(calls[1]).toEqual({
            command: "gh",
            args: ["variable", "set", "SURVEY_CONFIG", "-R", "owner/repo"],
            input: "private-survey-config",
        })
        expect(calls[1]!.args.join(" ")).not.toContain("private-survey-config")
    })

    test("treats only the missing variable response as unset and classifies auth errors", async () => {
        const missing = createSurveyRemote({
            repo: "owner/repo",
            run: () => ({ ...absent, status: absent.exitCode }),
        })
        expect(await missing.readConfigValue()).toBeUndefined()

        const unauthenticated = createSurveyRemote({
            repo: "owner/repo",
            run: () => ({ ...authFailure, status: authFailure.exitCode }),
        })
        await expect(unauthenticated.readConfigValue()).rejects.toMatchObject({
            kind: "auth",
        })
        await expect(unauthenticated.readConfigValue()).rejects.not.toThrow(
            /logged into|auth login/i,
        )
    })

    test("rejects malformed API responses with a fixed parse error", async () => {
        const remote = createSurveyRemote({
            repo: "owner/repo",
            run: () => ({
                status: 0,
                stdout: '{"name":"SURVEY_CONFIG","value":42}',
                stderr: "private response detail",
            }),
        })

        await expect(remote.readConfigValue()).rejects.toMatchObject({
            kind: "parse",
            message: "外部サービスの応答を読み取れません",
        })
        await expect(remote.readConfigValue()).rejects.not.toThrow(
            /private response detail|42/,
        )
    })

    test("queries production and develop once each with read-only checks for both tables", async () => {
        const calls: { command: string; args: string[] }[] = []
        const remote = createSurveyRemote({
            repo: "owner/repo",
            run: (command, args) => {
                calls.push({ command, args })
                return {
                    status: 0,
                    stdout: fixture(
                        args.includes("skyshare")
                            ? "wrangler-row-present.txt"
                            : "wrangler-no-rows.txt",
                    ),
                    stderr: "",
                }
            },
        })

        expect(await remote.hasRows("survey-2026-1")).toEqual([
            "present",
            "none",
        ])
        expect(calls).toHaveLength(2)
        expect(calls.map(call => call.args[2])).toEqual([
            "skyshare",
            "skyshare-develop",
        ])
        for (const call of calls) {
            const sql = call.args[call.args.indexOf("--command") + 1]!
            expect(sql).toMatch(/SELECT/i)
            expect(sql).toMatch(/survey_respondents/)
            expect(sql).toMatch(/survey_answers/)
            expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|DROP)\b/i)
            expect(sql).toContain("survey-2026-1")
        }
    })

    test("does not issue a query for an invalid survey id", async () => {
        const calls: string[] = []
        const remote = createSurveyRemote({
            repo: "owner/repo",
            run: command => {
                calls.push(command)
                return { status: 0, stdout: "", stderr: "" }
            },
        })

        expect(
            await remote.hasRows("bad'; DROP TABLE survey_answers;--"),
        ).toEqual(["unknown", "unknown"])
        expect(calls).toEqual([])
    })

    test("returns unknown on command or JSON failures without leaking stderr", async () => {
        const failed = createSurveyRemote({
            repo: "owner/repo",
            run: () => ({
                status: 1,
                stdout: "",
                stderr: fixture("wrangler-failure.json"),
            }),
        })
        expect(await failed.hasRows("survey-2026-1")).toEqual([
            "unknown",
            "unknown",
        ])

        const unparseable = createSurveyRemote({
            repo: "owner/repo",
            run: () => ({ status: 0, stdout: "not json", stderr: "sensitive" }),
        })
        expect(await unparseable.hasRows("survey-2026-1")).toEqual([
            "unknown",
            "unknown",
        ])

        const malformedBoolean = createSurveyRemote({
            repo: "owner/repo",
            run: () => ({
                status: 0,
                stdout: '[{"results":[{"respondent_exists":"maybe","answer_exists":0}]}]',
                stderr: "",
            }),
        })
        expect(await malformedBoolean.hasRows("survey-2026-1")).toEqual([
            "unknown",
            "unknown",
        ])
    })

    test("passes shell Cloudflare credentials to wrangler without overriding them", async () => {
        const beforeToken = process.env.CLOUDFLARE_API_TOKEN
        const beforeAccount = process.env.CLOUDFLARE_ACCOUNT_ID
        process.env.CLOUDFLARE_API_TOKEN = "shell-token-for-test"
        process.env.CLOUDFLARE_ACCOUNT_ID = "shell-account-for-test"
        const environments: Record<string, string | undefined>[] = []
        const remote = createSurveyRemote({
            repo: "owner/repo",
            run: (command, _args, _input, options) => {
                if (command === "wrangler")
                    environments.push(options?.env ?? {})
                return {
                    status: 0,
                    stdout: fixture("wrangler-no-rows.txt"),
                    stderr: "",
                }
            },
        })

        try {
            expect(await remote.hasRows("survey-2026-1")).toEqual([
                "none",
                "none",
            ])
            expect(environments).toHaveLength(2)
            expect(environments[0]?.CLOUDFLARE_API_TOKEN).toBe(
                "shell-token-for-test",
            )
            expect(environments[0]?.CLOUDFLARE_ACCOUNT_ID).toBe(
                "shell-account-for-test",
            )
        } finally {
            if (beforeToken === undefined)
                delete process.env.CLOUDFLARE_API_TOKEN
            else process.env.CLOUDFLARE_API_TOKEN = beforeToken
            if (beforeAccount === undefined)
                delete process.env.CLOUDFLARE_ACCOUNT_ID
            else process.env.CLOUDFLARE_ACCOUNT_ID = beforeAccount
        }
    })

    test("uses deploy.env credentials only when the shell does not set them", () => {
        const environment = wranglerEnvironment(
            { CLOUDFLARE_API_TOKEN: "shell-token" },
            "[github.secrets]\nCLOUDFLARE_API_TOKEN=deploy-token\nCLOUDFLARE_ACCOUNT_ID=deploy-account\n",
        )

        expect(environment).toMatchObject({
            CLOUDFLARE_API_TOKEN: "shell-token",
            CLOUDFLARE_ACCOUNT_ID: "deploy-account",
        })
        expect(wranglerEnvironment({}, "invalid deploy env")).toEqual({})
    })

    test("exports only fixed remote error messages", async () => {
        const remote = createSurveyRemote({
            repo: "owner/repo",
            run: () => ({
                status: 1,
                stdout: "secret value",
                stderr: "secret error",
            }),
        })
        await expect(
            remote.writeConfigValue("secret value"),
        ).rejects.toBeInstanceOf(RemoteError)
        await expect(
            remote.writeConfigValue("secret value"),
        ).rejects.not.toThrow(/secret value|secret error/i)
    })
})
