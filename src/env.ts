/**
 * 公開設定値をアプリケーションへ提供する。
 *
 * - 公開設定は `wrangler.jsonc` の `vars` から生成する。
 */
import { publicEndpoints } from "@/lib/platform/publicEndpoints"

export const atpService = publicEndpoints.appView
export const plcDirectoryBaseUrl = publicEndpoints.plcDirectory
// ログインフォームが認可コードを要求するサーバー
export const publicAuthServer = publicEndpoints.authServer
// `/posts` 配下の旧投稿表示ページが参照する legacy backend (pageDB) の接続先。
export const v1Endpoint = import.meta.env.PUBLIC_LEGACY_BACKEND_ENDPOINT ?? ""
