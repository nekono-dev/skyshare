import { v2BackendEndpoint } from "./endpoint"
import { defaultService } from "@/utils/atproto_api/base"

// v2バックエンド POST /v2/bsky/session の呼び出し。
// 成功時はv2がHttpOnly Cookie(atp_session)をブラウザへ発行し、
// 以後 createV2Entry などの呼び出しがそのCookieで認証される。
// (v2側はアクセストークンをレスポンスに含めないため、呼び出し側でJWTを保持することはできない)

export type createV2SessionResult = { ok: true } | createV2SessionErrorResult
export type createV2SessionErrorResult = {
    error: string
    message: string
}

export const api = async ({
    identifier,
    password,
    service = defaultService,
}: {
    identifier: string
    password: string
    service?: string
}): Promise<createV2SessionResult> => {
    try {
        const response = await fetch(`${v2BackendEndpoint}/v2/bsky/session/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ identifier, password, service }),
        })
        if (!response.ok) {
            let message = `v2 session request failed (status ${response.status})`
            try {
                const body = (await response.json()) as { error?: string }
                if (typeof body?.error === "string") {
                    message = body.error
                }
            } catch {
                // レスポンスがJSONでない場合はデフォルトメッセージを使用する
            }
            return { error: "V2SessionError", message }
        }
        return { ok: true }
    } catch (e: unknown) {
        return {
            error: "V2SessionError",
            message:
                e instanceof Error ? e.message : "Unexpected Unknown Error",
        }
    }
}

export default api
