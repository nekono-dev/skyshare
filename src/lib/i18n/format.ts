/**
 * 日時・数値の書式化（表示言語に追従）。
 *
 * 責務と処理概要:
 * - `ja-JP` 固定だった `toLocaleString` を、表示言語に応じた `Intl` ロケールへ置き換える。
 * - `textCount.ts` の文字数計数用 `Intl.Segmenter` は表示言語と無関係なため対象外。
 */
import type { Locale } from "./locale"

const intlLocale = (locale: Locale): string =>
    locale === "ja" ? "ja-JP" : "en-US"

/**
 * 日時を表示言語の書式で文字列化する。
 *
 * Input:
 * - `value`: ISO 文字列・エポックミリ秒・Date
 * - `locale`: 表示言語
 * - `options`: `Intl.DateTimeFormat` のオプション。省略時は `toLocaleString` の既定（日付と時刻）
 *
 * Output:
 * - 書式化済みの文字列。日付として解釈できない場合は空文字
 *
 * 例:
 * - 入力: `("2026-09-06T10:00:00.000Z", "ja", { timeZone: "Asia/Tokyo" })` → 出力: `"2026/9/6 19:00:00"`
 */
export const formatDateTime = (
    value: string | number | Date,
    locale: Locale,
    options?: Intl.DateTimeFormatOptions,
): string => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleString(intlLocale(locale), options)
}

/**
 * 数値を表示言語の書式（桁区切り等）で文字列化する。
 *
 * Input:
 * - `value`: 数値
 * - `locale`: 表示言語
 *
 * Output:
 * - 書式化済みの文字列
 *
 * 例:
 * - 入力: `(12345, "en")` → 出力: `"12,345"`
 */
export const formatNumber = (value: number, locale: Locale): string => {
    return value.toLocaleString(intlLocale(locale))
}
