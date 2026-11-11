/**
 * API エラーをフロントエンド向けの HTTP ステータスへ正規化する。
 *
 * - 全リクエストで読み込まれるミドルウェアから参照される。`@atproto/*` を import すると Worker の起動（cold start）ごとに atproto クライアント全体（約 1.3MB）の評価（約 70ms）が発生し、Workers 無料枠の CPU 上限を圧迫するため import しない。
 */

/**
 * XRPC エラーを HTTP ステータスへ変換する。
 *
 * 処理の趣旨:
 * - atproto クライアントのラッパー例外（cause に XRPCError を持つ）も辿って error code を抽出する。
 * - `XRPCError` は文字列の `error` プロパティを必ず持つ（未指定ならHTTPステータス名）ため、
 *   クラスを import せず `error` プロパティの有無で判定する。
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
        case "DraftLimitReached":
            return 429
        case "BlobNotFound":
        case "RepoNotFound":
        case "RecordNotFound":
            return 404
        default:
            return 500
    }
}
