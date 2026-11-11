/**
 * OAuth クライアントの秘密鍵シークレットを Worker 環境から取得する。
 * - `cloudflare:workers` は実行時に動的 import するため、単体テストでは `vi.mock` で差し替えられる。
 */

/**
 * クライアントの秘密鍵のシークレットを取得する。
 *
 * Output: シークレットの文字列。未設定なら undefined
 *
 * 例: `await loadClientKey(await getOAuthClientSecret())`
 */
export const getOAuthClientSecret = async (): Promise<string | undefined> => {
    const { env } = await import("cloudflare:workers")
    const value = (env as unknown as { OAUTH_CLIENT_KEY?: unknown })
        .OAUTH_CLIENT_KEY
    return typeof value === "string" && value.length > 0 ? value : undefined
}
