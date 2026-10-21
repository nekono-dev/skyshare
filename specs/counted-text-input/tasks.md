# 文字数カウンタ付きの入力欄 タスク一覧

## Phase 1: 文字数の数え方

- 対応: D-1
- [x] T-1.1: `textCount.ts` に3種類の数え方を実装する。
- [x] T-1.2: 数え方の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/util/textCount.test.ts`

## Phase 2: 自動伸長の高さ

- 対応: D-2
- [x] T-2.1: `autoGrowHeight.ts` を実装する。
- [x] T-2.2: 高さの算出の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/components/common/CountedTextInput/autoGrowHeight.test.ts`

## Phase 3: 入力欄とカウンタ

- 対応: D-3
- [x] T-3.1: `CountedTextInput/index.tsx` を実装する。
- [x] T-3.2: 描画の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/components/common/CountedTextInput/index.test.ts`
- E2E: `tests/e2e/countedTextInput.spec.ts` ゲスト表示の設定ページを開いて1行の入力欄へ文字を入力する → 入力した値が欄に反映される
