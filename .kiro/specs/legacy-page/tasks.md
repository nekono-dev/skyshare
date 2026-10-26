# Implementation Plan

- [x] 1. 旧バックエンドへの依頼
- [x] 1.1 `pagedb.ts` を実装する。
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3_
- [x] 1.2 依頼の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/legacy/pagedb.test.ts`
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3_

- [x] 2. 削除のハンドラ
- [x] 2.1 `page.ts` に削除のハンドラを実装する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.4, 4.1, 4.2_
- [x] 2.2 ハンドラの単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.4, 4.1, 4.2_
- [x] 2.3 OAuth のセッションを403で拒否し、受け入れ条件 4.1 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/pages/v1/page.test.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.4, 4.1, 4.2_

- [x] 3. 投稿ページと削除のボタン
- [x] 3.1 投稿ページと `LegacyPageDeleteButton/index.tsx` を実装する。
  - _Requirements: 1.3, 2.1, 4.1, 4.2_
- [x] 3.2 削除のボタンに OAuth のセッションでの拒否の文言を加え、受け入れ条件 4.2 の単体テストをタグ付きで追加する。
  - 検証: `npx tsc --noEmit` と `npm run test:astro` と `npx vitest run tests/components/entry/LegacyPageDeleteButton.test.ts`
  - E2E: `tests/e2e/legacyPostPage.spec.ts` 識別子が不正な旧形式のURLを開く → 404が返る
  - _Requirements: 1.3, 2.1, 4.1, 4.2_
