# APIエラーの文言 タスク一覧

## Phase 1: ステータスと文言キー

- 対応: D-1
- [x] T-1.1: `errorMessage.ts` に `errorMessageKeyFromStatus` を実装する。
- [x] T-1.2: 変換の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/i18n/errorMessage.test.ts`

## Phase 2: ログイン

- 対応: D-2
- [x] T-2.1: ログインAPIの上限到達を409で返し、スキーマとクライアントを再生成する。
- [x] T-2.2: `LoginForm` でステータスと通信失敗に応じた文言を表示する。
- [ ] T-2.3: 通信失敗時の文言を確認するE2Eテストを追加する。
- 検証: `npm run codegen`
- E2E: `tests/e2e/i18n.spec.ts` ログインAPIが409と500を返すようにしてログインする → 上限到達と汎用のログイン失敗の文言がそれぞれ表示される

## Phase 3: 処理固有の文言

- 対応: D-3
- [x] T-3.1: 一覧・取得・投稿の失敗を処理固有の文言キーで表示する。
- [ ] T-3.2: タイムラインの取得失敗の文言を確認するE2Eテストを追加する。
- 検証: `npx vitest run tests/components/post/ThreadComposer/submitThread.test.ts`
- E2E: `tests/e2e/i18n.spec.ts` タイムラインの取得APIが500を返すようにして開く → 読み込み失敗の文言が表示される
