# Implementation Plan

- [x] 1. 記事の組み立て
- [x] 1.1 記事の組み立て関数を `buildHelpEntries` として実装する。
  - _Requirements: 1.1, 1.2_
- [x] 1.2 記事の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/components/help/helpEntries.test.ts`
  - _Requirements: 1.1, 1.2_

- [x] 2. 表示
- [x] 2.1 `Help/index.tsx`・`HelpItem/index.tsx`・`help.astro` を実装する。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/helpPage.spec.ts` ヘルプのページを開く → 記事の見出しがカードごとに表示される
  - _Requirements: 2.1_

- [x] 3. 単独のページ化
- [x] 3.1 `help.astro` からサイドバーとフッターナビを外し、`StandaloneFooter` と設定のページへ戻るリンクを置く。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/helpPage.spec.ts` ヘルプのページを開く → サイドバーとフッターナビがなく、設定のページへ戻るリンクがある
  - _Requirements: 2.2_
