# Implementation Plan

- [x] 1. 共有文の本文の組み立て
- [x] 1.1 `removeFacetRanges` と `resolveShareBody` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/share/shareBody.test.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. 設定の保持と切り替え
- [x] 2.1 `shareSettings.ts` と `useShareToggles` に設定を加え、単体テストを追加する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
- [x] 2.2 投稿フォームと設定ページに切り替えを置く。
  - 検証: `npx vitest run tests/lib/settings/shareSettings.test.ts`
  - E2E: `tests/e2e/linkCardPriority.spec.ts` 投稿フォームで画像を自分で添付をONにする → 直下の切り替えが操作不能になる
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. 共有の経路への適用
- [x] 3.1 投稿フォームの投稿直後の共有に適用する。
  - _Requirements: 3.1_
- [x] 3.2 タイムラインのダイアログとWebShareに適用する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/linkCardPriority.spec.ts` ゲスト表示でURLを含むentryの投稿の共有ダイアログからXを選ぶ → 共有文にentryのURLだけが残る
  - _Requirements: 3.1_
