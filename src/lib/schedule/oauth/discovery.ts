/**
 * PDS から、そのアカウントの認可サーバーとその端点を探す。
 *
 * 責務と処理概要:
 * - PDS の保護されたリソースのメタデータから認可サーバーを1つ選び、認可サーバーのメタデータを取得する。
 * - 認可サーバーの識別子とメタデータの `issuer` が一致し、必要な端点と方式（PAR・DPoP の ES256・
 *   private_key_jwt）を持つことを確かめる。満たさなければ null を返す。
 *
 * - ログイン中のアカウントの DID から、DID ドキュメントに書かれた実際の PDS を解決する。
 *
 * 前提:
 * - DID は利用者のログイン中のセッションのものを使う（利用者が指定したものを使わない）。
 *   PDS から辿った認可サーバーで認可するため、その認可サーバーがそのアカウントの正当な発行元になる。
 */
import { plcDirectoryBaseUrl } from "@/env"
import { readPdsServiceFromDidDoc } from "@/lib/atproto/did"

export type AuthorizationServer = {
    issuer: string
    authorizationEndpoint: string
    parEndpoint: string
    tokenEndpoint: string
    revocationEndpoint?: string
}

const getJson = async (
    url: string,
    fetchImpl: typeof fetch,
): Promise<Record<string, unknown> | null> => {
    try {
        const res = await fetchImpl(url, {
            headers: { accept: "application/json" },
        })
        if (!res.ok) return null
        return (await res.json()) as Record<string, unknown>
    } catch {
        return null
    }
}

const includes = (value: unknown, item: string): boolean =>
    Array.isArray(value) && value.includes(item)

/**
 * PDS の認可サーバーを探す。
 *
 * Input: `pdsUrl`（例: `https://bsky.social`）
 * Output: 認可サーバーの端点。見つからない・条件を満たさないときは null
 */
export const discoverAuthorizationServer = async (
    pdsUrl: string,
    fetchImpl: typeof fetch = fetch,
): Promise<AuthorizationServer | null> => {
    const pds = new URL(pdsUrl).origin
    const resource = await getJson(
        `${pds}/.well-known/oauth-protected-resource`,
        fetchImpl,
    )
    const servers = resource?.authorization_servers
    const issuer =
        Array.isArray(servers) && typeof servers[0] === "string"
            ? servers[0]
            : null
    if (!issuer) return null

    const meta = await getJson(
        `${new URL(issuer).origin}/.well-known/oauth-authorization-server`,
        fetchImpl,
    )
    if (!meta || meta.issuer !== issuer) return null
    const authorizationEndpoint = meta.authorization_endpoint
    const parEndpoint = meta.pushed_authorization_request_endpoint
    const tokenEndpoint = meta.token_endpoint
    if (
        typeof authorizationEndpoint !== "string" ||
        typeof parEndpoint !== "string" ||
        typeof tokenEndpoint !== "string" ||
        !includes(meta.dpop_signing_alg_values_supported, "ES256") ||
        !includes(meta.token_endpoint_auth_methods_supported, "private_key_jwt")
    ) {
        return null
    }
    return {
        issuer,
        authorizationEndpoint,
        parEndpoint,
        tokenEndpoint,
        ...(typeof meta.revocation_endpoint === "string"
            ? { revocationEndpoint: meta.revocation_endpoint }
            : {}),
    }
}

/**
 * アカウントの DID から、DID ドキュメントに書かれた実際の PDS の URL を解決する。
 * ログインのセッションの接続先はエントリーウェイ（例: bsky.social）の場合があり、
 * OAuth のトークンは実際の PDS に向けて発行されるため、DID ドキュメントの値を使う。
 *
 * Input: `did:plc:...` または `did:web:...`
 * Output: PDS の URL。解決できなければ null
 */
export const resolvePdsUrl = async (
    did: string,
    fetchImpl: typeof fetch = fetch,
): Promise<string | null> => {
    let docUrl: string
    if (did.startsWith("did:plc:")) {
        docUrl = new URL(`/${encodeURIComponent(did)}`, plcDirectoryBaseUrl)
            .href
    } else if (did.startsWith("did:web:")) {
        const host = decodeURIComponent(did.slice("did:web:".length))
        if (host.includes(":") || host.includes("/")) return null
        docUrl = `https://${host}/.well-known/did.json`
    } else {
        return null
    }
    const doc = await getJson(docUrl, fetchImpl)
    return (doc && readPdsServiceFromDidDoc(doc)) ?? null
}
