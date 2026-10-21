/**
 * UTF-8 のバイト数に関する補助関数。
 *
 * 責務と処理概要:
 * - lexicon の `maxLength` は文字数ではなく UTF-8 のバイト数の上限のため、
 *   見出し・説明文の上限判定と切り詰めをバイト数で行えるようにする。
 * - 他のモジュールへ依存しない（OpenAPI のスキーマ定義から相対 import されるため）。
 */

const encoder = new TextEncoder()

/**
 * UTF-8 に符号化したときのバイト数を返す。
 *
 * - 入力: `"あa"`
 * - 出力: `4`
 */
export const countUtf8Bytes = (text: string): number =>
    encoder.encode(text).length

/**
 * UTF-8 のバイト数が上限以内に収まるよう、末尾を切り詰める。
 *
 * 処理の趣旨:
 * - 絵文字などの結合文字を途中で分断しないよう、書記素の単位で切る。
 *
 * - 入力: `("あいう", 7)`
 * - 出力: `"あい"`
 */
export const truncateToUtf8Bytes = (text: string, maxBytes: number): string => {
    if (countUtf8Bytes(text) <= maxBytes) return text
    let result = ""
    let bytes = 0
    for (const { segment } of new Intl.Segmenter("ja-JP", {
        granularity: "grapheme",
    }).segment(text)) {
        const size = countUtf8Bytes(segment)
        if (bytes + size > maxBytes) break
        result += segment
        bytes += size
    }
    return result
}
