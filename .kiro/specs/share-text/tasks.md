# Implementation Plan

- [x] 1. 文字数と省略
- [x] 1.1 `intentLength.ts` に宛先別の文字数関数を実装する。
  - _Requirements: 2.1, 2.2, 3.3, 3.4, 3.5, 3.6, 3.7_
- [x] 1.2 `truncateText.ts` に `truncateBodyWithSuffix` を実装する。
  - _Requirements: 2.1, 2.2, 3.3, 3.4, 3.5, 3.6, 3.7_
- [x] 1.3 文字数と省略の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/share/intentLength.test.ts tests/util/share/truncateText.test.ts`
  - _Requirements: 2.1, 2.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 2. 共有文の組み立て
- [x] 2.1 `intent.ts` に `buildIntentSuffix`・`buildIntentText`・`resolveTruncateLimit` を実装する。
  - _Requirements: 1.1, 1.2, 3.1, 3.2_
- [x] 2.2 組み立てと省略上限の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/share/intent.test.ts`
  - _Requirements: 1.1, 1.2, 3.1, 3.2_
