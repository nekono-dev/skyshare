/**
 * 予約日時の入力と変換（画面側）。
 *
 * 責務と処理概要:
 * - 日時の既定値（現在から1時間後）を作る。
 * - 端末のタイムゾーンで日時を入力・表示し、送信時はタイムゾーンの差を含む ISO 8601 に変換する。
 * - 範囲の判定は、サーバーが返す制限値に従う（範囲の数値をこのファイルに持たない）。
 */

export type RunAtLimits = { minLeadSeconds: number; maxLeadSeconds: number }

const pad = (n: number): string => String(n).padStart(2, "0")

export const defaultRunAt = (now: Date): Date =>
    new Date(now.getTime() + 60 * 60 * 1000)

/** `datetime-local` 入力の値（`YYYY-MM-DDTHH:mm`、端末のタイムゾーン）。 */
export const toLocalInputValue = (d: Date): string =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`

/** `datetime-local` の値を、`+09:00` のような差を含む ISO 8601 に変換する。 */
export const toRunAtIso = (localValue: string): string => {
    const offset = -new Date(localValue).getTimezoneOffset()
    const sign = offset >= 0 ? "+" : "-"
    const abs = Math.abs(offset)
    return `${localValue}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

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
