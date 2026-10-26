# Implementation Plan

- [x] 1. 一覧のAPI
- [x] 1.1 `skyshare.ts` と一覧のスキーマを実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
- [x] 1.2 ハンドラの単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/pages/v2/entries/skyshare.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. カードと一覧ページ
- [x] 2.1 `EntryList`・`EntryCard`・`EntryEditForm` と一覧ページを実装する。
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_
- [x] 2.2 編集の入力欄の文字数の表示をバイト数にし、確認するE2Eテストを追加する。
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_
- [x] 2.3 参照先が削除済みのカードの作成日時の横に「元投稿削除済み」のバッジを出し、確認するE2Eテストを追加する。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/entryList.spec.ts` ゲスト表示の一覧ページを開き、APIの応答を差し替えて見出しを編集して保存する → カードの表示と無効な編集ボタンを確認でき、更新の内容に新しい見出しが含まれる。削除済みのカードにだけバッジが表示される
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_
