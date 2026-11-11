/**
 * 開発サーバーで OAuth のループバック callback を HTTPS の localhost に中継する Vite プラグイン。
 * - 開発用の公開クライアントの戻り先はループバック IP の http（`http://127.0.0.1:<port>/oauth/callback/`）に限られるため、同じパスとクエリのまま `https://localhost` へ 302 で転送する。認可の開始時の cookie は `localhost` にだけあるため、転送先を `localhost` にする。
 * - Node HTTP のため開発時だけ動かし、認可コードを含む URL はログに出さない。
 * - ポートが使用中なら警告して中継を無効にする。
 */
import http from "node:http"
import type { Plugin } from "vite"

import { LOOPBACK_CALLBACK_PORT } from "../../src/lib/oauth/loopback"

/** 中継する戻り先のパス */
const CALLBACK_PATH = "/oauth/callback/"

/**
 * 中継の要求1件の応答を決める。
 *
 * Input:
 * - `method`: 要求のメソッド
 * - `url`: 要求のパスとクエリ（例: `/oauth/callback/?code=c&state=s`）
 * - `devPort`: 開発サーバーのポート
 *
 * Output: 302 と転送先、または 404
 *
 * 例:
 * - 入力: `("GET", "/oauth/callback/?code=c", 4321)` → 出力: `{ status: 302, location: "https://localhost:4321/oauth/callback/?code=c" }`
 * - 入力: `("GET", "/", 4321)` → 出力: `{ status: 404 }`
 */
export const forwardLoopbackRequest = (
    method: string | undefined,
    url: string | undefined,
    devPort: number,
): { status: 302; location: string } | { status: 404 } => {
    if (method !== "GET" || !url) return { status: 404 }
    let target: URL
    try {
        target = new URL(url, "http://127.0.0.1")
    } catch {
        return { status: 404 }
    }
    if (!target.pathname.startsWith(CALLBACK_PATH)) return { status: 404 }
    return {
        status: 302,
        location: `https://localhost:${devPort}${target.pathname}${target.search}`,
    }
}

/**
 * 開発サーバーに中継を組み込むプラグイン。
 *
 * 処理の趣旨:
 * - 開発サーバーの起動時に `127.0.0.1:LOOPBACK_CALLBACK_PORT` で待ち受け、停止時に閉じる。
 * - ポートが使用中（別の開発サーバーが動いているなど）なら、警告を出して中継せずに続ける。
 *
 * Output: Vite のプラグイン
 *
 * 例: `vite: { plugins: [basicSsl(), oauthLoopbackForwarder()] }`
 */
export const oauthLoopbackForwarder = (): Plugin => ({
    name: "skyshare-oauth-loopback-forwarder",
    apply: "serve",
    configureServer(server) {
        const devPort = server.config.server.port ?? 4321
        const forwarder = http.createServer((req, res) => {
            const result = forwardLoopbackRequest(req.method, req.url, devPort)
            if (result.status === 302) {
                res.writeHead(302, {
                    location: result.location,
                    "cache-control": "no-store",
                    "referrer-policy": "no-referrer",
                })
            } else {
                res.writeHead(404)
            }
            res.end()
        })
        forwarder.on("error", err => {
            server.config.logger.warn(
                `[oauth] 戻り先の中継（127.0.0.1:${LOOPBACK_CALLBACK_PORT}）を開始できません: ${(err as NodeJS.ErrnoException).code ?? err.name}`,
            )
        })
        forwarder.listen(LOOPBACK_CALLBACK_PORT, "127.0.0.1")
        server.httpServer?.once("close", () => forwarder.close())
    },
})

export default oauthLoopbackForwarder
