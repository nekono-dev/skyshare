/**
 * API エラーレスポンス生成ユーティリティ群。
 *
 * 責務と処理概要:
 * - HTTP ステータスからフロント向けの標準エラーレスポンスを生成する。
 * - atproto クライアントの例外を HTTP ステータスへ正規化する。
 * - ヘッダー変換等のドメイン非依存な処理は `@/util/http` を参照。
 */

import { XRPCError } from "@atproto/xrpc"

/**
 * HTTP ステータスに対応する JSON エラーレスポンスを生成する。
 *
 * 処理の趣旨:
 * - API 層で共通のエラー形式 `{ error: string }` を維持する。
 * - `switch` で主要なクライアント/認証/レート制限エラーを明示し、未定義は 500 相当へ寄せる。
 *
 * Input:
 * - `status`: 返却する HTTP ステータス
 *
 * Output:
 * - `content-type: application/json` を持つ `Response`
 *
 * 例:
 * - 入力: `401`
 * - 出力: `{"error":"Unauthorized"}` を含む `Response`
 */
export const errorResponseFromStatus = (status: number): Response => {
    const message = { error: "Unknown Error" }
    switch (status) {
        case 400:
            message.error = "Bad Request"
            break
        case 401:
            message.error = "Unauthorized"
            break
        case 403:
            message.error = "Forbidden"
            break
        case 404:
            message.error = "Not Found"
            break
        case 429:
            message.error = "Too Many Requests"
            break
        default:
            message.error = "Internal Server Error"
            break
    }
    return new Response(JSON.stringify(message), {
        status: status,
        headers: { "content-type": "application/json" },
    })
}

/**
 * XRPC エラーを HTTP ステータスへ変換する。
 *
 * 処理の趣旨:
 * - atproto クライアントのラッパー例外（cause に XRPCError を持つ）も辿って error code を抽出する。
 *
 * Input:
 * - `error`: unknown エラー
 *
 * Output:
 * - 401/404/429/500 のいずれか
 */
export const resolveXrpcStatus = (error: unknown): number => {
    let current: unknown = error
    let errorCode: string | undefined

    while (current !== undefined) {
        if (current instanceof XRPCError) {
            errorCode = current.error
            break
        }

        if (!current || typeof current !== "object") {
            break
        }

        const maybeError = (current as { error?: unknown }).error
        if (typeof maybeError === "string") {
            errorCode = maybeError
            break
        }

        current = (current as { cause?: unknown }).cause
    }

    if (!errorCode) {
        return 500
    }

    switch (errorCode) {
        case "AuthenticationRequired":
        case "InvalidToken":
        case "ExpiredToken":
            return 401
        case "RateLimitExceeded":
            return 429
        case "BlobNotFound":
        case "RepoNotFound":
        case "RecordNotFound":
            return 404
        default:
            return 500
    }
}
