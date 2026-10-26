# Implementation Plan

- [x] 1. タブの並びとキー操作
- [x] 1.1 `src/components/common/TabButtons/index.tsx` に `nextTabKey` を実装し、2.1 と 2.2 の単体テストをタグ付きで追加する。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1_
- [x] 1.2 `TabButtons` の描画と CSS モジュールを実装し、キー操作でのフォーカスの移動をつなぐ。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1_
- [x] 1.3 受け入れ条件 1.1、1.2、3.1 から 1.3 の E2E をタグ付きで追加する。
  - 検証: `npx vitest run tests/components/common/TabButtons.test.ts`
  - E2E: `tests/e2e/tabButtons.spec.ts` 投稿フォームの下書き・予約を開いてタブを押しキーで移動する → 選択中のタブが太字と下線になり、対応する中身だけが表示される
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1_
