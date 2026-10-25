# 投稿フォームの入力欄への自動フォーカス タスク一覧

## Phase 1: 自動フォーカス

- 対応: D-1
- [x] T-1.1: `ThreadComposer` に `autoFocus` を加え、マウント時に先頭の本文の入力欄へフォーカスする。
- [x] T-1.2: `PostLauncher` から `autoFocus` を渡す。
- [x] T-1.3: 受け入れ条件 AC-1, AC-2 の E2E をタグ付きで追加する。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/composerAutofocus.spec.ts` 投稿ボタンを押してそのまま入力する → 本文の入力欄に文字が入る
