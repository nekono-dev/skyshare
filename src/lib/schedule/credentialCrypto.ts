/**
 * 予約用認証情報を暗号化して D1 に安全に保管できる形へ変換する。
 *
 * - AES-GCM-256 は Worker secret の Base64 32-byte key と、毎回生成する 12-byte IV を使う。
 * - DID を AAD に含めるため、別アカウントの行へ移した暗号文は復号できない。
 * - 保管形式は Base64(IV ‖ 暗号文)。
 */

const IV_BYTES = 12
const KEY_BYTES = 32

const toBase64 = (bytes: Uint8Array): string => {
    let s = ""
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
}

const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => {
    const s = atob(text)
    const bytes = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
    return bytes
}

const importKey = async (secret: string): Promise<CryptoKey> => {
    let raw: Uint8Array<ArrayBuffer>
    try {
        raw = fromBase64(secret)
    } catch {
        throw new Error("encryption key is not valid Base64")
    }
    if (raw.length !== KEY_BYTES) {
        throw new Error("encryption key must be 32 bytes")
    }
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
        "encrypt",
        "decrypt",
    ])
}

export const encryptToken = async (
    secret: string,
    did: string,
    token: string,
): Promise<string> => {
    const key = await importKey(secret)
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const cipher = new Uint8Array(
        await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv,
                additionalData: new TextEncoder().encode(did),
            },
            key,
            new TextEncoder().encode(token),
        ),
    )
    const out = new Uint8Array(IV_BYTES + cipher.length)
    out.set(iv, 0)
    out.set(cipher, IV_BYTES)
    return toBase64(out)
}

export const decryptToken = async (
    secret: string,
    did: string,
    encrypted: string,
): Promise<string> => {
    const key = await importKey(secret)
    const bytes = fromBase64(encrypted)
    const iv = bytes.slice(0, IV_BYTES)
    const cipher = bytes.slice(IV_BYTES)
    const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(did) },
        key,
        cipher,
    )
    return new TextDecoder().decode(plain)
}
