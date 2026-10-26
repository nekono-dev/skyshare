# Implementation Plan

- [x] 1. 設定の読み書き
- [x] 1.1 `timelineSettings.ts` に設定の読み書きを追加する。
  - _Requirements: 1.1_
- [x] 1.2 読み書きの単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/settings/timelineSettings.test.ts`
  - _Requirements: 1.1_

- [x] 2. 表示の出し分け
- [x] 2.1 `Timeline` で一覧・投稿フォーム・新規投稿ボタンを出し分け、未ログインの判定を加える。
  - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2_
- [x] 2.2 `Settings` と `ThreadComposer` で設定の行を置き、固定表示しないのスイッチを無効化する。
  - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2_
- [x] 2.3 一覧の取得の有無と新規投稿ボタン・固定表示しないのスイッチの状態を確認するE2Eテストを追加する。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/timelineHidden.spec.ts` 設定ページでタイムラインを表示しないをONにしてゲスト表示のトップページを開く → 一覧の取得が行われず、投稿フォームとゲスト表示の案内が表示され、新規投稿ボタンとハイドレーション警告が出ない
  - E2E: `tests/e2e/timelineHidden.spec.ts` 固定表示しないをONにした後でタイムラインを表示しないをONにし、再びOFFにする → 固定表示しないのスイッチがOFFかつ操作不能になり、OFFに戻すとONの表示に戻る
  - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2_
