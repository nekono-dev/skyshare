/**
 * アンケート CLI の引数・設定・目録をまとめて固定行を返す。
 * `status` は表全体、それ以外は 1 行を返す。
 */
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { parseSurveyConfig, type SurveyConfig } from "@/lib/survey/definition"
import { parseSurveyIndex, type SurveyIndex } from "@/lib/survey/results/schema"
import { parseArgs, type Command, type SurveyEnv } from "./args"
import {
    addSurvey,
    byteLength,
    serializeConfig,
    VARIABLE_LIMIT_BYTES,
} from "./config"
import { buildStatusRows, formatJst, type Aggregation } from "./lifecycle"
import { createSurveyRemote, RemoteError, type SurveyRemote } from "./remote"

const VARIABLE_LIMIT_KB = VARIABLE_LIMIT_BYTES / 1024
const NEW_REGISTRATION_REFUSAL =
    "error: refused: 未集計のアンケートがあります。集計を待つか、開始前なら remove、開催中なら締切を前倒しして両環境へ配備し、集計を待ってください。"
const NOT_IMPLEMENTED_REFUSAL = "error: refused: このコマンドはまだ使えません"

/** 設定にある識別子と重ならない、dry-run 用の仮の UUID を返す（実際には登録しない）。 */
const dryRunId = (config: SurveyConfig): string => {
    const used = new Set(config.surveys.map(survey => survey.id))
    for (let counter = 0; ; counter += 1) {
        const candidate = `123e4567-e89b-42d3-a456-${counter
            .toString(16)
            .padStart(12, "0")}`
        if (!used.has(candidate)) return candidate
    }
}

export type SurveyCliDependencies = {
    remote?: SurveyRemote
    createId?: () => string
    now?: () => Date
    readFile?: (filePath: string) => string
}

export type SurveyCliResult = { code: 0 | 1; lines: string[] }

const result = (code: 0 | 1, line: string): SurveyCliResult => ({
    code,
    lines: [line],
})

const invalid = (message = "設定を読み取れません"): SurveyCliResult =>
    result(1, `error: invalid: ${message}`)

const failure = (error: unknown): SurveyCliResult => {
    if (
        error instanceof RemoteError ||
        (error && typeof error === "object" && "kind" in error)
    ) {
        const kind = (error as { kind?: unknown }).kind
        if (kind === "auth")
            return result(1, "error: auth: gh または wrangler の認証が必要")
        if (kind === "parse")
            return result(
                1,
                "error: invalid: 外部サービスの応答を読み取れません",
            )
        if (kind === "unavailable")
            return result(1, "error: unavailable: 外部サービスを利用できません")
    }
    return result(1, "error: unavailable: 操作を完了できません")
}

const readConfig = async (
    remote: SurveyRemote,
): Promise<SurveyConfig | SurveyCliResult> => {
    const value = await remote.readConfigValue()
    if (value === undefined) return { surveys: [] }
    let parsed: unknown
    try {
        parsed = JSON.parse(value)
    } catch {
        return invalid()
    }
    const config = parseSurveyConfig(parsed)
    return config.ok ? config.config : invalid("設定の形式が正しくありません")
}

const readIndexes = async (
    remote: SurveyRemote,
): Promise<Record<SurveyEnv, SurveyIndex | undefined> | SurveyCliResult> => {
    const indexes: Record<SurveyEnv, SurveyIndex | undefined> = {
        production: undefined,
        develop: undefined,
    }
    for (const env of ["production", "develop"] as const) {
        const index = await remote.readIndex(env)
        if (index === undefined) continue
        const parsed = parseSurveyIndex(index)
        if (!parsed.ok) return invalid("目録の形式が正しくありません")
        indexes[env] = parsed.value
    }
    return indexes
}

const isFailure = (value: unknown): value is SurveyCliResult =>
    value !== null && typeof value === "object" && "code" in value

const indexIds = (index: SurveyIndex | undefined): Set<string> =>
    new Set(index?.surveys.map(entry => entry.id) ?? [])

const formatKilobytes = (bytes: number): string => (bytes / 1024).toFixed(1)

const formatAddResult = (
    status: "created" | "updated" | "unchanged",
    id: string,
    config: SurveyConfig,
    dryRun: boolean,
): string => {
    const value = serializeConfig(config)
    const prefix = dryRun ? "[dry-run] " : ""
    return `${prefix}add: ${status} ${id} (surveys ${config.surveys.length}, ${formatKilobytes(byteLength(value))}/${VARIABLE_LIMIT_KB} KB)`
}

const addFailure = (
    outcome: ReturnType<typeof addSurvey>,
): SurveyCliResult | undefined => {
    switch (outcome.status) {
        case "invalid":
            return invalid(
                outcome.issues[0] ?? "下書きの形式が正しくありません",
            )
        case "too-large":
            return result(1, `error: too-large: ${outcome.bytes} bytes`)
        case "not-found":
            return result(1, "error: not-found: 指定したアンケートがありません")
        case "refused":
            return result(1, outcome.line.replace(/[\r\n]+/g, " "))
        default:
            return undefined
    }
}

