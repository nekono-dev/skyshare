# タブ切り替え タスク一覧

## Phase 1: タブの並びとキー操作

- 対応: D-1, D-2
- [x] T-1.1: `src/components/common/TabButtons/index.tsx` に `nextTabKey` を実装し、AC-3 と AC-4 の単体テストをタグ付きで追加する。
- [x] T-1.2: `TabButtons` の描画と CSS モジュールを実装し、キー操作でのフォーカスの移動をつなぐ。
- [x] T-1.3: 受け入れ条件 AC-1、AC-2、AC-5 から AC-7 の E2E をタグ付きで追加する。
- 検証: `npx vitest run tests/components/common/TabButtons.test.ts`
- E2E: `tests/e2e/tabButtons.spec.ts` 投稿フォームの下書き・予約を開いてタブを押しキーで移動する → 選択中のタブが太字と下線になり、対応する中身だけが表示される
