/**
 * 予約用 OAuth 認証情報を保管用 JSON と文字列の間で変換する。
 *
 * - Cron は登録時のオリジンを持たないため、トークン更新に必要なクライアント識別子を認証情報と一緒に保管する。
 * - 認証情報の構造に合わない文字列（アプリパスワード形式を含む）は読み出し時に null とする。
 */
import { type EcPrivateJwk, isEcPrivateJwk } from "@/lib/oauth/jose"

export type OAuthCredential = {
    v: 1
    clientId: string
    refreshToken: string
    dpopJwk: EcPrivateJwk
    issuer: string
    tokenEndpoint: string
    revocationEndpoint?: string
}

/** 保管する文字列にする */
export const serializeCredential = (c: OAuthCredential): string =>
    JSON.stringify(c)

/**
 * 保管した文字列を読む。
 *
 * Example: `parseCredential("REFRESH-ONLY")` → null（アプリパスワード形式）
 */
export const parseCredential = (text: string): OAuthCredential | null => {
    let v: unknown
    try {
        v = JSON.parse(text)
    } catch {
        return null
    }
    if (!v || typeof v !== "object") return null
    const c = v as Record<string, unknown>
    if (
        c.v !== 1 ||
        typeof c.clientId !== "string" ||
        typeof c.refreshToken !== "string" ||
        !isEcPrivateJwk(c.dpopJwk) ||
        typeof c.issuer !== "string" ||
        typeof c.tokenEndpoint !== "string" ||
        (c.revocationEndpoint !== undefined &&
            typeof c.revocationEndpoint !== "string")
    ) {
        return null
    }
    return c as unknown as OAuthCredential
}
