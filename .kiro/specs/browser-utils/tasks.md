# Implementation Plan

- [x] 1. 判定と待機
- [x] 1.1 `object.ts` と `waitForImageLoad.ts` を実装する。
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.4_
- [x] 1.2 判定と待機の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/object.test.ts tests/util/waitForImageLoad.test.ts`
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.4_

- [x] 2. スクロールの固定
- [x] 2.1 `scrollLock.ts` を実装する。
  - _Requirements: 2.1, 2.2, 2.3_
- [x] 2.2 固定の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/scrollLock.test.ts`
  - _Requirements: 2.1, 2.2, 2.3_
