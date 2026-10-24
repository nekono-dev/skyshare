/**
 * Bluesky の OAuth クライアントの定義（ログインと予約投稿で共通）。
 *
 * 責務と処理概要:
 * - クライアントの識別子・戻り先・要求する権限を、配信しているオリジンから決める。
 *   プレビューや develop など、オリジンごとに別のクライアント（confidential client）として振る舞う。
 * - 配信元がループバックのホスト（手元の開発サーバー）なら、開発用の公開クライアントとして振る舞う。
 *   識別子に権限と戻り先を含め、クライアントの証明を付けない。
 * - クライアントのメタデータ（client_id の URL で公開する JSON）と公開鍵の一覧（JWKS）を作る。
 *   メタデータには、ログインと予約投稿の両方の権限を載せる（要求ごとに一部を指定する）。
 * - トークンの取得のたびに、クライアントの秘密鍵でクライアントの証明（private_key_jwt）を作る。
 *
 * 前提:
 * - クライアントの秘密鍵は Worker のシークレット `OAUTH_CLIENT_KEY` に、P-256 の秘密鍵の
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
import {
    isLoopbackClientId,
    isLoopbackOrigin,
    loopbackRedirectUri,
} from "./loopback"

/** 予約の実行で書き込むコレクション。putRecord は新規作成と上書きの両方になりうる */
const WRITE_COLLECTIONS = [
    "app.bsky.feed.post",
    "app.bsky.feed.threadgate",
    "app.bsky.feed.postgate",
    ENTRY_COLLECTION,
]

/**
 * ログインで要求する権限。アプリパスワードと同じ範囲（タイムライン・下書き・動画のサービス認証など、
 * 画面のすべての操作）を、利用者のパスワードを預からずに得る。
 */
export const SESSION_SCOPE = "atproto transition:generic"

/**
 * 予約投稿で要求する権限。予約の実行に必要な、投稿・返信と引用の制限・entry のレコードの作成と上書きと、
 * 画像のアップロードに限る。
 */
export const SCHEDULE_SCOPE = [
    "atproto",
    ...WRITE_COLLECTIONS.map(
        collection => `repo:${collection}?action=create&action=update`,
    ),
    "blob:image/*",
].join(" ")

/** クライアントが要求しうるすべての権限（重複を除いた和）。メタデータと開発用の識別子に載せる */
const CLIENT_SCOPE = [
    ...new Set([...SESSION_SCOPE.split(" "), ...SCHEDULE_SCOPE.split(" ")]),
].join(" ")

/**
 * 認可の後の戻り先。
 *
 * 例:
 * - 入力: `"https://skyshare.example.com"` → 出力: `"https://skyshare.example.com/oauth/callback/"`
 * - 入力: `"https://localhost:4321"` → 出力: `"http://127.0.0.1:4322/oauth/callback/"`
 */
export const redirectUriFor = (origin: string): string =>
    isLoopbackOrigin(origin)
        ? loopbackRedirectUri()
        : `${origin}/oauth/callback/`

/**
 * クライアントの識別子。本番などではメタデータを公開する URL、ループバックでは開発用の形にする。
 *
 * 例:
 * - 入力: `"https://skyshare.example.com"` → 出力: `"https://skyshare.example.com/oauth/client-metadata.json"`
 * - 入力: `"https://localhost:4321"` → 出力: `"http://localhost?redirect_uri=...&scope=..."`
 */
export const clientIdFor = (origin: string): string => {
    if (!isLoopbackOrigin(origin)) return `${origin}/oauth/client-metadata.json`
    const params = new URLSearchParams({
        redirect_uri: loopbackRedirectUri(),
        scope: CLIENT_SCOPE,
    })
    return `http://localhost?${params.toString()}`
}

/** 公開鍵の一覧の URL */
const jwksUriFor = (origin: string): string => `${origin}/oauth/jwks.json`

/**
 * クライアントのメタデータ（`client_id` の URL で公開する JSON）。
 *
 * Input: `origin`（配信元のオリジン）、`clientName`（認可の画面に出す名前）
 * Output: メタデータのオブジェクト
 */
export const clientMetadata = (origin: string, clientName: string) => ({
    client_id: clientIdFor(origin),
    client_name: clientName,
    client_uri: `${origin}/`,
    redirect_uris: [redirectUriFor(origin)],
    scope: CLIENT_SCOPE,
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

/** 公開鍵の一覧（JWKS）。秘密鍵の成分（`d`）は含めない */
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
 * トークンの要求に添えるクライアントの認証の項目を作る。
 *
 * 処理の趣旨:
 * - 開発用の公開クライアントは、秘密鍵を持たないため識別子だけを送る（`token_endpoint_auth_method: none`）。
 * - それ以外は、秘密鍵で署名した60秒有効のクライアントの証明（private_key_jwt）を添える。
 *
 * Input:
 * - `client`: クライアントの秘密鍵（未設定なら null）
 * - `clientId`: クライアントの識別子
 * - `issuer`: 認可サーバーの識別子（証明の宛先）
 * - `now`: 現在時刻（UNIX 秒）
 *
 * Output: トークンの要求の本文に足すフォームの項目。開発用でなく秘密鍵が無ければ null
 *
 * 例:
 * - 入力: `(null, "http://localhost?...", "https://bsky.social", now)` → 出力: `{ client_id: "http://localhost?..." }`
 * - 入力: `(null, "https://example.com/oauth/client-metadata.json", ...)` → 出力: `null`
 */
export const clientAuthParams = async (
    client: ClientKey | null,
    clientId: string,
    issuer: string,
    now: number,
): Promise<Record<string, string> | null> => {
    if (isLoopbackClientId(clientId)) return { client_id: clientId }
    if (!client) return null
    return {
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
    }
}
