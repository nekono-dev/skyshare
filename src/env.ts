// 非秘密の設定は wrangler.jsonc の vars（config/ から生成）に一本化している。ここはその参照の入口。
import { publicEndpoints } from "@/lib/platform/publicEndpoints"

export const atpService = publicEndpoints.appView
export const plcDirectoryBaseUrl = publicEndpoints.plcDirectory
// ログインフォームが送る認可サーバー
export const publicAuthServer = publicEndpoints.authServer
// legacy backend(pageDB)への接続先。/posts配下の旧投稿表示ページから参照する。
export const v1Endpoint = import.meta.env.PUBLIC_LEGACY_BACKEND_ENDPOINT ?? ""
