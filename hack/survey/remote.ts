/**
 * SurveyConfig と D1 の回答有無を、手元の gh / wrangler から取得する。
 *
 * 責務と処理概要:
 * - SURVEY_CONFIG の取得・設定・削除を固定のエラー分類で行う。
 * - 本番と開発の D1 に SELECT のみを発行し、2 表の行の有無を確認する。
 * - 設定値・外部コマンドのエラー文・認証情報を例外や要約に含めない。
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { parse as parseJsonc } from "jsonc-parser"
import { idSchema } from "@/lib/survey/definition"
import type { RowPresence } from "./lifecycle"

// 既存の配備スクリプトが使う同一の区分・Git リモート解析を再利用する。
// @ts-ignore JavaScript helper has no declaration file.
import { parseDeployEnv, repositoryFromRemote } from "../sync-deploy-env.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const VARIABLE_NAME = "SURVEY_CONFIG"
const DATABASE_CONFIG = path.join(ROOT, "wrangler.template.jsonc")
const DEPLOY_ENV = path.join(ROOT, "deploy.env")

export type RemoteErrorKind = "auth" | "unavailable" | "parse"

const ERROR_MESSAGES: Record<RemoteErrorKind, string> = {
    auth: "認証が必要です",
    unavailable: "外部サービスを利用できません",
    parse: "外部サービスの応答を読み取れません",
}

export class RemoteError extends Error {
    constructor(public kind: RemoteErrorKind) {
        super(ERROR_MESSAGES[kind])
        this.name = "RemoteError"
    }
}

export type CommandResult = {
    status: number | null
    stdout: string
    stderr: string
}

export type CommandRunOptions = { env?: NodeJS.ProcessEnv }

export type RunCommand = (
    command: string,
    args: string[],
    input?: string,
    options?: CommandRunOptions,
) => CommandResult

export type SurveyRemote = {
    readConfigValue(): Promise<string | undefined>
    writeConfigValue(value: string): Promise<void>
    deleteConfigValue(): Promise<void>
    hasRows(surveyId: string): Promise<RowPresence[]>
}

export type SurveyRemoteOptions = {
    run?: RunCommand
    repo?: string
}

const runLocal: RunCommand = (command, args, input, options) => {
    const result = spawnSync(command, args, {
        cwd: ROOT,
        env: options?.env ?? process.env,
        input,
        encoding: "utf8",
    })
    return {
        status: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
    }
}

const isAuthFailure = (result: CommandResult): boolean =>
    /not logged in|authentication required|requires authentication|unauthorized|\b401\b|\b403\b/i.test(
        result.stderr,
    )

const remoteErrorFor = (result: CommandResult): RemoteError =>
    new RemoteError(isAuthFailure(result) ? "auth" : "unavailable")

const parseDatabaseNames = (): string[] => {
    const source = readFileSync(DATABASE_CONFIG, "utf8")
    const errors: { error: number; offset: number; length: number }[] = []
    const config = parseJsonc(source, errors, {
        allowTrailingComma: true,
        disallowComments: false,
    }) as {
        d1_databases?: { binding?: string; database_name?: string }[]
    }
    if (errors.length > 0 || !Array.isArray(config.d1_databases)) {
        throw new RemoteError("parse")
    }
    const database = config.d1_databases.find(
        item => item.binding === "DB" && typeof item.database_name === "string",
    )
    if (!database?.database_name) throw new RemoteError("parse")
    return [database.database_name, `${database.database_name}-develop`]
}

/** deploy.env の Cloudflare 認証を補い、シェル環境の値を優先する。 */
export const wranglerEnvironment = (
    baseEnvironment: NodeJS.ProcessEnv = process.env,
    deployEnvContent?: string,
): NodeJS.ProcessEnv => {
    let source = deployEnvContent
    if (source === undefined) {
        if (!existsSync(DEPLOY_ENV)) return { ...baseEnvironment }
        try {
            source = readFileSync(DEPLOY_ENV, "utf8")
        } catch {
            return { ...baseEnvironment }
        }
    }
    try {
        const sections = parseDeployEnv(source) as Record<
            string,
            Record<string, string> | undefined
        >
        const secrets = sections["github.secrets"] ?? {}
        const result = { ...baseEnvironment }
        for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
            if (!baseEnvironment[name] && secrets[name])
                result[name] = secrets[name]
        }
        return result
    } catch {
        // deploy.env は任意。読めない場合は手元の認証状態に任せる。
        return { ...baseEnvironment }
    }
}

