# Implementation Plan

- [x] 1. ステータスと文言キー
- [x] 1.1 `errorMessage.ts` に `errorMessageKeyFromStatus` を実装する。
  - _Requirements: 1.1, 2.1, 2.2, 2.3_
- [x] 1.2 変換の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/i18n/errorMessage.test.ts`
  - _Requirements: 1.1, 2.1, 2.2, 2.3_

- [x] 2. ログイン
- [x] 2.1 ログインAPIの上限到達を409で返し、スキーマとクライアントを再生成する。
  - _Requirements: 2.4, 3.1_
- [x] 2.2 `LoginForm` でステータスと通信失敗に応じた文言を表示する。
  - _Requirements: 2.4, 3.1_
- [x] 2.3 通信失敗時の文言を確認するE2Eテストを追加する。
  - 検証: `npm run codegen`
  - E2E: `tests/e2e/i18n.spec.ts` ログインAPIが409と500を返すようにしてログインする → 上限到達と汎用のログイン失敗の文言がそれぞれ表示される
  - E2E: `tests/e2e/apiErrorMessage.spec.ts` ログインAPIの通信を失敗させてログインする → 接続できない旨の文言が表示される
  - _Requirements: 2.4, 3.1_

- [x] 3. 処理固有の文言
- [x] 3.1 一覧・取得・投稿の失敗を処理固有の文言キーで表示する。
  - _Requirements: 4.1, 4.2, 4.3_
- [x] 3.2 タイムラインの取得失敗の文言を確認するE2Eテストを追加する。
  - 検証: `npx vitest run tests/components/post/ThreadComposer/submitThread.test.ts`
  - E2E: `tests/e2e/apiErrorMessage.spec.ts` タイムラインの取得APIが500を返すようにして開く → 読み込み失敗の文言が表示される
  - _Requirements: 4.1, 4.2, 4.3_
