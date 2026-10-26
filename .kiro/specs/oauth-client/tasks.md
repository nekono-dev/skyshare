# Implementation Plan

- [x] 1. 共通のモジュールへの移設とクライアントの識別
- [x] 1.1 予約投稿の OAuth の補助のモジュールを `src/lib/oauth/` へ移し、シークレットの名前を `OAUTH_CLIENT_KEY` にする。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3_
- [x] 1.2 `loopback.ts` と `clientAuthParams` と、ログインの権限を含めたメタデータを実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3_
- [x] 1.3 `readAuthorizationServer` を分け、受け入れ条件 1.1 から 2.3 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/oauth/client.test.ts tests/lib/oauth/discovery.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3_

- [x] 2. トークンと PDS への要求
- [x] 2.1 `token.ts` と `resourceFetch.ts` を実装し、予約の認可の処理をこれらに置き換える。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3_
- [x] 2.2 受け入れ条件 3.2 から 4.1, 4.2 と 4.3・3.6 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/oauth/token.test.ts tests/lib/oauth/resourceFetch.test.ts tests/lib/schedule/oauthFlow.test.ts`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3_

- [x] 3. 戻りの受け渡しと開発サーバーの中継
- [x] 3.1 戻り先の cookie に用途を持たせ、フラグメントの目印を用途つきにする。
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1_
- [x] 3.2 `oauthLoopbackForwarder.ts` を実装して `astro.config.mjs` に組み込む。
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1_
- [x] 3.3 受け入れ条件 5.1 から 6.1 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/oauth/returnPath.test.ts tests/hack/oauthLoopbackForwarder.test.ts tests/pages/v2/scheduleAuthorization.test.ts`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1_
