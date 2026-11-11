/**
 * 開発用 OAuth 公開クライアントの判定とループバック戻り先を扱う。手元の開発サーバー（`https://localhost:4321` など）は認可サーバーからクライアントのメタデータを取得できないため、atproto の開発用の公開クライアント（識別子が `http://localhost?...`）として振る舞う。
 * - 認可サーバーが受け付ける戻り先は HTTP のループバック IP であり、HTTPS や `localhost` 名ではない。
 * - HTTPS 開発サーバーへの転送は `scripts/dev/oauth-loopback-forwarder.ts` が中継する。
 * - Node の開発サーバー設定とブラウザから使うため、他モジュールに依存しない。
 */

/** ループバックの戻り先を中継するポート */
export const LOOPBACK_CALLBACK_PORT = 4322

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])

/**
 * 配信元がループバックのホストか判定する。
 *
 * Input: `origin`（例: `https://localhost:4321`）
 * Output: ホスト名が localhost・127.0.0.1・[::1] なら true。解釈できないオリジンは false
 *
 * 例:
 * - 入力: `"https://localhost:4321"` → 出力: `true`
 * - 入力: `"https://skyshare.example.com"` → 出力: `false`
 */
export const isLoopbackOrigin = (origin: string): boolean => {
    try {
        return LOOPBACK_HOSTNAMES.has(new URL(origin).hostname)
    } catch {
        return false
    }
}

/**
 * クライアントの識別子が開発用の公開クライアントのものか判定する。
 * 保管した識別子で更新するとき（Cron など、配信元のオリジンが無いとき）にも使う。
 *
 * 例: `isLoopbackClientId("http://localhost?scope=atproto")` → `true`
 */
export const isLoopbackClientId = (clientId: string): boolean =>
    clientId === "http://localhost" ||
    clientId.startsWith("http://localhost?") ||
    clientId.startsWith("http://localhost/")

/**
 * 開発用の公開クライアントの戻り先。
 *
 * 例: `loopbackRedirectUri()` → `"http://127.0.0.1:4322/oauth/callback/"`
 */
export const loopbackRedirectUri = (): string =>
    `http://127.0.0.1:${LOOPBACK_CALLBACK_PORT}/oauth/callback/`
