/**
 * OAuth の戻り値を、認可を開始したページへ渡すフラグメント形式。
 * - `oauthReturn` で用途を識別し、code・state・iss を渡す。
 * - ブラウザとサーバーの両方から使うため、他モジュールに依存しない。
 */

/** 戻りの項目であることと、その用途を示すフラグメントの目印の名前 */
const AUTHORIZATION_FRAGMENT_KEY = "oauthReturn"

/** フラグメントで渡す戻りの項目 */
const FORWARDED_KEYS = ["code", "state", "iss", "error"] as const

export type AuthorizationReturn = Partial<
    Record<(typeof FORWARDED_KEYS)[number], string>
>

/**
 * 戻りのクエリから、許可を始めたページへ渡すフラグメント（`#` を除く）を作る。
 *
 * Input: `query`（戻りのクエリ）、`purpose`（戻りの用途）
 * Output: フラグメントの文字列。未知の項目は渡さない
 *
 * 例:
 * - 入力: `(new URLSearchParams("code=c&state=s&x=1"), "session")`
 * - 出力: `"oauthReturn=session&code=c&state=s"`
 */
export const toAuthorizationFragment = (
    query: URLSearchParams,
    purpose: string,
): string => {
    const fragment = new URLSearchParams({
        [AUTHORIZATION_FRAGMENT_KEY]: purpose,
    })
    for (const key of FORWARDED_KEYS) {
        const value = query.get(key)
        if (value) fragment.set(key, value)
    }
    return fragment.toString()
}

/**
 * 住所のフラグメント（`#` を含んでよい）から、指定した用途の戻りの項目を読む。
 *
 * Input: `hash`（`location.hash`）、`purpose`（読むページの用途）
 * Output: 戻りの項目。目印が無い・用途が違うときは null
 *
 * 例:
 * - 入力: `("#oauthReturn=session&code=c", "session")` → 出力: `{ code: "c" }`
 * - 入力: `("#oauthReturn=session&code=c", "schedule")` → 出力: `null`
 */
export const readAuthorizationFragment = (
    hash: string,
    purpose: string,
): AuthorizationReturn | null => {
    const params = new URLSearchParams(hash.replace(/^#/, ""))
    if (params.get(AUTHORIZATION_FRAGMENT_KEY) !== purpose) return null
    const result: AuthorizationReturn = {}
    for (const key of FORWARDED_KEYS) {
        const value = params.get(key)
        if (value) result[key] = value
    }
    return result
}
