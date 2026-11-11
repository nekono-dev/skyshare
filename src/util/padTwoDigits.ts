/** 0 から 99 までの整数を 2 桁の文字列に整える。 */

/**
 * 0 から 99 までの整数を 2 桁の文字列にする（1 桁は 0 で埋める）。
 * Input:
 * - `n`: 0 から 99 までの整数
 *
 * Output:
 * - 2 桁の文字列
 *
 * 例:
 * - 入力: `5`
 * - 出力: `"05"`
 */
export const padTwoDigits = (n: number): string => String(n).padStart(2, "0")
