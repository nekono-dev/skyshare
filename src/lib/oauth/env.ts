/**
 * OAuth のクライアントの秘密鍵のシークレットの取得。
 *
 * 責務と処理概要:
 * - Worker のシークレット `OAUTH_CLIENT_KEY`（`kid` を含む P-256 の秘密鍵の JWK の JSON）を返す。
 *
 * 実装上の制約:
 * - `cloudflare:workers` は Workers の実行環境だけにあるため、呼び出す時点で動的に読み込む
 *   （単体テストでは `vi.mock` で差し替える）。
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
