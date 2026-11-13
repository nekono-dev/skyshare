/**
 * SurveyConfig と R2 の統計ファイルを手元の gh / wrangler で管理する。
 *
 * - SURVEY_CONFIG の読み書きと、本番・開発の D1 への SELECT（2 表の行の有無）を行う。
 * - 目録・結果・可視フラグを共有スキーマで検証して読み、書くのは可視フラグだけにする。
 * - 設定値・外部コマンドのエラー文・認証情報・読んだ本文を、例外や要約に含めない。
 */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { idSchema } from "@/lib/api/contract/surveyPath"
import {
    INDEX_KEY,
    isVisible,
    parseSurveyIndex,
    parseSurveyResult,
    parseSurveyVisibility,
    resultKey,
    visibilityKey,
    type SurveyIndex,
    type SurveyResult,
} from "@/lib/survey/results/schema"
import type { RowPresence, VisibilityState } from "./lifecycle"
import type { SurveyEnv } from "./args"

// 配備スクリプトと同じ Git リモート解析・JSONC 解析を再利用する（宣言されていない jsonc-parser は使わない）。
// @ts-ignore JavaScript helper has no declaration file.
import { repositoryFromRemote } from "../../scripts/lib/github.mjs"
// @ts-ignore JavaScript helper has no declaration file.
import { parseJsonc } from "../../scripts/lib/jsonc.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const VARIABLE_NAME = "SURVEY_CONFIG"
const DATABASE_CONFIG = path.join(ROOT, "config", "wrangler.template.jsonc")
const SURVEY_RESULTS_BINDING = "SURVEY_RESULTS"
/** キー不存在判定に使う wrangler 標準エラー。実機の値はタスク 4.2 で確定する。 */
const R2_KEY_MISSING_PHRASE = "The specified key does not exist"

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
    /** 目録。object が無ければ undefined。形式が不正なら RemoteError("parse") */
    readIndex(env: SurveyEnv): Promise<SurveyIndex | undefined>
    /** 可視フラグ。無ければ hidden、不正な形式なら invalid を返す。 */
    readVisibility(env: SurveyEnv, id: string): Promise<VisibilityState>
    /** 結果。object が無ければ undefined。形式が不正なら RemoteError("parse") */
    readResult(env: SurveyEnv, id: string): Promise<SurveyResult | undefined>
    /** 可視フラグだけを書き込む。 */
    writeVisibility(env: SurveyEnv, id: string, visible: boolean): Promise<void>
    listReleaseBranches(): Promise<{ name: string; committedAt: string }[]>
    startDeploy(ref: string): Promise<void>
}

