/** 予約投稿 API の応答を組み立てる。 */

import { jsonResponse } from "@/util/http"

export type ScheduleErrorCode =
    "ScheduleCredentialRequired" | "ScheduleReauthRequired" | "ScheduleRunning"

export const codeErrorResponse = (
    status: number,
    code: ScheduleErrorCode,
): Response =>
    jsonResponse(
        { error: code },
        { status, headers: { "cache-control": "no-store" } },
    )

export const toIso = (epochSeconds: number): string =>
    new Date(epochSeconds * 1000).toISOString()
