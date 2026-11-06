/**
 * 依存規則の検査の許容リスト部品。
 *
 * 責務と処理概要:
 * - 許容リスト（JSON）を読み込み、形式・重複・未知の規則・所有 spec の存在・理由（reason）の記入を検証する。
 * - 違反と許容リストを照合し、許容されていない違反（unlisted）と消えた許容の項目（stale）を分ける。
 * - 現在の違反から下書きを作る（規則ごとの既定の所有 spec を付ける）。
 *
 * 実装上の制約:
 * - 照合のキーは `ruleId|from|specifier`。
 * - 所有 spec は存在だけを見る（承認の状態は見ない）。
 */
import fs from "node:fs"
import { RULE_IDS, type RuleId, type Violation } from "./rules"

export type AllowlistEntry = {
    ruleId: RuleId
    from: string
    specifier: string
    owner: string
    /** 例外を認める理由。読み込み時に空・欠落を許さない。下書きでは空で出す。 */
    reason: string
}

export type AllowlistLoadResult = {
    entries: AllowlistEntry[]
    errors: string[]
}

export type CheckResult = {
    unlisted: Violation[]
    stale: AllowlistEntry[]
    listedCount: number
}

/** 規則ごとの既定の所有 spec（設計の表と一致させる）。 */
export const DEFAULT_OWNERS: Record<RuleId, string> = {
    layer: "src-pages-thin",
    uiInLib: "src-lib-ui-boundary",
    cycle: "src-cycles",
    crossRegionRelative: "src-import-style",
    relativeDepth: "src-import-style",
    jsExtension: "src-import-style",
    libLayer: "lib-layers",
    utilShared: "structure-checks",
    typesLeaf: "structure-checks",
    typesOnly: "structure-checks",
}

const keyOf = (item: {
    ruleId: string
    from: string
    specifier: string
}): string => `${item.ruleId}|${item.from}|${item.specifier}`

/** 許容リストの JSON を読み込み、検証する。読めない・壊れている場合は errors に理由を入れる。 */
export const loadAllowlist = (
    file: string,
    ownerExists: (owner: string) => boolean,
): AllowlistLoadResult => {
    const errors: string[] = []
    let raw: unknown
    try {
        raw = JSON.parse(fs.readFileSync(file, "utf8"))
    } catch (error) {
        return {
            entries: [],
            errors: [`許容リストを読めない: ${file}（${String(error)}）`],
        }
    }
    const body = raw as { version?: unknown; entries?: unknown }
    if (body.version !== 1 || !Array.isArray(body.entries)) {
        return {
            entries: [],
            errors: [
                `許容リストの形式が不正: ${file}（version は 1、entries は配列）`,
            ],
        }
    }
    const entries: AllowlistEntry[] = []
    const seen = new Set<string>()
    body.entries.forEach((item: Partial<AllowlistEntry>, position: number) => {
        const where = `entries[${position}]`
        if (!item || !RULE_IDS.includes(item.ruleId as RuleId)) {
            errors.push(`${where}: 未知の規則 ${String(item?.ruleId)}`)
            return
        }
        if (
            typeof item.from !== "string" ||
            typeof item.specifier !== "string" ||
            typeof item.owner !== "string"
        ) {
            errors.push(`${where}: from・specifier・owner は文字列で指定する`)
            return
        }
        if (typeof item.reason !== "string" || item.reason.trim() === "") {
            errors.push(
                `${where}: reason は空でない文字列で指定する（理由を埋めるまで読み込めない）`,
            )
            return
        }
        if (!ownerExists(item.owner)) {
            errors.push(
                `${where}: 所有 spec ${item.owner} が .kiro/specs/ に存在しない`,
            )
            return
        }
        const key = keyOf({
            ruleId: item.ruleId as string,
            from: item.from,
            specifier: item.specifier,
        })
        if (seen.has(key)) {
            errors.push(`${where}: 重複したキー ${key}`)
            return
        }
        seen.add(key)
        entries.push(item as AllowlistEntry)
    })
    return { entries, errors }
}

/** 違反を許容リストと照合する。 */
export const checkAllowlist = (
    violations: Violation[],
    entries: AllowlistEntry[],
): CheckResult => {
    const allowed = new Set(entries.map(keyOf))
    const observed = new Set(violations.map(keyOf))
    const unlisted = violations.filter(v => !allowed.has(keyOf(v)))
    const stale = entries.filter(e => !observed.has(keyOf(e)))
    const listedCount = violations.length - unlisted.length
    return { unlisted, stale, listedCount }
}

/**
 * 現在の違反から許容リストの下書きを作る。同じキーの違反は 1 件にする。
 * reason は空で出す。空のままでは読み込めないため、理由を埋めるまで有効な許容リストにならない。
 */
export const emitAllowlist = (
    violations: Violation[],
): { version: 1; entries: AllowlistEntry[] } => {
    const seen = new Set<string>()
    const entries: AllowlistEntry[] = []
    for (const v of violations) {
        const key = keyOf(v)
        if (seen.has(key)) continue
        seen.add(key)
        entries.push({
            ruleId: v.ruleId,
            from: v.from,
            specifier: v.specifier,
            owner: DEFAULT_OWNERS[v.ruleId],
            reason: "",
        })
    }
    entries.sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
    return { version: 1, entries }
}
