/// <reference types="astro/client" />

// `src/lib/bskySessionRefresh.ts` が `/v2/` 配下のリクエストに供給する、
// 認証済み bsky セッションの型。ミドルウェア対象外パス（`/v2/bsky/session` 系や
// 静的ページ等）では未設定のため、各ハンドラは undefined チェックを行う。
declare namespace App {
    interface Locals {
        agent?: import("@atproto/api").AtpAgent
        session?: import("@atproto/api").AtpSessionData
        service?: string
    }
}
