/**
 * 保管する予約用の認可の情報の形と、文字列との相互変換。
 *
 * 責務と処理概要:
 * - 更新用トークン・DPoP の鍵・認可サーバーの端点・クライアントの識別子を1つの JSON にまとめ、保管の層（store）が
 *   暗号化して保存する。PDS の URL は保管の層の `service` に置く。
 * - クライアントの識別子は登録したときのオリジンで決まり、Cron の実行（オリジンを持たない）で
 *   トークンを更新するときに同じものを使う必要があるため、一緒に保管する。
 * - 読み出した文字列が形を満たさない（旧形式のアプリパスワードのトークンを含む）ときは null にする。
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
 * Example: `parseCredential("REFRESH-ONLY")` → null（旧形式）
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