export type SurveyRemoteOptions = {
    run?: RunCommand
    repo?: string
    /** バケット名を読むデプロイ設定のテンプレート。省略時は `config/wrangler.template.jsonc` */
    bucketTemplatePath?: string
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
    /not logged in|authentication required|requires authentication|unauthorized|\b401\b|\b403\b|\bgh\s+auth\s+login\b|authentication token/i.test(
        result.stderr,
    )

const remoteErrorFor = (result: CommandResult): RemoteError =>
    new RemoteError(isAuthFailure(result) ? "auth" : "unavailable")

const parseSurveyBucket = (
    env: SurveyEnv,
    templatePath: string = DATABASE_CONFIG,
): string => {
    let bucket: string | undefined
    try {
        const config: {
            r2_buckets?: { binding?: string; bucket_name?: string }[]
        } = parseJsonc(readFileSync(templatePath, "utf8"))
        bucket = config.r2_buckets?.find(
            item =>
                item.binding === SURVEY_RESULTS_BINDING &&
                typeof item.bucket_name === "string" &&
                item.bucket_name.length > 0,
        )?.bucket_name
    } catch {
        throw new RemoteError("parse")
    }
    if (!bucket) throw new RemoteError("parse")
    return env === "develop" ? `${bucket}-develop` : bucket
}

const parseObject = <T>(
    body: unknown,
    parser: (input: unknown) => { ok: true; value: T } | { ok: false },
): T => {
    const parsed = parser(body)
    if (!parsed.ok) throw new RemoteError("parse")
    return parsed.value
}

const parseDatabaseNames = (): string[] => {
    const source = readFileSync(DATABASE_CONFIG, "utf8")
    let config: {
        d1_databases?: { binding?: string; database_name?: string }[]
    }
    try {
        config = parseJsonc(source)
    } catch {
        throw new RemoteError("parse")
    }
    if (!Array.isArray(config.d1_databases)) {
        throw new RemoteError("parse")
    }
    const database = config.d1_databases.find(
        item => item.binding === "DB" && typeof item.database_name === "string",
    )
    if (!database?.database_name) throw new RemoteError("parse")
    return [database.database_name, `${database.database_name}-develop`]
}

const parseVariableValue = (output: string): string => {
    try {
        const parsed: unknown = JSON.parse(output)
        if (
            parsed !== null &&
            typeof parsed === "object" &&
            "value" in parsed &&
            typeof parsed.value === "string"
        ) {
            return parsed.value
        }
    } catch {
        // API 応答に含まれる値や解析例外をエラーへ含めない。
    }
    throw new RemoteError("parse")
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

    const withTempFile = async <T>(
        operation: (file: string) => Promise<T>,
    ): Promise<T> => {
        const directory = mkdtempSync(path.join(os.tmpdir(), "survey-cli-"))
        const file = path.join(directory, "object.json")
        try {
            return await operation(file)
        } finally {
            rmSync(directory, { recursive: true, force: true })
        }
    }

    const readObject = async (
        env: SurveyEnv,
        key: string,
    ): Promise<unknown | undefined> => {
        const bucket = parseSurveyBucket(env, options.bucketTemplatePath)
        return withTempFile(async file => {
            const result = run("wrangler", [
                "r2",
                "object",
                "get",
                `${bucket}/${key}`,
                "--remote",
                "--file",
                file,
            ])
            if (result.status !== 0) {
                if (result.stderr.includes(R2_KEY_MISSING_PHRASE)) {
                    return undefined
                }
                throw remoteErrorFor(result)
            }
            let body: unknown
            try {
                body = JSON.parse(readFileSync(file, "utf8")) as unknown
            } catch {
                throw new RemoteError("parse")
            }
            return body
        })
    }

    const writeObject = async (
        env: SurveyEnv,
        key: string,
        body: unknown,
    ): Promise<void> => {
        const bucket = parseSurveyBucket(env, options.bucketTemplatePath)
        await withTempFile(async file => {
            writeFileSync(file, JSON.stringify(body), "utf8")
            const result = run("wrangler", [
                "r2",
                "object",
                "put",
                `${bucket}/${key}`,
                "--remote",
                "--file",
                file,
                "--content-type",
                "application/json",
            ])
            if (result.status !== 0) throw remoteErrorFor(result)
        })
    }

    const gh = (action: "set" | "delete", input?: string): CommandResult =>
        run(
            "gh",
            ["variable", action, VARIABLE_NAME, "-R", resolveRepo()],
            input,
        )

    const remote: Omit<SurveyRemote, "listReleaseBranches" | "startDeploy"> = {
        async readConfigValue() {
            const result = run("gh", [
                "api",
                `repos/${resolveRepo()}/actions/variables/${VARIABLE_NAME}`,
            ])
            if (result.status === 0) return parseVariableValue(result.stdout)
            if (/HTTP 404\b/.test(result.stderr)) {
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
                if (/HTTP 404\b/.test(result.stderr)) {
                    return
                }
                throw remoteErrorFor(result)
            }
        },

        async readIndex(env) {
            const body = await readObject(env, INDEX_KEY)
            return body === undefined
                ? undefined
                : parseObject(body, parseSurveyIndex)
        },

        async readVisibility(env, surveyId) {
            if (!idSchema.safeParse(surveyId).success) return "invalid"
            try {
                const body = await readObject(env, visibilityKey(surveyId))
                if (body === undefined) return "hidden"
                const visibility = parseSurveyVisibility(body)
                if (!visibility.ok) return "invalid"
                return isVisible(visibility.value) ? "visible" : "hidden"
            } catch (error) {
                if (error instanceof RemoteError && error.kind === "parse") {
                    return "invalid"
                }
                throw error
            }
        },

        async readResult(env, surveyId) {
            if (!idSchema.safeParse(surveyId).success)
                throw new RemoteError("parse")
            const body = await readObject(env, resultKey(surveyId))
            return body === undefined
                ? undefined
                : parseObject(body, parseSurveyResult)
        },

        async writeVisibility(env, surveyId, visible) {
            if (!idSchema.safeParse(surveyId).success)
                throw new RemoteError("parse")
            const body = { schemaVersion: 1, visible }
            parseObject(body, parseSurveyVisibility)
            await writeObject(env, visibilityKey(surveyId), body)
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
            const quotedId = sqlLiteral(surveyId)
            const sql = `SELECT EXISTS(SELECT 1 FROM survey_respondents WHERE survey_id = ${quotedId}) AS respondent_exists, EXISTS(SELECT 1 FROM survey_answers WHERE survey_id = ${quotedId}) AS answer_exists`
            return databaseNames.map(databaseName => {
                try {
                    const result = run("wrangler", [
                        "d1",
                        "execute",
                        databaseName,
                        "--remote",
                        "--json",
                        "--command",
                        sql,
                    ])
                    if (result.status !== 0) return "unknown"
                    return rowPresence(result.stdout)
                } catch {
                    // 不明は除去候補のまま残す。
                    return "unknown"
                }
            })
        },
    }
    return remote as SurveyRemote
}
