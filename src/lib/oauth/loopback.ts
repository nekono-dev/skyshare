/**
 * 開発用の公開クライアント（ループバックのクライアント）の判定と戻り先の住所。
 *
 * 責務と処理概要:
 * - 手元の開発サーバー（`https://localhost:4321` など）は、認可サーバーからクライアントのメタデータを
 *   取得できないため、atproto の開発用の公開クライアント（識別子が `http://localhost?...`）として振る舞う。
 * - 開発用の公開クライアントの戻り先は、ループバックの IP の http の住所に限られる（https とホスト名
 *   `localhost` は認可サーバーが拒否する）。開発サーバーは https で待ち受けるため、この住所への遷移は
 *   開発サーバーの中継（`hack/oauthLoopbackForwarder.ts`）が開発サーバーへ転送する。
 *
 * 実装上の制約:
 * - 開発サーバーの設定（Node）とブラウザからも読み込むため、他のモジュールに依存しない。
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
