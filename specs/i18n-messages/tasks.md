# 文言の辞書と翻訳 タスク一覧

## Phase 1: 辞書と翻訳関数

- 対応: D-1
- [x] T-1.1: 日本語・英語の辞書と `translate.ts`・`rich.tsx` を実装する。
- [x] T-1.2: 辞書の整合性・翻訳関数の単体テストと型検査用サンプルを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/i18n/translate.test.ts tests/lib/i18n/messages.test.ts`
- E2E: `tests/e2e/i18n.spec.ts` 英語で投稿フォームを開く → 日本語の文言が残っていない

## Phase 2: 日時と数値

- 対応: D-2
- [x] T-2.1: `format.ts` を実装し、`toLocaleString` の呼び出しを置き換える。
- 検証: `npx vitest run tests/lib/i18n/format.test.ts`

## Phase 3: 文言の移行

- 対応: D-3
- [x] T-3.1: 全画面の文言を辞書へ移し、stateには文言キーか遅延評価の文言を保持する。
- [x] T-3.2: ヘルプ記事とゲスト用ダミーデータを翻訳関数で組み立てる。
- [ ] T-3.3: 表示後の言語切り替えでエラー文言が追従することを確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/i18n.spec.ts` 英語でヘルプとゲストモードのタイムラインを開く → 記事とダミー投稿が英語で、件数の単複が正しく表示される

## Phase 4: 直書きの検出

- 対応: D-4
- [x] T-4.1: 直書き検出テストを実装する。
- [ ] T-4.2: 言語の自称表記が翻訳されないことを確認するE2Eテストを追加する。
- 検証: `npx vitest run tests/lib/i18n/noHardcodedText.test.ts`
- E2E: `tests/e2e/i18n.spec.ts` 英語表示で設定画面の表示言語の選択欄を開く → 日本語という選択肢が表示される
