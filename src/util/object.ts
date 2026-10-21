/**
 * オブジェクト判定の汎用ユーティリティ群。
 *
 * 責務と処理概要:
 * - `unknown` 値がプレーンオブジェクトかどうかを判定する。
 * - skyshare固有のドメイン知識を持たない、JavaScript標準の型のみを扱う処理。
 */

/**
 * 値がプレーンオブジェクトかを判定する。
 *
 * 処理の趣旨:
 * - API 入力等の `unknown` 値の最小要件を検証するため、null/配列を除外する。
 *
 * Input:
 * - `value`: 判定対象
 *
 * Output:
 * - プレーンオブジェクトなら `true`
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
