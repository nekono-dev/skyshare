/**
 * 予約投稿の API エラーを、表示言語の文言キーへ変換する。
 *
 * 責務と処理概要:
 * - 409 は `error` の識別子で 3 種に分ける。それ以外はステータスで決める。
 * - サーバーの `error` 文字列は画面に表示しない。
 */
import type { PlainMessageKey } from "@/lib/i18n/translate"

export const scheduleErrorKey = (
    status: number,
    code?: string,
): PlainMessageKey => {
    switch (status) {
        case 400:
            return "schedule.error.invalid"
        case 401:
            return "error.unauthorized"
        case 409:
            if (code === "ScheduleCredentialRequired") {
                return "schedule.error.credentialRequired"
            }
            if (code === "ScheduleReauthRequired") {
                return "schedule.error.reauthRequired"
            }
            if (code === "ScheduleRunning") return "schedule.error.running"
            return "error.conflict"
        case 429:
            return "schedule.error.tooMany"
        case 404:
            return "schedule.error.notFound"
        default:
            return "schedule.error.server"
    }
}

const FAILURE_KEYS = {
    CredentialMissing: "schedule.failure.CredentialMissing",
    CredentialInvalid: "schedule.failure.CredentialInvalid",
    CredentialExpired: "schedule.failure.CredentialExpired",
    InvalidRecord: "schedule.failure.InvalidRecord",
    ImageMissing: "schedule.failure.ImageMissing",
    RetryExceeded: "schedule.failure.RetryExceeded",
} as const satisfies Record<string, PlainMessageKey>

/** 失敗の分類コードに対応する文言キー。未知のコードは汎用の文言になる。 */
export const failureMessageKey = (code: string | null): PlainMessageKey =>
    (FAILURE_KEYS as Record<string, PlainMessageKey>)[code ?? ""] ??
    "schedule.failure.unknown"
