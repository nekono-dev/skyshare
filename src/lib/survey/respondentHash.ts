/**
 * RespondentHash: 回答者の一方向の値。
 *
 * 責務と処理概要:
 * - HMAC-SHA256(鍵, surveyId + did) を 16 進 64 文字で返す。
 * - 鍵は Base64 の 32 バイト。不正なら値を含まない固定の例外を投げる。
 * - 鍵・did・値をログや例外に含めない。Web Crypto だけに依存する（@atproto/* は import しない）。
 * - 入力は surveyId（[a-z0-9-] のみ）と did（"did:" 始まり）を区切りなしで連結する。
 *   surveyId は ":" を含まないため連結の境界は曖昧にならない。連結方法を変えると既存の記録と一致しなくなる。
 */

const KEY_BYTES = 32
const INVALID_KEY_MESSAGE = "invalid respondent hash key"

/**
 * Base64 の鍵を 32 バイトに復号する。不正なら固定の例外を投げる。
 * Input: key（Base64 文字列）
 * Output: 32 バイトの配列
 * 例: decodeKey("AAEC...") -> Uint8Array(32)
 */
const decodeKey = (key: string): Uint8Array<ArrayBuffer> => {
    let raw: string
    try {
        raw = atob(key)
    } catch {
        throw new Error(INVALID_KEY_MESSAGE)
    }
    if (raw.length !== KEY_BYTES) throw new Error(INVALID_KEY_MESSAGE)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    return bytes
}

/**
 * アンケートごとに異なる回答者の一方向の値を求める。
 * Input: key（Base64 の 32 バイト）, surveyId, did
 * Output: 64 文字の 16 進
 * 例: respondentHash(key, "survey-2026-11", "did:plc:xxx") -> "f15d5e..."
 */
export const respondentHash = async (
    key: string,
    surveyId: string,
    did: string,
): Promise<string> => {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        decodeKey(key),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    )
    const sig = new Uint8Array(
        await crypto.subtle.sign(
            "HMAC",
            cryptoKey,
            new TextEncoder().encode(surveyId + did),
        ),
    )
    let hex = ""
    for (const b of sig) hex += b.toString(16).padStart(2, "0")
    return hex
}
