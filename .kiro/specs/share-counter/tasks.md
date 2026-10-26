# Implementation Plan

- [x] 1. 減算量の算出
- [x] 1.1 `estimateEntryUrl.ts` に `estimateSkyshareEntryUrl` を実装する。
  - _Requirements: 1.2, 1.3, 1.4_
- [x] 1.2 URL予測の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/share/counterReserve.test.ts`
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 2. カウンタへの適用
- [x] 2.1 `counterReserve.ts` に `resolveCounterTargets` と `resolveCounterReserve` を実装する。
  - _Requirements: 1.1, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4_
- [x] 2.2 `ThreadComposer` と `ThreadSegmentForm` でカウンタの表示と上限の補正を行う。
  - _Requirements: 1.1, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4_
- [x] 2.3 画像を自分で添付による上限の復帰と、2件目以降の投稿の上限を確認するE2Eテストを追加する。
  - 検証: `npx vitest run tests/lib/share/counterReserve.test.ts -t resolveCounter`
  - E2E: `tests/e2e/intentShare.spec.ts` 自動ポップアップするSNSを切り替えて投稿フォームを開く → 選択に応じたX・タイッツーのカウンタと、上限300のBlueskyのカウンタが表示される
  - _Requirements: 1.1, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4_
