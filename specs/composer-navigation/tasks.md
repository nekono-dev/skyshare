# 投稿フォームの遷移の確認 タスク一覧

## Phase 1: 遷移の確認と設定への案内

- 対応: D-1, D-2
- [x] T-1.1: 投稿フォームに `astro:before-preparation` の購読と、保存の後の遷移を実装する。
- [x] T-1.2: `RunAtPicker` に押せる無効表示（`onUnavailable`）を加え、設定への案内のダイアログを出す。
- [x] T-1.3: 日本語と英語の文言を加える。
- [x] T-1.4: 受け入れ条件 AC-1 から AC-6 の E2E をタグ付きで追加する。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/composerNavigation.spec.ts` 本文を入力してフッターの設定を押す → 3択の確認が出て、保存を選ぶと設定のページへ移る
