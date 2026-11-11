/**
 * 依存規則を検査する CLI（`npm run test:imports`）。
 *
 * - `--emit-allowlist` は違反一覧を JSON で標準出力に出し、ファイルは変更しない。
 * - 許容リストの古い項目は警告に留め、終了コードに影響させない。
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { checkAllowlist, emitAllowlist, loadAllowlist } from "./allowlist"
import { findCycleViolations } from "./cycles"
import { scanModules } from "./import-graph"
import { evaluateImportRules, type Violation } from "./rules"
import { findTypesOnlyViolations } from "./types-only"
import { findUtilSharingViolations } from "./util-sharing"

export type ImportCheckOptions = {
    root: string
    allowlistPath: string
    emit: boolean
    ownerExists: (owner: string) => boolean
}

export type ImportCheckResult = {
    exitCode: 0 | 1
    lines: string[]
}

/**
 * 違反・stale の対象の表示。specifier が空の規則（utilShared・typesOnly など）は「で import」を省く。
 * specifier がある場合は、import 元と指定先を表示する。
 */
const label = (item: {
    ruleId: string
    from: string
    specifier: string
}): string =>
    item.specifier === ""
        ? `[${item.ruleId}] ${item.from}`
        : `[${item.ruleId}] ${item.from} を ${item.specifier} で import`

const describe = (v: Violation): string => `${label(v)}: ${v.message}`

export const runImportCheck = (
    options: ImportCheckOptions,
): ImportCheckResult => {
    const graph = scanModules(options.root)
    // typesOnly は `src/types/` の `.ts` の本文を読む（`.astro` は対象外）。
    // 対象の一覧は走査と同じ（生成物・`.d.ts` を除く）ため、graph.modules から取る
    const typesFiles = graph.modules
        .filter(m => m.startsWith("src/types/") && m.endsWith(".ts"))
        .map(m => ({
            path: m,
            text: fs.readFileSync(path.join(options.root, m), "utf8"),
        }))
    const violations = [
        ...evaluateImportRules(graph),
        ...findCycleViolations(graph),
        ...findUtilSharingViolations(graph),
        ...findTypesOnlyViolations(typesFiles),
    ]

    if (options.emit) {
        return {
            exitCode: 0,
            lines: [JSON.stringify(emitAllowlist(violations), null, 4)],
        }
    }

    const lines: string[] = []
    for (const item of graph.unresolved) {
        lines.push(
            `エラー: 解決できない import ${item.specifier}（${item.from}）`,
        )
    }
    if (!fs.existsSync(options.allowlistPath)) {
        lines.push(`エラー: 許容リストが無い: ${options.allowlistPath}`)
        return { exitCode: 1, lines }
    }
    const loaded = loadAllowlist(options.allowlistPath, options.ownerExists)
    for (const error of loaded.errors) lines.push(`エラー: ${error}`)

    const result = checkAllowlist(violations, loaded.entries)
    for (const v of result.unlisted) lines.push(`違反: ${describe(v)}`)
    for (const e of result.stale) {
        lines.push(`警告: stale（消えた許容の項目） ${label(e)}`)
    }
    lines.push(
        `違反 ${result.unlisted.length} 件・許容 ${result.listedCount} 件・stale ${result.stale.length} 件`,
    )

    const failed =
        result.unlisted.length > 0 ||
        loaded.errors.length > 0 ||
        graph.unresolved.length > 0
    return { exitCode: failed ? 1 : 0, lines }
}

const isEntry = (): boolean =>
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isEntry()) {
    const repoRoot = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../..",
    )
    const emit = process.argv.includes("--emit-allowlist")
    const result = runImportCheck({
        root: repoRoot,
        allowlistPath: path.join(
            repoRoot,
            "config/architecture/import-allowlist.json",
        ),
        emit,
        ownerExists: owner =>
            fs.existsSync(path.join(repoRoot, ".kiro/specs", owner)),
    })
    for (const line of result.lines) console.log(line)
    process.exitCode = result.exitCode
}
