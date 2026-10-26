# Implementation Plan

- [x] 1. 削除範囲の判定
- [x] 1.1 `resolveEntryDeleteScope.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/entry/resolveEntryDeleteScope.test.ts`
  - _Requirements: 2.4, 2.5_

- [x] 2. 選択と最終確認
- [x] 2.1 `EntryDeleteConfirmDialog` と `ChoiceDialog` の `description` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_
- [x] 2.2 `DeletePostListDialog` と `DeletePostListItem` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_
- [x] 2.3 削除済みの派生元・409の応答を確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/entryDeleteDialog.spec.ts` スレッドのentryでリンクとBluesky投稿を削除を選ぶ → 2件の一覧と注意が表示され、確定でスレッド全体が消える
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

- [x] 3. ゲスト表示
- [x] 3.1 ゲスト表示の削除範囲と削除の模擬を実装する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/entryDeleteDialog.spec.ts` ゲスト表示のentry一覧で単発のentryを削除する → 最終確認を経てカードが消える
  - _Requirements: 4.1_
