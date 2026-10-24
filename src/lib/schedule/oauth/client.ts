/**
 * 予約投稿の OAuth クライアント（confidential client）の定義。
 *
 * 責務と処理概要:
 * - クライアントの識別子・戻り先・要求する権限を、配信しているオリジンから決める。
 *   プレビューや develop など、オリジンごとに別のクライアントとして振る舞う。
 * - クライアントのメタデータ（client_id の URL で公開する JSON）と公開鍵の一覧（JWKS）を作る。
 * - トークンの取得のたびに、クライアントの秘密鍵でクライアントの証明（private_key_jwt）を作る。
 *
 * 前提:
 * - クライアントの秘密鍵は Worker のシークレット `SCHEDULE_OAUTH_KEY` に、P-256 の秘密鍵の
 *   JWK（`kid` を含む）の JSON で置く。生成は `hack/generate-oauth-key.mjs` で行う。
 */
import { ENTRY_COLLECTION } from "@/lib/atproto/nsid"
import {
    type EcPrivateJwk,
    importSigningKey,
    isEcPrivateJwk,
    randomString,
    signJwt,
    toPublicJwk,
} from "./jose"

/** クライアントの識別子（メタデータを公開する URL） */
export const clientIdFor = (origin: string): string =>
    `${origin}/oauth/client-metadata.json`

/** 認可の後の戻り先 */
export const redirectUriFor = (origin: string): string =>
    `${origin}/oauth/callback/`

/** 公開鍵の一覧の URL */
export const jwksUriFor = (origin: string): string =>
    `${origin}/oauth/jwks.json`

/** 予約の実行で書き込むコレクション。putRecord は新規作成と上書きの両方になりうる */
const WRITE_COLLECTIONS = [
    "app.bsky.feed.post",
    "app.bsky.feed.threadgate",
    "app.bsky.feed.postgate",
    ENTRY_COLLECTION,
]

/**
 * 要求する権限。予約の実行に必要な、投稿・返信と引用の制限・entry のレコードの作成と上書きと、
 * 画像のアップロードに限る。
 */
export const OAUTH_SCOPE = [
    "atproto",
    ...WRITE_COLLECTIONS.map(
        collection => `repo:${collection}?action=create&action=update`,
    ),
    "blob:image/*",
].join(" ")

/** クライアントのメタデータ */
export const clientMetadata = (origin: string, clientName: string) => ({
    client_id: clientIdFor(origin),
    client_name: clientName,
    client_uri: `${origin}/`,
    redirect_uris: [redirectUriFor(origin)],
    scope: OAUTH_SCOPE,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "private_key_jwt",
    token_endpoint_auth_signing_alg: "ES256",
    dpop_bound_access_tokens: true,
    jwks_uri: jwksUriFor(origin),
})

/** 読み込んだクライアントの秘密鍵 */
export type ClientKey = { key: CryptoKey; jwk: EcPrivateJwk; kid: string }

/**
 * シークレットの JSON からクライアントの秘密鍵を読み込む。
 *
 * Output: 鍵。シークレットが無い・形が違うときは null
 */
export const loadClientKey = async (
    secret: string | undefined,
): Promise<ClientKey | null> => {
    if (!secret) return null
    let parsed: unknown
    try {
        parsed = JSON.parse(secret)
    } catch {
        return null
    }
    if (!isEcPrivateJwk(parsed) || typeof parsed.kid !== "string") return null
    return { key: await importSigningKey(parsed), jwk: parsed, kid: parsed.kid }
}

/** 公開鍵の一覧（JWKS） */
export const clientJwks = (client: ClientKey) => ({
    keys: [
        {
            ...toPublicJwk(client.jwk),
            kid: client.kid,
            alg: "ES256",
            use: "sig",
        },
    ],
})

/**
 * トークンの取得に添えるクライアントの証明（private_key_jwt）を作る。
 *
 * Input:
 * - `client`: クライアントの秘密鍵
 * - `clientId`: クライアントの識別子
 * - `issuer`: 認可サーバーの識別子（証明の宛先）
 * - `now`: 現在時刻（UNIX 秒）
 *
 * Output: トークンの要求の本文に足すフォームの項目
 */
export const clientAssertionParams = async (
    client: ClientKey,
    clientId: string,
    issuer: string,
    now: number,
): Promise<Record<string, string>> => ({
    client_id: clientId,
    client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: await signJwt(
        { kid: client.kid, typ: "JWT" },
        {
            iss: clientId,
            sub: clientId,
            aud: issuer,
            jti: randomString(16),
            iat: now,
            exp: now + 60,
        },
        client.key,
    ),
})
