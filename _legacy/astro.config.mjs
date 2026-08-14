import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import tailwind from "@astrojs/tailwind"
import cloudflare from "@astrojs/cloudflare"
import partytown from "@astrojs/partytown"

// https://astro.build/config
/** @type {import('tailwindcss').Config} */
export default defineConfig({
    base: "/legacy/",
    site: "https://skyshare.nekono.dev/",
    server: {
        // legacyページはこのポートに直接アクセスする(v2側からはプロキシしない)。
        // v2のモジュールURL("/src/..."等)と名前空間が衝突するため、v2経由での
        // プロキシ共有は行わず、v2バックエンドAPI(/v1/*)だけをこちらから転送する。
        port: 4322,
        host: true,
    },
    vite: {
        server: {
            proxy: {
                // ブラウザからは同一オリジン(4322)への相対パスとして疎通させ、
                // v2バックエンドAPI(/v1/entry, /v1/session)だけをサーバー間で
                // v2 dev サーバー(4321)へ転送する。APIエンドポイントはJSモジュール
                // ではないため、v2/legacy間のパス衝突は発生しない。
                "/v1": {
                    target: "http://localhost:4321",
                    changeOrigin: true,
                },
            },
        },
    },
    integrations: [react(), tailwind(), partytown()],
    adapter: cloudflare(),
})
