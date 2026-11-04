/**
 * Cookie の codec（UTF-8 対応の base64 の変換と、Cookie ヘッダの解析）。
 * 他の責務のファイルより上流にあり、外部の import を持たない。
 */

// Cloudflare Workers 環境では Node の `Buffer` が存在しないため
// Web 標準 API (TextEncoder/TextDecoder + atob/btoa) を使って
// UTF-8 対応の base64 encode/decode を行うユーティリティを提供する。
export function encodeBase64Utf8(str: string) {
    if (typeof Buffer !== "undefined")
        return Buffer.from(str).toString("base64")
    const bytes = new TextEncoder().encode(str)
    let binary = ""
    for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i])
    return (globalThis as any).btoa(binary)
}

export function decodeBase64Utf8(b64: string) {
    if (typeof Buffer !== "undefined")
        return Buffer.from(b64, "base64").toString("utf-8")
    const binary = (globalThis as any).atob(b64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
}

/**
 * Cookie ヘッダ文字列をパースしてキー→値のマップを返す。
 *
 * 入力:
 * - `header` - HTTP の `Cookie` ヘッダ値（例: "a=1; b=2"）。空文字列可。
 * 処理:
 * - セミコロンで分割し、各エントリを trim、`=` でキーと値に分ける。
 * - 値は `decodeURIComponent` でデコードする。
 * 戻り値:
 * - 各 cookie 名をキー、対応する値を値とするオブジェクト。ヘッダが空なら空オブジェクトを返す。
 */
/** Cookie の値を復号する。不正なエンコードは値をそのまま返す（後段の検査で扱う） */
const decodeCookieValue = (v: string): string => {
    try {
        return decodeURIComponent(v)
    } catch {
        return v
    }
}

export function parseCookies(header = ""): Record<string, string> {
    if (!header) return {}
    return header
        .split(";")
        .map(s => s.trim())
        .filter(Boolean)
        .reduce((acc: Record<string, string>, cur) => {
            const idx = cur.indexOf("=")
            if (idx === -1) return acc
            const k = cur.slice(0, idx)
            const v = cur.slice(idx + 1)
            // 不正なエンコードの値 1 つで、同じ Cookie ヘッダの他の値まで失わないよう、そのまま残す
            acc[k] = decodeCookieValue(v)
            return acc
        }, {})
}

/**
 * 指定した名前の cookie 値を `Cookie` ヘッダ文字列から取得する。
 *
 * 入力:
 * - `header` - HTTP の `Cookie` ヘッダ値。
 * - `name` - 取得したい cookie 名。
 * 処理:
 * - `parseCookies` を呼んでパース後、指定キーの値を返す。
 * 戻り値:
 * - 見つかれば値（デコード済）、見つからなければ `undefined`。
 */
export function getCookieFromHeader(
    header = "",
    name: string,
): string | undefined {
    return parseCookies(header)[name]
}

/**
 * Base64 エンコードされた JSON 文字列を復号してパースする（内部ユーティリティ）。
 *
 * 入力:
 * - `raw` - base64 でエンコードされた JSON 文字列。
 * 処理:
 * - base64 → UTF-8 にデコードし、`JSON.parse` する。
 * 例外:
 * - パースに失敗した場合は `Error('invalid session cookie')` を投げる。
 * 戻り値:
 * - JSON をパースしたオブジェクト（型は任意）。
 */
export function decodeBase64Json(raw: string) {
    try {
        const decoded = decodeBase64Utf8(raw)
        return JSON.parse(decoded)
    } catch (e) {
        throw new Error("invalid session cookie")
    }
}
