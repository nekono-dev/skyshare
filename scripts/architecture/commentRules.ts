/**
 * ソースのコメントの規則（先頭ヘッダの上限と禁止パターン）を検査する。
 *
 * - 先頭ヘッダの行数・箇条書きの数と、コメント中の禁止パターンを検出する。
 * - 違反は許容リスト（config/comments/allowlist.json）と突き合わせ、新しい違反と解消済みの項目を報告する。
 * - 文字列だけで判定し、構文木は使わない。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

/** 先頭ヘッダの内容の上限（空行を除く行数）。 */
export const HEADER_MAX_LINES = 6
/** 先頭ヘッダの箇条書きの上限。 */
export const HEADER_MAX_BULLETS = 3

/** 検査の対象の最上位ディレクトリ。 */
const ROOTS = ["src", "scripts", "hack", "tests", "config"]
/** 検査の対象の拡張子。 */
const EXTENSIONS = [".ts", ".tsx", ".astro", ".mjs"]
/** 検査から外すパス（先頭の一致）。生成物・fixture・画像。 */
const EXCLUDED_PREFIXES = ["src/client/", "src/images/", "tests/fixtures/"]

/** コメントの行の判定（行頭がコメントの記号）。 */
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|\{\/\*|<!--)/
/** API スキーマの説明の文字列（`summary:`・`description:` の値）。 */
const SCHEMA_TEXT_LINE = /\b(summary|description)\s*:\s*["'`]/
/** 日付（YYYY-MM-DD）。 */
const DATE = /20\d{2}-\d{2}-\d{2}/

/** 禁止パターン（コメント中）。 */
export const FORBIDDEN_PATTERNS: ReadonlyArray<{
    name: string
    pattern: RegExp
}> = [
    { name: "spec参照", pattern: /specs\// },
    { name: "要件番号", pattern: /要件 ?\d+\.\d+/ },
    { name: "AC/FR/NFRタグ", pattern: /\b(?:AC|FR|NFR)-?\d/ },
    { name: "cc-sdd", pattern: /cc-sdd/i },
    { name: "kiro", pattern: /\bkiro/i },
]

/** 違反の種類（許容リストの `rule` と対応する）。 */
export type CommentRule =
    | "header-missing"
    | "header-too-long"
    | "header-too-many-bullets"
    | "date"
    | `forbidden:${string}`

export type CommentViolation = {
    path: string
    rule: CommentRule
    /** 最初の違反の行（1 始まり）。 */
    line: number
    /** 違反の箇所の文字列（報告用）。 */
    detail: string
}

export type AllowEntry = {
    path: string
    rule: CommentRule
    owner: string
    reason: string
}

/** ファイルのパスから、解消を担当する spec（comments-*）を決める。 */
export const ownerOf = (rel: string): string => {
    if (rel.startsWith("src/lib/api/schema/")) return "comments-api-schema"
    if (rel.startsWith("src/lib/")) return "comments-lib"
    if (rel.startsWith("src/")) return "comments-components-pages"
    if (rel.startsWith("tests/") || rel.startsWith("config/test/"))
        return "comments-tests"
    return "comments-scripts-config"
}

/** 先頭ヘッダの内容（空行と記号を除いた行）を返す。 */
const contentOf = (block: string[]): string[] =>
    block
        .map(line =>
            line
                .trim()
                .replace(/^\/\*\*?/, "")
                .replace(/\*\/$/, "")
                .replace(/^\*\s?/, "")
                .trim(),
        )
        .filter(line => line !== "")

/**
 * 先頭ヘッダを探す。シェバン行・Astro のフロントマターの区切り（`---`）・空行を飛ばした先頭が
 * ブロックコメントならそれを返す。そうでなければ `null`（ヘッダが無い）。
 */
export const headerOf = (
    lines: string[],
): { start: number; content: string[] } | null => {
    let i = 0
    while (i < lines.length) {
        const t = lines[i].trim()
        if (t === "" || t.startsWith("#!") || t === "---") {
            i++
            continue
        }
        break
    }
    if (i >= lines.length || !lines[i].trim().startsWith("/**")) return null
    let j = i
    while (j < lines.length && !lines[j].includes("*/")) j++
    const block = lines.slice(i, Math.min(j, lines.length - 1) + 1)
    return { start: i + 1, content: contentOf(block) }
}

/** 1 つのファイルの本文を検査する（ファイル名と本文だけを使う純粋な関数）。 */
export const checkSource = (rel: string, text: string): CommentViolation[] => {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/)
    const out: CommentViolation[] = []
    const seen = new Set<CommentRule>()
    const add = (rule: CommentRule, line: number, detail: string) => {
        if (seen.has(rule)) return
        seen.add(rule)
        out.push({ path: rel, rule, line, detail })
    }

    const header = headerOf(lines)
    if (header === null || header.content.length === 0) {
        add("header-missing", 1, "先頭に目的を書いたブロックコメントが無い")
    } else {
        if (header.content.length > HEADER_MAX_LINES) {
            add(
                "header-too-long",
                header.start,
                `先頭ヘッダが ${header.content.length} 行（上限 ${HEADER_MAX_LINES} 行）`,
            )
        }
        const bullets = header.content.filter(line =>
            line.startsWith("- "),
        ).length
        if (bullets > HEADER_MAX_BULLETS) {
            add(
                "header-too-many-bullets",
                header.start,
                `先頭ヘッダの箇条書きが ${bullets} 件（上限 ${HEADER_MAX_BULLETS} 件）`,
            )
        }
    }

    const isSchema = rel.startsWith("src/lib/api/schema/")
    lines.forEach((line, idx) => {
        const isComment = COMMENT_LINE.test(line)
        const isSchemaText = isSchema && SCHEMA_TEXT_LINE.test(line)
        if (!isComment && !isSchemaText) return
        // 日付は、バッククォートで囲んだ入力例の中だけ許す
        const outsideCode = line.replace(/`[^`]*`/g, "")
        if (DATE.test(outsideCode)) add("date", idx + 1, line.trim())
        for (const { name, pattern } of FORBIDDEN_PATTERNS) {
            if (pattern.test(line))
                add(`forbidden:${name}`, idx + 1, line.trim())
        }
    })
    return out
}

/** 検査の対象のファイル（リポジトリのルートからの相対パス、ソート済み）。 */
export const collectSources = (root: string): string[] => {
    const out: string[] = []
    const rel = (full: string) =>
        path.relative(root, full).split(path.sep).join("/")
    const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
            const full = path.join(dir, name)
            const r = rel(full)
            if (EXCLUDED_PREFIXES.some(prefix => r.startsWith(prefix))) continue
            if (statSync(full).isDirectory()) {
                if (name.startsWith(".") || name === "node_modules") continue
                walk(full)
                continue
            }
            if (name.endsWith(".d.ts")) continue
            if (EXTENSIONS.some(ext => name.endsWith(ext))) out.push(r)
        }
    }
    for (const top of ROOTS) {
        const dir = path.join(root, top)
        if (existsSync(dir)) walk(dir)
    }
    return out.sort()
}

/** リポジトリ全体の違反（ファイルと規則の組ごとに、最初の 1 件）。 */
export const findCommentViolations = (root: string): CommentViolation[] =>
    collectSources(root).flatMap(rel =>
        checkSource(rel, readFileSync(path.join(root, rel), "utf8")),
    )

/** 違反と許容項目の照合キー。 */
export const keyOf = (path: string, rule: CommentRule): string =>
    `${path}\u0000${rule}`

// 直接実行で `--emit-allowlist` を付けると、現在の違反を許容リストの形で出力する（既存の違反の登録に使う）
if (
    process.argv[1] &&
    path.resolve(process.argv[1]) ===
        path.resolve(new URL(import.meta.url).pathname)
) {
    if (process.argv.includes("--emit-allowlist")) {
        const root = path.resolve(
            path.dirname(new URL(import.meta.url).pathname),
            "../..",
        )
        const entries: AllowEntry[] = findCommentViolations(root).map(v => ({
            path: v.path,
            rule: v.rule,
            owner: ownerOf(v.path),
            reason: "コメントの整理（comments-* の spec）で解消する",
        }))
        process.stdout.write(
            `${JSON.stringify({ version: 1, entries }, null, 2)}\n`,
        )
    }
}
