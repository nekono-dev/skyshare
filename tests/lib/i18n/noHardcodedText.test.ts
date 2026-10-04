/**
 * 文言の直書き（辞書を経由しない日本語・英語のUI文言）を検出するテスト。
 *
 * 責務と処理概要:
 * - `src/` 配下の `.ts`/`.tsx` を TypeScript の構文木で走査し、次を検出する。
 *   - 文字列・テンプレートリテラル・JSXテキストに含まれるひらがな・カタカナ・漢字
 *   - JSXテキスト、および `placeholder`/`aria-label`/`title`/`alt`/`label` 属性の文字列リテラルに含まれる英字
 * - `.astro` は、コメントを除いた本文・フロントマターの日本語を検出する。
 * - 例外は `ALLOWED_*` の一覧で、理由とともに明示する。一覧に無いものは失敗する。
 */
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const SRC_DIR = path.resolve(__dirname, "../../../src")

const CJK = /[぀-ヿ㐀-鿿]/
const LATIN = /[A-Za-z]/

/** 走査から丸ごと除外するパス（src からの相対パス前方一致）。 */
const EXCLUDED_PREFIXES = [
    "client/", // orval 等の自動生成コード
    "lib/i18n/messages/", // 辞書そのもの
    "lib/api/schema/", // OpenAPIの description 等、開発者向け記述（翻訳対象外）
    "images/",
]

/**
 * 日本語を含む直書きを許可するファイルとその理由。
 * - 言語の自称表記（各言語自身の名称）は翻訳しない。
 * - 文字種判定用のリテラルは表示文言ではない。
 */
const ALLOWED_CJK_FILES: Record<string, string> = {
    "components/common/LanguageSelect/index.tsx":
        "投稿言語の選択肢は各言語の自称表記（翻訳しない）",
    "components/common/LocaleSelect/index.tsx":
        "表示言語の自称表記（「日本語」「English」は翻訳しない）",
    "lib/atproto/languageFlag.ts": "言語コードと国の対応表（表示文言ではない）",
    "pages/entries/sample.astro":
        "ビルド時に固定される（SSG）サンプルEntryのデモデータ。ゲスト表示のリンク先",
}

/** 英字を含む直書きを許可するJSXテキスト・属性値（文言ではない固有表記）。 */
const ALLOWED_LATIN_TEXT = new Set<string>([
    "alt", // 画像のaltテキスト編集バッジのラベル（HTML属性名そのもの）
    "Skyshare", // サービス名
    "Bluesky",
    "X",
    "Mastodon",
    "Skyshare v1.6.3", // 旧UIのバージョン名（固有名称）
    "#Skyshare", // ハッシュタグ（固有表記）
    "example.bsky.social", // ハンドル入力欄の入力例（ドメイン形式の例示）
])

/**
 * 構文木を走査して、指定条件のノードの文字列を集める。
 *
 * Input:
 * - `source`: ソースファイルの構文木
 *
 * Output:
 * - 検出した直書き文言（種別・行番号付き）
 */
const collectLiterals = (source: ts.SourceFile) => {
    const found: { kind: "cjk" | "latin"; text: string; line: number }[] = []
    const lineOf = (node: ts.Node) =>
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1

    const visit = (node: ts.Node) => {
        // 日本語: 文字列・テンプレートリテラルとJSXテキスト（コメントは構文木に現れない）
        if (
            ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node) ||
            ts.isJsxText(node)
        ) {
            if (CJK.test(node.text)) {
                found.push({
                    kind: "cjk",
                    text: node.text.trim(),
                    line: lineOf(node),
                })
            }
        }
        // 英語: JSXテキスト（空白のみは除く）
        if (ts.isJsxText(node)) {
            const text = node.text.trim()
            if (text !== "" && LATIN.test(text)) {
                found.push({ kind: "latin", text, line: lineOf(node) })
            }
        }
        // 英語: 表示に使われる属性の文字列リテラル
        if (
            ts.isJsxAttribute(node) &&
            node.initializer &&
            ts.isStringLiteral(node.initializer) &&
            ["placeholder", "aria-label", "title", "alt", "label"].includes(
                node.name.getText(source),
            ) &&
            LATIN.test(node.initializer.text)
        ) {
            found.push({
                kind: "latin",
                text: node.initializer.text,
                line: lineOf(node),
            })
        }
        ts.forEachChild(node, visit)
    }
    visit(source)
    return found
}

/** `src/` 配下のファイルを再帰的に列挙する。 */
const listFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name)
        return entry.isDirectory() ? listFiles(full) : [full]
    })

const files = listFiles(SRC_DIR)
    .map(file => ({ file, rel: path.relative(SRC_DIR, file) }))
    .filter(
        ({ rel }) => !EXCLUDED_PREFIXES.some(prefix => rel.startsWith(prefix)),
    )

describe("文言の直書き検出", () => {
    it("ts/tsx に日本語・英語のUI文言が直書きされていない", () => {
        const violations: string[] = []
        for (const { file, rel } of files.filter(({ rel }) =>
            /\.(ts|tsx)$/.test(rel),
        )) {
            const source = ts.createSourceFile(
                file,
                fs.readFileSync(file, "utf-8"),
                ts.ScriptTarget.Latest,
                true,
                rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
            )
            for (const item of collectLiterals(source)) {
                if (item.kind === "cjk" && rel in ALLOWED_CJK_FILES) continue
                if (item.kind === "latin" && ALLOWED_LATIN_TEXT.has(item.text))
                    continue
                violations.push(
                    `${rel}:${item.line} [${item.kind}] ${item.text}`,
                )
            }
        }
        expect(violations).toEqual([])
    })

    it(".astro の本文・フロントマターに日本語が直書きされていない", () => {
        const violations: string[] = []
        for (const { file, rel } of files.filter(({ rel }) =>
            rel.endsWith(".astro"),
        )) {
            if (rel in ALLOWED_CJK_FILES) continue
            // コメント（HTML・JS・JSX）は文言ではないため取り除いてから走査する
            const text = fs
                .readFileSync(file, "utf-8")
                .replace(/<!--[\s\S]*?-->/g, "")
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/^\s*\/\/.*$/gm, "")
                .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
            text.split("\n").forEach((line, index) => {
                if (CJK.test(line)) {
                    violations.push(`${rel}:${index + 1} ${line.trim()}`)
                }
            })
        }
        expect(violations).toEqual([])
    })

    it("許可リストのファイルが実在する（削除・改名の取りこぼし防止）", () => {
        const existing = new Set(files.map(({ rel }) => rel))
        const missing = Object.keys(ALLOWED_CJK_FILES).filter(
            rel => !existing.has(rel),
        )
        expect(missing).toEqual([])
    })
})
