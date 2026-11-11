/**
 * 辞書エントリの型。辞書と翻訳処理の双方が参照し、依存の循環を防ぐ位置に置く。
 */

/** 辞書1件の形（辞書ファイルの `satisfies` 用）。 */
export type MessageEntries = Record<string, string>
