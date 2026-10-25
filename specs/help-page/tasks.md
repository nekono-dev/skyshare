# ヘルプページ タスク一覧

## Phase 1: 記事の組み立て

- 対応: D-1
- [x] T-1.1: 記事の組み立て関数を `buildHelpEntries` として実装する。
- [x] T-1.2: 記事の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/components/help/helpEntries.test.ts`

## Phase 2: 表示

- 対応: D-2
- [x] T-2.1: `Help/index.tsx`・`HelpItem/index.tsx`・`help.astro` を実装する。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/helpPage.spec.ts` ヘルプのページを開く → 記事の見出しがカードごとに表示される

## Phase 3: 単独のページ化

- 対応: D-3
- [x] T-3.1: `help.astro` からサイドバーとフッターナビを外し、`StandaloneFooter` と設定のページへ戻るリンクを置く。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/helpPage.spec.ts` ヘルプのページを開く → サイドバーとフッターナビがなく、設定のページへ戻るリンクがある
