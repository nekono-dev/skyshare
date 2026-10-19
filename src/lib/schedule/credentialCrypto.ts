/**
 * 予約用の認証情報（トークン）の暗号化と復号。
 *
 * 責務と処理概要:
 * - AES-GCM 256ビットで暗号化する。鍵は Worker のシークレット（Base64 の32バイト）。
 * - 暗号化のたびに12バイトの乱数の IV を生成するため、同じ平文でも暗号文は毎回異なる。
 * - アカウントの DID を追加認証データ（AAD）に束縛し、別のアカウントの行へ差し替えた
 *   暗号文を復号できないようにする。
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
        throw new Error("暗号鍵が Base64 ではありません")
    }
    if (raw.length !== KEY_BYTES) {
        throw new Error("暗号鍵の長さが32バイトではありません")
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
