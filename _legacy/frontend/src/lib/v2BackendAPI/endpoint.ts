// v2バックエンド(skyshare v2, /v2/*)の接続先。
// 本番運用ではv2(ルート)とlegacy(/legacy配下)が同一オリジンで配信される前提のため、
// 既定値は空文字列(ルート相対パス)とする。ローカル開発でv2の開発サーバーを別ポートで
// 起動する場合のみ PUBLIC_V2_BACKEND_ENDPOINT で上書きする(その場合CORS未対応のため
// ブラウザから直接は疎通できない点に注意。DEVELOP.md参照)。
export const v2BackendEndpoint =
    (import.meta.env.PUBLIC_V2_BACKEND_ENDPOINT as string | undefined) ?? ""
