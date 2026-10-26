# Implementation Plan

- [x] 1. 自動フォーカス
- [x] 1.1 `ThreadComposer` に `autoFocus` を加え、マウント時に先頭の本文の入力欄へフォーカスする。
  - _Requirements: 1.1, 1.2, 2.1_
- [x] 1.2 `PostLauncher` から `autoFocus` を渡す。
  - _Requirements: 1.1, 1.2, 2.1_
- [x] 1.3 受け入れ条件 1.1 から 2.1 の E2E をタグ付きで追加する。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/composerAutofocus.spec.ts` 投稿ボタンを押してそのまま入力する → 本文の入力欄に文字が入る
  - _Requirements: 1.1, 1.2, 2.1_
