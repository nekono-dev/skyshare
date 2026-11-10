/**
 * `unknown` 値を、null と配列を除くオブジェクトとして判定する汎用ユーティリティ。
 *
 * - skyshare 固有の型を持たず、JavaScript の標準の型だけを扱う。
 */

/**
 * 値が null と配列を除くオブジェクトかを判定する。
 *
 * Input:
 * - `value`: 判定対象
 *
 * Output:
 * - オブジェクトなら `true`
 *
 * 例:
 * - 入力: `{ a: 1 }`
 * - 出力: `true`
 * - 入力: `null` / `[1, 2]`
 * - 出力: `false`
 */
export const isObjectRecord = (
    value: unknown,
): value is Record<string, unknown> => {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}
