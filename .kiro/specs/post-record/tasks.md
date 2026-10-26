# Implementation Plan

- [x] 1. レコードと検証
- [x] 1.1 `post.ts` に `buildBskyPostRecord` と `isReplyRefOwnedBySelf` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_
- [x] 1.2 `facet.ts` に `validateFacets` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_
- [x] 1.3 レコードと検証の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/atproto/post.test.ts tests/lib/atproto/facet.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

- [x] 2. 抽出・集計・検出
- [x] 2.1 `richtext.ts` に抽出・集計・検出の関数を実装する。
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
- [x] 2.2 抽出・集計・検出の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/atproto/richtext.test.ts`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
