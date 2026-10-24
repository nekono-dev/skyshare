/**
 * OAuth で使う JWT（ES256）の署名と鍵の扱い。
 *
 * 責務と処理概要:
 * - P-256 の鍵（JWK）の生成・読み込みと、公開部分の取り出しを行う。
 * - ヘッダーとペイロードを Base64url にして ES256 で署名し、JWT を作る。
 *   WebCrypto の ECDSA の署名は r‖s の固定長の形式で、JWS の ES256 の形式とそのまま一致する。
 * - SHA-256 の Base64url（PKCE のチャレンジ・DPoP の ath）と、乱数の文字列を作る。
 *
 * 実装上の制約:
 * - Cron の実行から使うため、atproto やその他のライブラリを読み込まず WebCrypto だけを使う。
 */

/** P-256 の秘密鍵の JWK（公開部分の x・y を含む） */
export type EcPrivateJwk = {
    kty: "EC"
    crv: "P-256"
    x: string
    y: string
    d: string
    kid?: string
}

/** P-256 の公開鍵の JWK */
export type EcPublicJwk = { kty: "EC"; crv: "P-256"; x: string; y: string }

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const

/** バイト列を Base64url（パディングなし）にする */
export const base64url = (input: ArrayBuffer | Uint8Array): string => {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
    let s = ""
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const base64urlText = (text: string): string =>
    base64url(new TextEncoder().encode(text))

/** 文字列の SHA-256 を Base64url で返す（PKCE の S256・DPoP の ath） */
export const sha256Base64url = async (text: string): Promise<string> =>
    base64url(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    )

/** 乱数を Base64url の文字列で返す（state・PKCE の verifier・jti） */
export const randomString = (bytes = 32): string =>
    base64url(crypto.getRandomValues(new Uint8Array(bytes)))

/** 秘密鍵の JWK から、公開部分だけを取り出す */
export const toPublicJwk = (jwk: EcPrivateJwk): EcPublicJwk => ({
    kty: "EC",
    crv: "P-256",
    x: jwk.x,
    y: jwk.y,
})

/** 署名用に秘密鍵を読み込む。WebCrypto が受け付けない項目（kid など）は渡さない */
export const importSigningKey = (jwk: EcPrivateJwk): Promise<CryptoKey> =>
    crypto.subtle.importKey(
        "jwk",
        { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d },
        ALGORITHM,
        false,
        ["sign"],
    )

/** 新しい P-256 の鍵を生成し、秘密鍵の JWK で返す（DPoP の鍵に使う） */
export const generateEcJwk = async (): Promise<EcPrivateJwk> => {
    const pair = (await crypto.subtle.generateKey(ALGORITHM, true, [
        "sign",
        "verify",
    ])) as CryptoKeyPair
    const jwk = (await crypto.subtle.exportKey(
        "jwk",
        pair.privateKey,
    )) as JsonWebKey
    return {
        kty: "EC",
        crv: "P-256",
        x: jwk.x!,
        y: jwk.y!,
        d: jwk.d!,
    }
}

/** 値が P-256 の秘密鍵の JWK の形をしているか */
export const isEcPrivateJwk = (value: unknown): value is EcPrivateJwk => {
    if (!value || typeof value !== "object") return false
    const v = value as Record<string, unknown>
    return (
        v.kty === "EC" &&
        v.crv === "P-256" &&
        typeof v.x === "string" &&
        typeof v.y === "string" &&
        typeof v.d === "string"
    )
}

/**
 * ES256 の JWT を作る。
 *
 * Input:
 * - `header`: `alg` を除くヘッダー（`alg: "ES256"` は自動で付ける）
 * - `payload`: クレーム
 * - `key`: `importSigningKey` で読み込んだ秘密鍵
 *
 * Output: `header.payload.signature` の形の文字列
 */
export const signJwt = async (
    header: Record<string, unknown>,
    payload: Record<string, unknown>,
    key: CryptoKey,
): Promise<string> => {
    const input = `${base64urlText(JSON.stringify({ ...header, alg: "ES256" }))}.${base64urlText(JSON.stringify(payload))}`
    const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        new TextEncoder().encode(input),
    )
    return `${input}.${base64url(signature)}`
}
