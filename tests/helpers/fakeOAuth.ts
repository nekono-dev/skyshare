/**
 * 予約投稿の OAuth の認可を確かめるための、DID の解決・PDS・認可サーバーを模した fetch。
 *
 * - PLC ディレクトリ: アカウントの DID ドキュメントを返し、PDS を `https://pds.example` にする。
 * - PDS: 保護されたリソースのメタデータで、認可サーバーを `https://auth.example` にする。
 * - 認可サーバー: メタデータ・PAR・トークン・取消の端点を持つ。PAR とトークンの端点は、
 *   nonce の無い最初の要求に `use_dpop_nonce` を返し、nonce つきの要求だけを受け付ける。
 * - PDS の XRPC: DPoP のアクセストークンを求め、nonce の無い最初の要求に 401 の `use_dpop_nonce` を返す。
 *   `com.atproto.server.getSession` はトークンの持ち主の DID とハンドルを返す。
 * - 受けた要求は `requests`（認可サーバーへのフォーム）と `pdsRequests`（PDS への XRPC）に記録する。
 */
export type OAuthRequest = {
    url: string
    form: Record<string, string>
    dpop?: string
}

export type PdsRequest = {
    url: string
    method: string
    authorization?: string
    dpop?: string
}

export type FakeOAuth = {
    fetch: typeof fetch
    requests: OAuthRequest[]
    pdsRequests: PdsRequest[]
    /** トークンの端点を失敗させるとき、その状態と `error` */
    tokenError?: { status: number; error: string }
    /** PDS の `getSession` が返す DID（既定はアカウントの DID）。null で 401 にする */
    sessionDid: string | null
    /** トークンの応答の `sub`（既定はアカウントの DID） */
    tokenSub: string
    /** 認可サーバーのメタデータの `issuer`（既定は `https://auth.example`） */
    issuer: string
}

export const AUTH = "https://auth.example"
export const PDS = "https://pds.example"
export const NONCE = "nonce-1"
export const PDS_NONCE = "pds-nonce-1"
export const HANDLE = "alice.test"

const json = (
    body: unknown,
    status = 200,
    headers: Record<string, string> = {},
) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...headers },
    })

/** JWT のヘッダーとペイロードを読む（署名の検証は呼び出し側で行う） */
export const decodeJwt = (jwt: string) => {
    const [h, p] = jwt.split(".")
    const read = (part: string) =>
        JSON.parse(
            Buffer.from(
                part.replace(/-/g, "+").replace(/_/g, "/"),
                "base64",
            ).toString(),
        )
    return { header: read(h!), payload: read(p!) }
}

/** JWT の ES256 の署名を、公開鍵の JWK で検証する */
export const verifyJwt = async (
    jwt: string,
    publicJwk: JsonWebKey,
): Promise<boolean> => {
    const [h, p, s] = jwt.split(".")
    const key = await crypto.subtle.importKey(
        "jwk",
        {
            kty: publicJwk.kty,
            crv: publicJwk.crv,
            x: publicJwk.x,
            y: publicJwk.y,
        },
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
    )
    return crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        Buffer.from(s!.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
        new TextEncoder().encode(`${h}.${p}`),
    )
}

export const createFakeOAuth = (
    did: string,
    options: { auth?: string } = {},
): FakeOAuth => {
    // 認可サーバーのオリジン（ログインの検証では Bluesky の認可サーバーと同じにする）
    const auth = options.auth ?? AUTH
    const world: FakeOAuth = {
        requests: [],
        pdsRequests: [],
        sessionDid: did,
        tokenSub: did,
        issuer: auth,
        fetch: (async (input: string, init: RequestInit = {}) => {
            const url = new URL(input)
            const h = new Headers(init.headers)
            const headers = {
                dpop: h.get("dpop") ?? undefined,
                authorization: h.get("authorization") ?? undefined,
            }
            const form =
                typeof init.body === "string"
                    ? Object.fromEntries(new URLSearchParams(init.body))
                    : {}
            if (url.origin === PDS && url.pathname.startsWith("/xrpc/")) {
                world.pdsRequests.push({
                    url: url.href,
                    method: init.method ?? "GET",
                    ...headers,
                })
                const proof = headers.dpop
                    ? decodeJwt(headers.dpop).payload
                    : undefined
                if (!headers.authorization?.startsWith("DPoP ")) {
                    return json({ error: "AuthenticationRequired" }, 401)
                }
                if (proof?.nonce !== PDS_NONCE) {
                    return json({ error: "use_dpop_nonce" }, 401, {
                        "dpop-nonce": PDS_NONCE,
                        "www-authenticate": 'DPoP error="use_dpop_nonce"',
                    })
                }
                if (url.pathname === "/xrpc/com.atproto.server.getSession") {
                    if (!world.sessionDid) {
                        return json({ error: "InvalidToken" }, 401)
                    }
                    return json(
                        { did: world.sessionDid, handle: HANDLE },
                        200,
                        { "dpop-nonce": PDS_NONCE },
                    )
                }
                return json({ ok: true }, 200, { "dpop-nonce": PDS_NONCE })
            }
            if (init.method === "POST") {
                world.requests.push({ url: url.href, form, dpop: headers.dpop })
            }
            if (url.origin === "https://plc.directory") {
                return json({
                    id: did,
                    service: [
                        {
                            id: "#atproto_pds",
                            type: "AtprotoPersonalDataServer",
                            serviceEndpoint: PDS,
                        },
                    ],
                })
            }
            if (url.href === `${PDS}/.well-known/oauth-protected-resource`) {
                return json({ resource: PDS, authorization_servers: [auth] })
            }
            if (url.href === `${auth}/.well-known/oauth-authorization-server`) {
                return json({
                    issuer: world.issuer,
                    authorization_endpoint: `${auth}/oauth/authorize`,
                    pushed_authorization_request_endpoint: `${auth}/oauth/par`,
                    token_endpoint: `${auth}/oauth/token`,
                    revocation_endpoint: `${auth}/oauth/revoke`,
                    dpop_signing_alg_values_supported: ["ES256"],
                    token_endpoint_auth_methods_supported: [
                        "none",
                        "private_key_jwt",
                    ],
                })
            }
            if (url.origin === auth && url.pathname.startsWith("/oauth/")) {
                const proof = headers.dpop
                    ? decodeJwt(headers.dpop).payload
                    : undefined
                if (!proof?.nonce) {
                    return json({ error: "use_dpop_nonce" }, 400, {
                        "dpop-nonce": NONCE,
                    })
                }
                switch (url.pathname) {
                    case "/oauth/par":
                        return json(
                            { request_uri: "urn:request:1", expires_in: 60 },
                            201,
                        )
                    case "/oauth/token":
                        if (world.tokenError) {
                            return json(
                                { error: world.tokenError.error },
                                world.tokenError.status,
                            )
                        }
                        return json({
                            access_token: "ACCESS-TOKEN-VALUE",
                            refresh_token: "REFRESH-TOKEN-VALUE",
                            token_type: "DPoP",
                            sub: world.tokenSub,
                            scope: form.scope ?? "atproto",
                            expires_in: 3600,
                        })
                    case "/oauth/revoke":
                        return new Response(null, { status: 200 })
                }
            }
            return new Response("not found", { status: 404 })
        }) as unknown as typeof fetch,
    }
    return world
}
