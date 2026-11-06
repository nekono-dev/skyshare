/**
 * Bluesky の接続先（サーバーとブラウザの両方で使う）。
 *
 * 責務と処理概要:
 * - 値は `wrangler.jsonc` の vars から入る（開発・ビルド・実行時で同じ）。wrangler.jsonc は config/ から生成する。
 * - 未指定の項目は本番と同じ既定値になる（解決の規則は `resolveBlueskyEndpoints`）。
 * - 秘密情報は含まない（公開の接続先だけ）。
 */
import { resolveBlueskyEndpoints } from "./blueskyEndpoints"

export const publicEndpoints = resolveBlueskyEndpoints({
    PUBLIC_DEFAULT_ATP_SERVICE: import.meta.env.PUBLIC_DEFAULT_ATP_SERVICE,
    PUBLIC_PLC_DIRECTORY_BASE_URL: import.meta.env
        .PUBLIC_PLC_DIRECTORY_BASE_URL,
    PUBLIC_BSKY_AUTH_SERVER_URL: import.meta.env.PUBLIC_BSKY_AUTH_SERVER_URL,
})