const runAdd = async (
    command: Extract<Command, { name: "add" }>,
    config: SurveyConfig,
    remote: SurveyRemote,
    dependencies: SurveyCliDependencies,
    now: () => Date,
    readFile: (filePath: string) => string,
): Promise<SurveyCliResult> => {
    let draft: unknown
    try {
        draft = JSON.parse(readFile(command.file))
    } catch {
        return invalid("下書きを読み取れません")
    }

    const hasId =
        draft !== null &&
        typeof draft === "object" &&
        "id" in draft &&
        typeof (draft as { id?: unknown }).id === "string"
    const preflight = addSurvey(
        hasId ? config : { surveys: [] },
        draft,
        now(),
        () => dryRunId(config),
    )
    const preflightError = addFailure(preflight)
    if (preflightError) return preflightError

    const indexes = await readIndexes(remote)
    if (isFailure(indexes)) return indexes
    const productionIds = indexIds(indexes.production)
    const developIds = indexIds(indexes.develop)

    const requestedId =
        draft !== null && typeof draft === "object" && "id" in draft
            ? (draft as { id?: unknown }).id
            : undefined
    const existing =
        typeof requestedId === "string"
            ? config.surveys.find(survey => survey.id === requestedId)
            : undefined
    if (requestedId === undefined) {
        const allRecorded = config.surveys.every(
            survey => productionIds.has(survey.id) && developIds.has(survey.id),
        )
        if (!allRecorded) return result(1, NEW_REGISTRATION_REFUSAL)
    } else if (
        existing &&
        (productionIds.has(existing.id) || developIds.has(existing.id))
    ) {
        const candidate =
            preflight.status === "created" ||
            preflight.status === "updated" ||
            preflight.status === "unchanged"
                ? preflight.config.surveys.find(
                      survey => survey.id === existing.id,
                  )
                : undefined
        if (
            candidate &&
            Date.parse(candidate.closesAt) !== Date.parse(existing.closesAt)
        )
            return result(
                1,
                "error: refused: 集計済みのアンケートの締切は変更できません",
            )
    }

    const createId = dependencies.createId ?? randomUUID
    const outcome = addSurvey(
        config,
        draft,
        now(),
        command.dryRun ? () => dryRunId(config) : createId,
    )
    const outcomeError = addFailure(outcome)
    if (outcomeError) return outcomeError
    if (!("config" in outcome)) return invalid("下書きを検証できません")

    if (!command.dryRun && outcome.status !== "unchanged")
        await remote.writeConfigValue(outcome.value)
    return result(
        0,
        formatAddResult(
            outcome.status,
            outcome.id,
            outcome.config,
            command.dryRun,
        ),
    )
}

const runStatus = async (
    env: SurveyEnv,
    config: SurveyConfig,
    remote: SurveyRemote,
    now: () => Date,
): Promise<SurveyCliResult> => {
    const rawIndex = await remote.readIndex(env)
    let index: SurveyIndex | undefined
    if (rawIndex !== undefined) {
        const parsed = parseSurveyIndex(rawIndex)
        if (!parsed.ok) return invalid("目録の形式が正しくありません")
        index = parsed.value
    }
    const indexed = new Map<
        string,
        {
            period: { opensAt: string; closesAt: string }
            aggregation: Aggregation
        }
    >()
    for (const entry of index?.surveys ?? []) {
        let aggregation: Aggregation
        if (entry.outcome === "empty") aggregation = { outcome: "empty" }
        else {
            const visibility = await remote.readVisibility(env, entry.id)
            aggregation = { outcome: "result", visibility }
        }
        indexed.set(entry.id, { period: entry, aggregation })
    }
    const rows = buildStatusRows(config, indexed, now())
    const bytes = byteLength(serializeConfig(config))
    if (rows.length === 0)
        return { code: 0, lines: [`status: env=${env} no surveys`] }
    return {
        code: 0,
        lines: [
            `status: env=${env} surveys ${rows.length}, config ${formatKilobytes(bytes)}/${VARIABLE_LIMIT_KB} KB`,
            ...rows.map(
                row =>
                    `  ${row.id}  ${row.stage}  closes ${formatJst(row.closesAt)} JST  ${row.inConfig ? "config" : "r2-only"}${row.invalidVisibility ? " !invalid-visibility" : ""}`,
            ),
        ],
    }
}

const notImplemented = (): SurveyCliResult => result(1, NOT_IMPLEMENTED_REFUSAL)

/** 引数を解析し、設定と必要な目録を順番に読み取って結果を返す。 */
export const run = async (
    argv: readonly string[],
    dependencies: SurveyCliDependencies = {},
): Promise<SurveyCliResult> => {
    const parsed = parseArgs(argv)
    if (!parsed.ok) return result(1, parsed.usage)
    if (
        parsed.command.name === "prune" ||
        parsed.command.name === "remove" ||
        parsed.command.name === "publish" ||
        parsed.command.name === "unpublish"
    ) {
        return notImplemented()
    }
    const remote =
        dependencies.remote ?? createSurveyRemote({ repo: parsed.repo })
    const now = dependencies.now ?? (() => new Date())
    const readFile =
        dependencies.readFile ??
        ((filePath: string) => readFileSync(filePath, "utf8"))
    try {
        const config = await readConfig(remote)
        if (isFailure(config)) return config
        const command = parsed.command
        if (command.name === "add")
            return await runAdd(
                command,
                config,
                remote,
                dependencies,
                now,
                readFile,
            )
        if (command.name === "status")
            return await runStatus(command.env, config, remote, now)
        return notImplemented()
    } catch (error) {
        return failure(error)
    }
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
    run(process.argv.slice(2)).then(result => {
        const write =
            result.code === 0
                ? process.stdout.write.bind(process.stdout)
                : process.stderr.write.bind(process.stderr)
        for (const line of result.lines) write(`${line}\n`)
        process.exitCode = result.code
    })
}
