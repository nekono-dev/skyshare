/**
 * 予約投稿の API の応答の組み立て。
 *
 * 責務と処理概要:
 * - 状態ごとの競合を区別するため、`error` に機械可読の識別子を入れたエラー応答を返す。
 * - すべての応答に `cache-control: no-store` を付ける。
 */

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
