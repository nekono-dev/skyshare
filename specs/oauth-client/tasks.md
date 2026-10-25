# Bluesky OAuth クライアント タスク一覧

## Phase 1: 共通のモジュールへの移設とクライアントの識別

- 対応: D-1, D-2
- [x] T-1.1: 予約投稿の OAuth の補助のモジュールを `src/lib/oauth/` へ移し、シークレットの名前を `OAUTH_CLIENT_KEY` にする。
- [x] T-1.2: `loopback.ts` と `clientAuthParams` と、ログインの権限を含めたメタデータを実装する。
- [x] T-1.3: `readAuthorizationServer` を分け、受け入れ条件 AC-1 から AC-7 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/oauth/client.test.ts tests/lib/oauth/discovery.test.ts`

## Phase 2: トークンと PDS への要求

- 対応: D-3, D-4
- [x] T-2.1: `token.ts` と `resourceFetch.ts` を実装し、予約の認可の処理をこれらに置き換える。
- [x] T-2.2: 受け入れ条件 AC-8 から AC-11 と AC-15・AC-16 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/oauth/token.test.ts tests/lib/oauth/resourceFetch.test.ts tests/lib/schedule/oauthFlow.test.ts`

## Phase 3: 戻りの受け渡しと開発サーバーの中継

- 対応: D-5, D-6
- [x] T-3.1: 戻り先の cookie に用途を持たせ、フラグメントの目印を用途つきにする。
- [x] T-3.2: `oauthLoopbackForwarder.ts` を実装して `astro.config.mjs` に組み込む。
- [x] T-3.3: 受け入れ条件 AC-12 から AC-14 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/oauth/returnPath.test.ts tests/hack/oauthLoopbackForwarder.test.ts tests/pages/v2/scheduleAuthorization.test.ts`
