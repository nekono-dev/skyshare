/**
 * 認可の戻りの項目を、戻り先（`/oauth/callback/`）から設定のページへ渡すフラグメントの形式。
 *
 * 責務と処理概要:
 * - 戻り先は項目を `/settings/#scheduleAuthorization=1&code=…&state=…&iss=…` の形で渡す。
 * - 設定のページはこの形を読み取り、認可の完了の API へ送る。
 *
 * 実装上の制約:
 * - ブラウザとサーバーの両方から読み込むため、他のモジュールに依存しない。
 */

/** 戻りの項目であることを示す、フラグメントの目印の名前 */
export const AUTHORIZATION_FRAGMENT_KEY = "scheduleAuthorization"

/** フラグメントで渡す戻りの項目 */
export const FORWARDED_KEYS = ["code", "state", "iss", "error"] as const

export type AuthorizationReturn = Partial<
    Record<(typeof FORWARDED_KEYS)[number], string>
>

/**
 * 戻りのクエリから、設定のページへ渡すフラグメント（`#` を除く）を作る。
 *
 * Example: `toAuthorizationFragment(new URLSearchParams("code=c&state=s&x=1"))`
 *   → `"scheduleAuthorization=1&code=c&state=s"`（未知の項目は渡さない）
 */
export const toAuthorizationFragment = (query: URLSearchParams): string => {
    const fragment = new URLSearchParams({ [AUTHORIZATION_FRAGMENT_KEY]: "1" })
    for (const key of FORWARDED_KEYS) {
        const value = query.get(key)
        if (value) fragment.set(key, value)
    }
    return fragment.toString()
}

/**
 * 住所のフラグメント（`#` を含んでよい）から戻りの項目を読む。
 *
 * Output: 戻りの項目。目印が無ければ null
 */
export const readAuthorizationFragment = (
    hash: string,
): AuthorizationReturn | null => {
    const params = new URLSearchParams(hash.replace(/^#/, ""))
    if (!params.has(AUTHORIZATION_FRAGMENT_KEY)) return null
    const result: AuthorizationReturn = {}
    for (const key of FORWARDED_KEYS) {
        const value = params.get(key)
        if (value) result[key] = value
    }
    return result
}
