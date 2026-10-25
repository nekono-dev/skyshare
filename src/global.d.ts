/// <reference types="astro/client" />

// `src/lib/session/bskySessionRefresh.ts` が `/v2/` 配下のリクエストに供給する、
// 認証済み bsky セッションの型。ミドルウェア対象外パス（`/v2/bsky/session` 系や
// 静的ページ等）では未設定のため、各ハンドラは undefined チェックを行う。
// アプリパスワードと OAuth のどちらのセッションでも同じ形で供給する（ハンドラは種類を区別しない）。
declare namespace App {
    interface Locals {
        agent?: import("@atproto/api").Agent
        // アカウントの識別子とハンドル。DID ドキュメントはアプリパスワードのセッションでだけ付く
        session?: { did: string; handle: string; didDoc?: unknown }
        // 要求を送る先（アプリパスワードはログインしたサービス、OAuth は PDS）
        service?: string
        // `lib/i18n/middleware.ts` が全リクエストに供給する表示言語（SSGページは常に既定言語）。
        locale: import("@/lib/i18n/locale").Locale
        // @astrojs/cloudflare が供給する Workers の実行コンテキスト（開発サーバーでは未設定）。
        cfContext?: ExecutionContext
    }
}
