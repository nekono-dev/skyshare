# Implementation Plan

- [x] 1. 文字数の数え方
- [x] 1.1 `textCount.ts` に3種類の数え方を実装する。
  - _Requirements: 1.1, 1.2, 1.3_
- [x] 1.2 数え方の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/textCount.test.ts`
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 自動伸長の高さ
- [x] 2.1 `autoGrowHeight.ts` を実装する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
- [x] 2.2 高さの算出の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/components/common/CountedTextInput/autoGrowHeight.test.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. 入力欄とカウンタ
- [x] 3.1 `CountedTextInput/index.tsx` を実装する。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
- [x] 3.2 描画の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/components/common/CountedTextInput/index.test.ts`
  - E2E: `tests/e2e/countedTextInput.spec.ts` ゲスト表示の設定ページを開いて1行の入力欄へ文字を入力する → 入力した値が欄に反映される
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
