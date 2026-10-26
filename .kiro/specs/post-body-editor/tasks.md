# Implementation Plan

- [x] 1. 検出と部品への展開
- [x] 1.1 `facetHighlightSegments.ts` と `highlightNodeParts.ts` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_
- [x] 1.2 検出と展開の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/textarea/facetHighlightSegments.test.ts tests/util/textarea/highlightNodeParts.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

- [x] 2. 平文との相互変換
- [x] 2.1 `contentEditableModel.ts` を実装する。
  - _Requirements: 3.1, 3.2, 3.3_
- [x] 2.2 変換の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/textarea/contentEditableModel.test.ts`
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 差分更新と編集欄
- [x] 3.1 `contentEditableReconcile.ts` を実装し、`PostBodyEditor/index.tsx` に組み込む。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/postBodyEditor.spec.ts` ゲスト表示の投稿ページで本文欄へ「#tag」と入力しEnterを押す → 「#tag」が色付けされた要素になり、改行が入って入力済みの本文が残る
  - _Requirements: 1.5, 4.1_
