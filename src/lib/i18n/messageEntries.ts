/**
 * 辞書の型（依存のない位置に置く）。
 *
 * 責務と処理概要:
 * - 辞書ファイルが `satisfies` で使う、辞書1件の形を定める。
 * - import を持たない。辞書と翻訳の実行の両方が参照しても、循環を作らないためにここに置く。
 */

/** 辞書1件の形（辞書ファイルの `satisfies` 用）。 */
export type MessageEntries = Record<string, string>
