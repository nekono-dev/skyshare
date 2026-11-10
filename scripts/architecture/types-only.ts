/**
 * 依存規則の検査の規則 typesOnly（structure-checks 3.4）。
 *
 * 責務と処理概要:
 * - `src/types/` の `.ts` の本文を構文木で読み、型だけの文以外を違反として返す。
 * - 型だけの文は `type` 宣言・`interface` 宣言・`export type`・`export interface`・`import type`
 *   と、`export type` 付きの再エクスポート（`export type * from`・`export type * as ns from`・
 *   `export type { ... } from`）。
 * - それ以外（値の宣言・`export default`・値の import・`export *`・`export * as`・値の `export { } from`）は違反（specifier は空文字）。
 * - 純粋な関数で、ファイルを読まない。読み取りは `check-imports.ts` が行う。
 *
 * 実装上の制約:
 * - 構文木の解析は `import-graph.ts` と同じ `typescript` を使う（新しい依存を増やさない）。
 * - `export type` 付きの再エクスポート（`*`・`* as`・名前付き）は型だけの文として許容する（requirements 8.4）。
 */
import ts from "typescript"
import type { Violation } from "./rules"

/** 判定の入力。`path` は `src/types/` 配下の `.ts` のパス、`text` は本文（UTF-8）。 */
export type TypesOnlyFile = { path: string; text: string }

/** 文が指定の修飾子（export・default など）を持つかを返す。 */
const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === kind)

/** 文が型だけの文の形（許容の文）なら true。それ以外は false（違反）。 */
const isTypeOnlyStatement = (statement: ts.Statement): boolean => {
    // type 宣言・interface 宣言（export type・export interface・declare type を含む）
    if (
        ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement)
    ) {
        // `export default interface` は既定の export なので違反にする
        return !hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    }
    // import type だけを許容する。副作用の import（`import "x"`）と値の import は違反
    if (ts.isImportDeclaration(statement)) {
        return statement.importClause?.isTypeOnly === true
    }
    // export type 付きの再エクスポート（export type *・export type * as ns from・
    // export type { ... } from）を許容する。値の再エクスポート（export *・export { } from）は違反
    if (ts.isExportDeclaration(statement)) {
        return statement.isTypeOnly
    }
    // 値の宣言・export =・import = などはすべて違反
    return false
}

/** `src/types/` の各ファイルの本文を読み、型だけの文以外を違反として返す。 */
export const findTypesOnlyViolations = (
    files: readonly TypesOnlyFile[],
): Violation[] => {
    const found: Violation[] = []
    for (const file of files) {
        const sourceFile = ts.createSourceFile(
            file.path,
            file.text,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        )
        for (const statement of sourceFile.statements) {
            if (isTypeOnlyStatement(statement)) continue
            found.push({
                ruleId: "typesOnly",
                from: file.path,
                specifier: "",
                message:
                    "src/types/ は型だけを持つ（値の宣言と値の import は禁止）",
            })
        }
    }
    return found
}
