/**
 * ISO 3166-1 alpha-2（2 文字の国コード）を、国旗絵文字（国を表す記号 2 文字の組み合わせ）へ変換する。
 */

/**
 * ISO 3166-1 alpha-2 を国旗絵文字へ変換する。
 *
 * Input:
 * - `code`: 2文字の英字（大文字小文字不問）
 *
 * Output:
 * - 国旗絵文字。2文字の英字以外は `undefined`
 *
 * 例:
 * - 入力: `"JP"`
 * - 出力: `"🇯🇵"`
 */
export const countryCodeToFlagEmoji = (code: string): string | undefined => {
    if (!/^[A-Za-z]{2}$/.test(code)) return undefined
    const base = 0x1f1e6 - "A".charCodeAt(0)
    return String.fromCodePoint(
        ...[...code.toUpperCase()].map(c => base + c.charCodeAt(0)),
    )
}
