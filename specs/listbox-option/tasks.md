# 選択肢行 タスク一覧

## Phase 1: 選択肢行

- 対応: D-1
- [x] T-1.1: `ListboxOption` を実装し、`Dropdown` の行に使う。
- [ ] T-1.2: 無効な選択肢・選択状態の属性・選択中の表示を確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/dropdown.spec.ts` 表示テーマのプルダウンを開く → 選択中の項目が太字で、選択状態の属性を持つ

## Phase 2: 候補一覧での利用

- 対応: D-2
- [x] T-2.1: `SuggestPopover` の行を `ListboxOption` に置き換える。
- 検証: `npm run build`
- E2E: `tests/e2e/suggestPopover.spec.ts` 本文に「#」を入力して候補を上下キーで移動しクリックする → ハイライトが移動し、確定後も入力欄にフォーカスが残る
