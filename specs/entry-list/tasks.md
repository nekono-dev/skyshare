# 作成したentryの一覧と編集 タスク一覧

## Phase 1: 一覧のAPI

- 対応: D-1
- [x] T-1.1: `skyshare.ts` と一覧のスキーマを実装する。
- [x] T-1.2: ハンドラの単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/pages/v2/entries/skyshare.test.ts`

## Phase 2: カードと一覧ページ

- 対応: D-2, D-3
- [x] T-2.1: `EntryList`・`EntryCard`・`EntryEditForm` と一覧ページを実装する。
- [x] T-2.2: 編集の入力欄の文字数の表示をバイト数にし、確認するE2Eテストを追加する。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/entryList.spec.ts` ゲスト表示の一覧ページを開き、APIの応答を差し替えて見出しを編集して保存する → カードの表示と無効な編集ボタンを確認でき、更新の内容に新しい見出しが含まれる
