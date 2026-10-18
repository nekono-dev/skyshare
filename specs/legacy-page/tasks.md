# 旧形式の投稿ページ タスク一覧

## Phase 1: 旧バックエンドへの依頼

- 対応: D-1
- [x] T-1.1: `pagedb.ts` を実装する。
- [x] T-1.2: 依頼の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/legacy/pagedb.test.ts`

## Phase 2: 削除のハンドラ

- 対応: D-2
- [x] T-2.1: `page.ts` に削除のハンドラを実装する。
- [x] T-2.2: ハンドラの単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/pages/v1/page.test.ts`

## Phase 3: 投稿ページと削除のボタン

- 対応: D-3
- [x] T-3.1: 投稿ページと `LegacyPageDeleteButton/index.tsx` を実装する。
- 検証: `npx tsc --noEmit` と `npm run test:astro`
- E2E: `tests/e2e/legacyPostPage.spec.ts` 識別子が不正な旧形式のURLを開く → 404が返る
