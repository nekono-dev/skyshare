/**
 * 依存規則の検査の走査部品。
 *
 * 責務と処理概要:
 * - `src/` 配下の `.ts`・`.tsx`・`.astro` を列挙し、import 辺を返す。
 * - `.astro` は先頭のフロントマターだけを TypeScript として解析する。
 * - 型だけの import（`import type`・`export type`・型位置の `import("...")`）を区別する。
 * - `@/`・相対パス・拡張子の省略・`index` を解決する。解決できない `.ts` 系の指定は未解決として返す。
 * - 読み取りだけを行い、ファイルを変更しない。生成物（`src/client/openapi/`）と型宣言ファイルは対象外。
 *
 * 実装上の制約:
 * - 型のプログラムは作らず、構文木だけを使う（新しい依存を増やさないため）。
 */
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

export type ModulePath = string

export type ImportEdge = {
    from: ModulePath
    specifier: string
    typeOnly: boolean
    target:
        { kind: "module"; path: ModulePath } | { kind: "package"; name: string }
}

export type UnresolvedImport = {
    from: ModulePath
    specifier: string
}

export type ModuleGraph = {
    modules: ModulePath[]
    edges: ImportEdge[]
    unresolved: UnresolvedImport[]
}

const CODE_EXTENSIONS = [".ts", ".tsx", ".astro"]
const ASSET_PATTERN = /\.(css|json|svg|png|jpe?g|webp|gif|woff2?)$/
const GENERATED_PREFIX = "src/client/openapi/"

/** 1 ファイルから取り出した、書かれたままの import 指定。 */
type RawImport = { specifier: string; typeOnly: boolean }

const toPosix = (p: string) => p.split(path.sep).join("/")

const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            walk(full, out)
        } else if (
            /\.(ts|tsx|astro)$/.test(entry.name) &&
            !entry.name.endsWith(".d.ts")
        ) {
            out.push(full)
        }
    }
    return out
}

/** `.astro` は先頭の `---` で囲まれたフロントマターだけを返す。 */
const sourceOf = (
    file: string,
    text: string,
): { text: string; kind: ts.ScriptKind } => {
    if (!file.endsWith(".astro")) {
        return {
            text,
            kind: file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        }
    }
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    return { text: match ? match[1] : "", kind: ts.ScriptKind.TS }
}

const extractImports = (file: string, text: string): RawImport[] => {
    const source = sourceOf(file, text)
    const sf = ts.createSourceFile(
        file,
        source.text,
        ts.ScriptTarget.Latest,
        true,
        source.kind,
    )
    const found: RawImport[] = []
    const visit = (node: ts.Node): void => {
        if (
            ts.isImportDeclaration(node) &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            found.push({
                specifier: node.moduleSpecifier.text,
                typeOnly: !!node.importClause?.isTypeOnly,
            })
        } else if (
            ts.isExportDeclaration(node) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            found.push({
                specifier: node.moduleSpecifier.text,
                typeOnly: node.isTypeOnly,
            })
        } else if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments[0] &&
            ts.isStringLiteral(node.arguments[0])
        ) {
            found.push({ specifier: node.arguments[0].text, typeOnly: false })
        } else if (
            ts.isImportTypeNode(node) &&
            ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteral(node.argument.literal)
        ) {
            found.push({
                specifier: node.argument.literal.text,
                typeOnly: true,
            })
        }
        ts.forEachChild(node, visit)
    }
    visit(sf)
    return found
}

type Resolution =
    | { kind: "module"; path: ModulePath }
    | { kind: "package"; name: string }
    | { kind: "asset" }
    | { kind: "unresolved" }

/** 指定を、リポジトリ直下からの相対パスの候補へ解決する。 */
const resolveSpecifier = (
    root: string,
    fromRel: ModulePath,
    specifier: string,
    known: Set<string>,
): Resolution => {
    const isAlias = specifier.startsWith("@/")
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../")
    if (!isAlias && !isRelative) {
        return { kind: "package", name: specifier }
    }
    if (ASSET_PATTERN.test(specifier)) {
        return { kind: "asset" }
    }
    const base = isAlias
        ? path.join(root, "src", specifier.slice(2))
        : path.resolve(root, path.dirname(fromRel), specifier)
    // 生成物への import は検査の対象外（辺にも未解決にもしない）
    if (toPosix(path.relative(root, base)).startsWith(GENERATED_PREFIX)) {
        return { kind: "asset" }
    }
    const stripped = base.replace(/\.js$/, "")
    const candidates = [base, stripped]
    for (const stem of [base, stripped]) {
        for (const ext of CODE_EXTENSIONS) candidates.push(stem + ext)
    }
    for (const ext of CODE_EXTENSIONS)
        candidates.push(path.join(base, "index" + ext))
    for (const candidate of candidates) {
        const rel = toPosix(path.relative(root, candidate))
        if (known.has(rel)) return { kind: "module", path: rel }
    }
    return { kind: "unresolved" }
}

/**
 * `root` 直下の `src/` を走査して、モジュールの一覧と import 辺を返す。
 * 読み取りに失敗した場合は例外を投げる（検査の結果を信用しないため）。
 */
export const scanModules = (root: string): ModuleGraph => {
    const srcDir = path.join(root, "src")
    const modules = walk(srcDir)
        .map(file => toPosix(path.relative(root, file)))
        .filter(rel => !rel.startsWith(GENERATED_PREFIX))
        .sort()
    const known = new Set(modules)
    const edges: ImportEdge[] = []
    const unresolved: UnresolvedImport[] = []
    for (const rel of modules) {
        const text = fs.readFileSync(path.join(root, rel), "utf8")
        for (const raw of extractImports(rel, text)) {
            const resolution = resolveSpecifier(root, rel, raw.specifier, known)
            if (resolution.kind === "module") {
                edges.push({
                    from: rel,
                    specifier: raw.specifier,
                    typeOnly: raw.typeOnly,
                    target: { kind: "module", path: resolution.path },
                })
            } else if (resolution.kind === "package") {
                edges.push({
                    from: rel,
                    specifier: raw.specifier,
                    typeOnly: raw.typeOnly,
                    target: { kind: "package", name: resolution.name },
                })
            } else if (resolution.kind === "unresolved") {
                unresolved.push({ from: rel, specifier: raw.specifier })
            }
        }
    }
    return { modules, edges, unresolved }
}
