# Skyshareのリンクカードの優先表示 タスク一覧

## Phase 1: 共有文の本文の組み立て

- 対応: D-2
- [x] T-1.1: `removeFacetRanges` と `resolveShareBody` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/share/shareBody.test.ts`

## Phase 2: 設定の保持と切り替え

- 対応: D-1
- [x] T-2.1: `shareSettings.ts` と `useShareToggles` に設定を加え、単体テストを追加する。
- [x] T-2.2: 投稿フォームと設定ページに切り替えを置く。
- 検証: `npx vitest run tests/lib/settings/shareSettings.test.ts`
- E2E: `tests/e2e/linkCardPriority.spec.ts` 投稿フォームで画像を自分で添付をONにする → 直下の切り替えが操作不能になる

## Phase 3: 共有の経路への適用

- 対応: D-3
- [x] T-3.1: 投稿フォームの投稿直後の共有に適用する。
- [x] T-3.2: タイムラインのダイアログとWebShareに適用する。
- 検証: `npm run build`
- E2E: `tests/e2e/linkCardPriority.spec.ts` ゲスト表示でURLを含むentryの投稿の共有ダイアログからXを選ぶ → 共有文にentryのURLだけが残る
