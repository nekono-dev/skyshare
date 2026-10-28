/**
 * アンケート設定の追加・状態確認・期限切れ項目の除去を束ねる。
 *
 * 責務と処理概要:
 * - 引数を検証し、設定の取得・検証・変換・比較・反映を行う。
 * - 状態は設定だけを読み、除去は期限切れ候補に限って D1 の行を確認する。
 * - 呼び出し元には秘密や設定本文を含まない 1 行の結果を返す。
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { parseSurveyConfig, type SurveyConfig } from "@/lib/survey/definition"
import { byteLength, addSurvey, removeSurveys, serializeConfig } from "./config"
import { decidePrune, pruneCandidates, surveyPhase } from "./lifecycle"
import { createSurveyRemote, RemoteError, type SurveyRemote } from "./remote"

const VARIABLE_LIMIT_KB = 48

export type SurveyCliDependencies = {
    remote?: SurveyRemote
    now?: () => Date
    readFile?: (filePath: string) => string
}

export type SurveyCliResult = { code: 0 | 1; line: string }

type Command =
    | { name: "add"; file: string; dryRun: boolean }
    | { name: "status" }
    | { name: "prune"; dryRun: boolean }

const oneLine = (value: string): string => value.replace(/[\r\n]+/g, " ")

const usageError = (message: string): SurveyCliResult => ({
    code: 1,
    line: `error: usage: ${message}`,
})

const parseCommand = (
    argv: readonly string[],
): { command?: Command; repo?: string; error?: SurveyCliResult } => {
    const args: string[] = []
    let repo: string | undefined
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index]
        if (arg === "--repo") {
            const value = argv[index + 1]
            if (!value || value.startsWith("--"))
                return {
                    error: usageError(
                        "--repo に owner/repo を指定してください",
                    ),
                }
            repo = value
            index += 1
        } else {
            args.push(arg!)
        }
    }
    if (repo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))
        return {
            error: usageError("--repo は owner/repo の形式で指定してください"),
        }

    const [name, ...options] = args
    if (name === "add") {
        let file: string | undefined
        let dryRun = false
        for (let index = 0; index < options.length; index += 1) {
            const option = options[index]
            if (option === "--file") {
                if (
                    file ||
                    !options[index + 1] ||
                    options[index + 1]!.startsWith("--")
                )
                    return {
                        error: usageError("add --file <パス> [--dry-run]"),
                    }
                file = options[index + 1]
                index += 1
            } else if (option === "--dry-run" && !dryRun) {
                dryRun = true
            } else {
                return { error: usageError("add --file <パス> [--dry-run]") }
            }
        }
        if (!file) return { error: usageError("add --file <パス> [--dry-run]") }
        return { command: { name, file, dryRun }, repo }
    }
    if (name === "status" && options.length === 0)
        return { command: { name }, repo }
    if (name === "prune") {
        if (options.length === 0)
            return { command: { name, dryRun: false }, repo }
        if (options.length === 1 && options[0] === "--dry-run")
            return { command: { name, dryRun: true }, repo }
    }
    return {
        error: usageError(
            "add --file <パス> [--dry-run] | status | prune [--dry-run]",
        ),
    }
}

const invalidConfig = (issues?: readonly string[]): SurveyCliResult => {
    if (!issues?.length)
        return { code: 1, line: "error: invalid: 設定を読み取れません" }
    const first = oneLine(issues[0]!).slice(0, 160)
    const remainder = issues.length > 1 ? ` (+${issues.length - 1} more)` : ""
    return { code: 1, line: `error: invalid: ${first}${remainder}` }
}

const failure = (error: unknown): SurveyCliResult => {
    if (error instanceof RemoteError) {
        if (error.kind === "auth")
            return {
                code: 1,
                line: "error: auth: gh または wrangler の認証が必要",
            }
        if (error.kind === "parse")
            return {
                code: 1,
                line: "error: invalid: 外部サービスの応答を読み取れません",
            }
        return {
            code: 1,
            line: "error: unavailable: 外部サービスを利用できません",
        }
    }
    return { code: 1, line: "error: unavailable: 操作を完了できません" }
}

const readConfig = async (
    remote: SurveyRemote,
): Promise<{ config: SurveyConfig } | SurveyCliResult> => {
    const value = await remote.readConfigValue()
    if (value === undefined) return { config: { surveys: [] } }
    let parsed: unknown
    try {
        parsed = JSON.parse(value)
    } catch {
        return invalidConfig()
    }
    const result = parseSurveyConfig(parsed)
    return result.ok ? { config: result.config } : invalidConfig(result.issues)
}

const formatKilobytes = (bytes: number): string => (bytes / 1024).toFixed(1)

const outcomeError = (
    outcome: ReturnType<typeof addSurvey>,
): SurveyCliResult | undefined => {
    if (outcome.status === "invalid") return invalidConfig(outcome.issues)
    if (outcome.status === "too-large")
        return { code: 1, line: `error: too-large: ${outcome.bytes} bytes` }
    return undefined
}

/** CLI の処理本体。標準出力には書かず、固定された 1 行の結果を返す。 */
export const run = async (
    argv: readonly string[],
    dependencies: SurveyCliDependencies = {},
): Promise<SurveyCliResult> => {
    const parsed = parseCommand(argv)
    if (parsed.error) return parsed.error
    const command = parsed.command
    if (!command) return usageError("コマンドを指定してください")

    const remote =
        dependencies.remote ?? createSurveyRemote({ repo: parsed.repo })
    const now = dependencies.now ?? (() => new Date())
    const readFile =
        dependencies.readFile ??
        ((filePath: string) => readFileSync(filePath, "utf8"))

    try {
        const loaded = await readConfig(remote)
        if ("code" in loaded) return loaded
        const currentTime = now()

        if (command.name === "add") {
            let draft: unknown
            try {
                draft = JSON.parse(readFile(command.file))
            } catch {
                return {
                    code: 1,
                    line: "error: invalid: 下書きを読み取れません",
                }
            }
            const result = addSurvey(loaded.config, draft)
            const problem = outcomeError(result)
            if (problem) return problem
            if (result.status === "invalid" || result.status === "too-large")
                return {
                    code: 1,
                    line: "error: invalid: 下書きを検証できません",
                }

            const prefix = command.dryRun ? "[dry-run] " : ""
            if (!command.dryRun && result.status !== "unchanged")
                await remote.writeConfigValue(result.value)
            const size = formatKilobytes(byteLength(result.value))
            return {
                code: 0,
                line: `${prefix}add: ${result.status} ${result.id} (surveys ${result.config.surveys.length}, ${size}/${VARIABLE_LIMIT_KB} KB)`,
            }
        }

        if (command.name === "status") {
            if (loaded.config.surveys.length === 0)
                return { code: 0, line: "status: no surveys" }
            const items = loaded.config.surveys.map(
                survey => `${survey.id} ${surveyPhase(survey, currentTime)}`,
            )
            const bytes = byteLength(serializeConfig(loaded.config))
            return {
                code: 0,
                line: `status: surveys ${items.length} [${items.join(", ")}] ${formatKilobytes(bytes)}/${VARIABLE_LIMIT_KB} KB`,
            }
        }

        const candidates = pruneCandidates(loaded.config, currentTime)
        if (candidates.length === 0)
            return {
                code: 0,
                line: `${command.dryRun ? "[dry-run] " : ""}prune: nothing to remove`,
            }

        const presence: Record<
            string,
            Awaited<ReturnType<SurveyRemote["hasRows"]>>
        > = {}
        for (const survey of candidates)
            presence[survey.id] = await remote.hasRows(survey.id)
        const decision = decidePrune(candidates, presence)
        const removed = decision.remove
        if (removed.length === 0) {
            const kept = decision.kept
                .map(item => `${item.id}(${item.reason})`)
                .join(", ")
            return {
                code: 0,
                line: `${command.dryRun ? "[dry-run] " : ""}prune: nothing removed; kept ${kept}`,
            }
        }

        const next = removeSurveys(loaded.config, removed)
        if (!command.dryRun) {
            if (next.surveys.length === 0) await remote.deleteConfigValue()
            else await remote.writeConfigValue(serializeConfig(next))
        }
        const action = command.dryRun ? "would remove" : "removed"
        const kept = decision.kept.length
            ? `; kept ${decision.kept.map(item => `${item.id}(${item.reason})`).join(", ")}`
            : ""
        return {
            code: 0,
            line: `${command.dryRun ? "[dry-run] " : ""}prune: ${action} ${removed.join(", ")} (surveys ${loaded.config.surveys.length} -> ${next.surveys.length})${kept}`,
        }
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
        write(`${result.line}\n`)
        process.exitCode = result.code
    })
}
