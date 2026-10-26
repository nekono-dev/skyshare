# Implementation Plan

- [x] 1. ログインの開始と完了
- [x] 1.1 `oauthLogin.ts` と、開始と完了のスキーマとハンドラを実装する。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
- [x] 1.2 `npm run codegen` でクライアントを生成し直す。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
- [x] 1.3 受け入れ条件 1.1 から 2.7 と 2.8・2.9 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/session/oauthLogin.test.ts tests/pages/v2/bsky/sessionAuthorization.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [x] 2. 再開・nonce・取消
- [x] 2.1 `oauthSession.ts` と `oauthAgent.ts` を実装し、自動再開・切り替え・ログアウトから使う。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_
- [x] 2.2 受け入れ条件 3.1 から 4.2, 4.3 と 3.4 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/session/oauthSession.test.ts tests/lib/coldStart.test.ts`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_