const parseVariableValue = (output: string): string => {
    const trimmed = output.trim()
    if (trimmed === "") throw new RemoteError("parse")
    try {
        const parsed: unknown = JSON.parse(trimmed)
        if (
            parsed !== null &&
            typeof parsed === "object" &&
            "value" in parsed &&
            typeof parsed.value === "string"
        ) {
            return parsed.value
        }
    } catch {
        // gh の既定出力は JSON ではなく値そのもの。
    }
    return trimmed
}

const sqlLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`

const parseJsonOutput = (output: string): unknown => {
    const start = output.indexOf("[")
    if (start < 0) throw new Error("parse")
    return JSON.parse(output.slice(start)) as unknown
}

const fieldBoolean = (value: unknown): boolean | null => {
    if (value === true || value === 1 || value === "1") return true
    if (value === false || value === 0 || value === "0") return false
    return null
}

const rowPresence = (output: string): RowPresence => {
    const parsed = parseJsonOutput(output)
    if (
        parsed === null ||
        typeof parsed !== "object" ||
        !("0" in parsed) ||
        !Array.isArray(parsed)
    ) {
        throw new Error("parse")
    }
    const first = parsed[0] as { results?: unknown }
    if (!Array.isArray(first?.results) || first.results.length !== 1) {
        throw new Error("parse")
    }
    const row = first.results[0] as Record<string, unknown> | null
    if (row === null || typeof row !== "object") throw new Error("parse")
    const respondent = row.respondent_exists ?? row.r
    const answer = row.answer_exists ?? row.a
    if (respondent === undefined || answer === undefined)
        throw new Error("parse")
    const respondentExists = fieldBoolean(respondent)
    const answerExists = fieldBoolean(answer)
    if (respondentExists === null || answerExists === null)
        throw new Error("parse")
    return respondentExists || answerExists ? "present" : "none"
}

/** Local の認証済みコマンドで設定を管理し、回答の有無だけを読み取る。 */
export const createSurveyRemote = (
    options: SurveyRemoteOptions = {},
): SurveyRemote => {
    const run = options.run ?? runLocal
    let repo = options.repo

    const resolveRepo = (): string => {
        if (repo) return repo
        const result = run("git", ["remote", "get-url", "origin"])
        if (result.status !== 0 || !result.stdout.trim()) {
            throw new RemoteError("unavailable")
        }
        const parsedRepo = repositoryFromRemote(result.stdout)
        if (!parsedRepo) throw new RemoteError("parse")
        repo = parsedRepo
        return parsedRepo
    }

    const gh = (
        action: "get" | "set" | "delete",
        input?: string,
    ): CommandResult =>
        run(
            "gh",
            ["variable", action, VARIABLE_NAME, "-R", resolveRepo()],
            input,
        )

    return {
        async readConfigValue() {
            const result = gh("get")
            if (result.status === 0) return parseVariableValue(result.stdout)
            if (
                /HTTP 404: Not Found|not found/i.test(result.stderr) &&
                result.stderr.includes(VARIABLE_NAME)
            ) {
                return undefined
            }
            throw remoteErrorFor(result)
        },

        async writeConfigValue(value) {
            const result = gh("set", value)
            if (result.status !== 0) throw remoteErrorFor(result)
        },

        async deleteConfigValue() {
            const result = gh("delete")
            if (result.status !== 0) {
                if (
                    /HTTP 404: Not Found|not found/i.test(result.stderr) &&
                    result.stderr.includes(VARIABLE_NAME)
                ) {
                    return
                }
                throw remoteErrorFor(result)
            }
        },

        async hasRows(surveyId) {
            if (!idSchema.safeParse(surveyId).success)
                return ["unknown", "unknown"]
            let databaseNames: string[]
            try {
                databaseNames = parseDatabaseNames()
            } catch {
                return ["unknown", "unknown"]
            }
            const env = wranglerEnvironment()
            const quotedId = sqlLiteral(surveyId)
            const sql = `SELECT EXISTS(SELECT 1 FROM survey_respondents WHERE survey_id = ${quotedId}) AS respondent_exists, EXISTS(SELECT 1 FROM survey_answers WHERE survey_id = ${quotedId}) AS answer_exists`
            return databaseNames.map(databaseName => {
                try {
                    const result = run(
                        "wrangler",
                        [
                            "d1",
                            "execute",
                            databaseName,
                            "--remote",
                            "--json",
                            "--command",
                            sql,
                        ],
                        undefined,
                        { env },
                    )
                    if (result.status !== 0) return "unknown"
                    return rowPresence(result.stdout)
                } catch {
                    // 不明は除去候補のまま残す。
                    return "unknown"
                }
            })
        },
    }
}
