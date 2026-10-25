# OAuth のログインとセッション タスク一覧

## Phase 1: ログインの開始と完了

- 対応: D-1, D-2
- [x] T-1.1: `oauthLogin.ts` と、開始と完了のスキーマとハンドラを実装する。
- [x] T-1.2: `npm run codegen` でクライアントを生成し直す。
- [x] T-1.3: 受け入れ条件 AC-1 から AC-8 と AC-14・AC-15 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/session/oauthLogin.test.ts tests/pages/v2/bsky/sessionAuthorization.test.ts`

## Phase 2: 再開・nonce・取消

- 対応: D-3, D-4, D-5
- [x] T-2.1: `oauthSession.ts` と `oauthAgent.ts` を実装し、自動再開・切り替え・ログアウトから使う。
- [x] T-2.2: 受け入れ条件 AC-9 から AC-13 と AC-16 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/session/oauthSession.test.ts tests/lib/coldStart.test.ts`
