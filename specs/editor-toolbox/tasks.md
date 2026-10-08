# エディタのツールボックス タスク一覧

## Phase 1: 型と状態遷移

- 対応: D-1, D-2
- [ ] T-1.1: ツールの型と `toolboxReducer.ts` を実装する。
- [ ] T-1.2: 状態遷移の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/components/common/EditorToolbox/toolboxReducer.test.ts`

## Phase 2: 表示と操作

- 対応: D-3, D-4
- [ ] T-2.1: `EditorToolbox` のボタン列・パネル・外側クリック・キーボード操作を実装する。
- [ ] T-2.2: 確認用のページを使ったE2Eテストを受け入れ条件のタグ付きで追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/editorToolbox.spec.ts` パネル型ツールのボタンを押してから別のボタンを押し、Escキーを押す → パネルが切り替わって閉じ、開いたボタンにフォーカスが戻る
