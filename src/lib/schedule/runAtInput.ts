/**
 * 予約日時の入力と変換（画面側）。
 *
 * 責務と処理概要:
 * - 日時の既定値（翌日の同時刻。秒以下は切り捨て）を作る。
 * - 端末のタイムゾーンで日時を入力・表示し、送信時はタイムゾーンの差を含む ISO 8601 に変換する。
 * - 範囲の判定は、サーバーが返す制限値に従う（範囲の数値をこのファイルに持たない）。
 * - 投稿フォームに出す「{日時}に予約」の日時の文字列を、表示言語の書式で作る。
 */

export type RunAtLimits = { minLeadSeconds: number; maxLeadSeconds: number }

const pad = (n: number): string => String(n).padStart(2, "0")

/**
 * 実行日時の既定値を作る。
 *
 * Input: `now`: 現在時刻
 * Output: `now` の24時間後で、秒とミリ秒を0にした日時
 * Example: `defaultRunAt(new Date("2027-03-01T10:15:42Z"))` → `2027-03-02T10:15:00Z`
 */
export const defaultRunAt = (now: Date): Date => {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    d.setSeconds(0, 0)
    return d
}

/**
 * `datetime-local` 入力の値（`YYYY-MM-DDTHH:mm`、端末のタイムゾーン）を作る。
 *
 * Example: 東京の端末で `toLocalInputValue(new Date("2027-03-01T10:30:00Z"))` → `"2027-03-01T19:30"`
 */
export const toLocalInputValue = (d: Date): string =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`

/**
 * `datetime-local` 入力の値を日時にする。
 *
 * Input: `"YYYY-MM-DDTHH:mm"`（端末のタイムゾーン）
 * Output: 日時。解釈できない値は null
 * Example: `fromLocalInputValue("")` → `null`
 */
export const fromLocalInputValue = (value: string): Date | null => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
    const d = new Date(value)
    return Number.isFinite(d.getTime()) ? d : null
}

/**
 * 日時を、端末のタイムゾーンの差を含む ISO 8601（秒まで）に変換する。
 *
 * Example: 東京の端末で `toRunAtIso(new Date("2027-03-01T10:30:00Z"))` → `"2027-03-01T19:30:00+09:00"`
 */
export const toRunAtIso = (d: Date): string => {
    const offset = -d.getTimezoneOffset()
    const sign = offset >= 0 ? "+" : "-"
    const abs = Math.abs(offset)
    return (
        `${toLocalInputValue(d)}:${pad(d.getSeconds())}` +
        `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
    )
}

/**
 * 日時がサーバーの示す範囲に入るかを判定する。
 *
 * Input: 判定する日時、現在時刻、制限値（秒）
 * Output: 範囲内は `"ok"`、近すぎる（解釈できない日時を含む）は `"tooSoon"`、遠すぎるは `"tooLate"`
 * Example: `checkRunAt(4分後, now, { minLeadSeconds: 300, maxLeadSeconds: 1209600 })` → `"tooSoon"`
 */
export const checkRunAt = (
    d: Date,
    now: Date,
    limits: RunAtLimits,
): "ok" | "tooSoon" | "tooLate" => {
    const leadSeconds = (d.getTime() - now.getTime()) / 1000
    if (!Number.isFinite(leadSeconds) || leadSeconds < limits.minLeadSeconds) {
        return "tooSoon"
    }
    if (leadSeconds > limits.maxLeadSeconds) return "tooLate"
    return "ok"
}

/**
 * 投稿フォームに表示する実行日時の文字列を作る（月・日・曜日・時・分）。
 *
 * Input: 日時、表示言語（`"ja"` / `"en"`）
 * Output: 表示言語の書式の文字列
 * Example: `formatRunAtLabel(d, "ja")` → `"10月23日(金) 14:00"`
 */
/**
 * 許可の有効期限の目安の日付を、表示言語の書式（年月日）にする。
 *
 * Example: `formatExpiryDate(new Date("2027-03-01T05:00:00Z"), "ja")` → `"2027/3/1"`（端末のタイムゾーン）
 */
export const formatExpiryDate = (d: Date, locale: string): string =>
    new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
    }).format(d)

export const formatRunAtLabel = (d: Date, locale: string): string =>
    new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d)
