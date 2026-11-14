/**
 * 公開結果の実施時期・割合・最大選択肢を表示用に整える。
 *
 * - 時期は保存値のオフセットを変換せず、暦の日付として扱う。
 */
import type { Locale } from "@/lib/i18n/locale"

const ISO_DATE_TIME =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:Z|[+-]\d{2}:\d{2})$/

type CalendarParts = { year: number; month: number; day: number }

const calendarParts = (value: string): CalendarParts => {
    const match = ISO_DATE_TIME.exec(value)
    if (!match) throw new RangeError("Invalid ISO date-time")
    const [, year, month, day, hour, minute, second, fraction = ""] = match
    const parts = {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour),
        minute: Number(minute),
        second: Number(second),
        millisecond: Number((fraction + "000").slice(0, 3)),
    }
    const timestamp = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond,
    )
    const date = new Date(timestamp)
    if (
        date.getUTCFullYear() !== parts.year ||
        date.getUTCMonth() + 1 !== parts.month ||
        date.getUTCDate() !== parts.day ||
        parts.hour > 23 ||
        parts.minute > 59 ||
        parts.second > 59
    )
        throw new RangeError("Invalid ISO date-time")
    return { year: parts.year, month: parts.month, day: parts.day }
}

const paddedDate = ({ year, month, day }: CalendarParts): string =>
    `${String(year).padStart(4, "0")}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`

/**
 * 開始日と期間に含まれる最後の日を表記する。
 *
 * Input: 保存されたオフセットを含む開始・終了 ISO 日時
 * Output: `YYYY/MM/DD` の開始日と、同年なら `MM/DD` の終了日
 * 例: `formatSurveyPeriod("2026-09-01T00:00:00+09:00", "2026-10-01T00:00:00+09:00")` → `{ start: "2026/09/01", end: "09/30" }`
 */
export const formatSurveyPeriod = (
    opensAt: string,
    closesAt: string,
): { start: string; end: string } => {
    const start = calendarParts(opensAt)
    const closing = calendarParts(closesAt)
    const closeMatch = ISO_DATE_TIME.exec(closesAt)
    if (!closeMatch) throw new RangeError("Invalid ISO date-time")
    const [, year, month, day, hour, minute, second, fraction = ""] = closeMatch
    // 終了時刻の 1 ミリ秒前が前日になるのは、0 時から 1 ミリ秒未満（秒の小数の先頭 3 桁が 0）のとき
    const atMidnight =
        hour === "00" &&
        minute === "00" &&
        second === "00" &&
        fraction.slice(0, 3).padEnd(3, "0") === "000"
    const finalCalendarDate = atMidnight
        ? new Date(
              Date.UTC(Number(year), Number(month) - 1, Number(day)) -
                  86_400_000,
          )
        : new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    const end = {
        year: finalCalendarDate.getUTCFullYear(),
        month: finalCalendarDate.getUTCMonth() + 1,
        day: finalCalendarDate.getUTCDate(),
    }
    return {
        start: paddedDate(start),
        end:
            end.year === start.year
                ? `${String(end.month).padStart(2, "0")}/${String(end.day).padStart(2, "0")}`
                : paddedDate(end),
    }
}

/**
 * 割合を表示言語の数値書式で小数点以下 1 桁まで表記する。
 *
 * Input: 0 以上 100 以下の割合と表示言語
 * Output: 単位を含まない数値文字列
 * 例: `formatPercent(50, "ja")` → `"50"`
 */
export const formatPercent = (percent: number, locale: Locale): string =>
    new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
        maximumFractionDigits: 1,
    }).format(percent)

/**
 * 質問内で最大の割合を持つ選択肢 ID を返す。
 *
 * Input: 選択肢 ID と割合の配列
 * Output: 最大が正なら同率を含む ID の集合、全て 0 または空配列なら空集合
 * 例: `topOptionIds([{ id: "a", percent: 50 }])` → `Set(["a"])`
 */
export const topOptionIds = (
    options: { id: string; percent: number }[],
): Set<string> => {
    if (options.length === 0) return new Set()
    const maximum = Math.max(...options.map(option => option.percent))
    if (maximum === 0) return new Set()
    return new Set(
        options
            .filter(option => option.percent === maximum)
            .map(option => option.id),
    )
}
