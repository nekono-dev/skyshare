/**
 * 予約投稿の API の応答の組み立て。
 *
 * 責務と処理概要:
 * - 状態ごとの競合を区別するため、`error` に機械可読の識別子を入れたエラー応答を返す。
 * - すべての応答に `cache-control: no-store` を付ける。
 */

export type ScheduleErrorCode =
    "ScheduleCredentialRequired" | "ScheduleReauthRequired" | "ScheduleRunning"

/**
 * JSON の応答を返す。
 *
 * Input:
 * - `setCookies`: 応答に付ける Set-Cookie の値（登録状態のヒントの保存・失効に使う）
 */
export const jsonResponse = (
    body: unknown,
    status = 200,
    setCookies: string[] = [],
): Response => {
    const headers = new Headers({
        "content-type": "application/json",
        "cache-control": "no-store",
    })
    for (const cookie of setCookies) headers.append("set-cookie", cookie)
    return new Response(JSON.stringify(body), { status, headers })
}

export const codeErrorResponse = (
    status: number,
    code: ScheduleErrorCode,
): Response => jsonResponse({ error: code }, status)

export const toIso = (epochSeconds: number): string =>
    new Date(epochSeconds * 1000).toISOString()
