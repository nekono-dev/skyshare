/**
 * 送信者に結び付けた OAuth トークンの DPoP 証明を作成する。
 * - nonce は発行元オリジンごとに保持し、PDS 要求にはアクセストークンの SHA-256（ath）を含める。
 * - Cron とリクエストミドルウェアから使うため WebCrypto のみを使う。
 */
import {
    type EcPrivateJwk,
    type EcPublicJwk,
    importSigningKey,
    randomString,
    sha256Base64url,
    signJwt,
    toPublicJwk,
} from "./jose"

/** 1つの DPoP の鍵での証明の作成に必要な状態。nonce は発行元のオリジンごとに更新する */
export type DpopSession = {
    key: CryptoKey
    publicJwk: EcPublicJwk
    nonces: Map<string, string>
}

/** 秘密鍵の JWK から、証明の作成に使う状態を作る */
export const createDpopSession = async (
    jwk: EcPrivateJwk,
): Promise<DpopSession> => ({
    key: await importSigningKey(jwk),
    publicJwk: toPublicJwk(jwk),
    nonces: new Map(),
})

/**
 * 要求1回ぶんの DPoP の証明を作る。
 *
 * Input:
 * - `session`: 鍵と nonce
 * - `method`: HTTP メソッド
 * - `url`: 要求先（クエリとフラグメントは証明に含めない）
 * - `accessToken`: PDS へ送るアクセストークン（認可サーバーへの要求では省く）
 * - `now`: 現在時刻（UNIX 秒）
 *
 * Output: `DPoP` ヘッダーに入れる JWT
 */
export const createDpopProof = async (
    session: DpopSession,
    method: string,
    url: string,
    now: number,
    accessToken?: string,
): Promise<string> => {
    const target = new URL(url)
    const htu = `${target.origin}${target.pathname}`
    const nonce = session.nonces.get(target.origin)
    return signJwt(
        { typ: "dpop+jwt", jwk: session.publicJwk },
        {
            jti: randomString(16),
            htm: method,
            htu,
            iat: now,
            ...(nonce ? { nonce } : {}),
            ...(accessToken ? { ath: await sha256Base64url(accessToken) } : {}),
        },
        session.key,
    )
}

/** 応答の `DPoP-Nonce` を覚える。次の同じ発行元への証明に入る */
export const rememberDpopNonce = (
    session: DpopSession,
    url: string,
    res: Response,
): void => {
    const nonce = res.headers.get("dpop-nonce")
    if (nonce) session.nonces.set(new URL(url).origin, nonce)
}

/**
 * 応答が「nonce を付けてやり直せ」という指示か。
 * 認可サーバーは 400 の `use_dpop_nonce`、PDS は 401 の `WWW-Authenticate` で示す。
 */
export const isDpopNonceError = async (res: Response): Promise<boolean> => {
    if (res.status === 401) {
        const header = res.headers.get("www-authenticate") ?? ""
        if (header.includes("use_dpop_nonce")) return true
    }
    if (res.status === 400 || res.status === 401) {
        try {
            const body = (await res.clone().json()) as { error?: string }
            return body.error === "use_dpop_nonce"
        } catch {
            return false
        }
    }
    return false
}
