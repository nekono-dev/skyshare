# 不具合報告と機能提案の受付 タスク一覧

## Phase 1: ビルドの情報

- 対応: D-5
- [x] T-1.1: `buildEnv.ts` の `resolveBuildInfo`・`parseRepositorySlug` と `buildInfo.ts` を実装する。
- [x] T-1.2: `astro.config.mjs` で Git の値を読み、`define` でコミットとリポジトリを埋め込む。
- [x] T-1.3: 単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/site/buildEnv.test.ts`

## Phase 2: Issue の組み立てと作成

- 対応: D-3, D-4
- [x] T-2.1: `issueContent.ts` の `buildIssue`・`fencedBlock`・`inlineValue` を実装する。
- [x] T-2.2: `githubIssue.ts` の `createGithubIssue` を実装する。
- [x] T-2.3: 単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/feedback`

## Phase 3: 受付の API

- 対応: D-1, D-2
- [x] T-3.1: `limits.ts` とスキーマ `v2/feedback/post.ts` を追加して対応表に登録し、`npm run codegen` を実行する。
- [x] T-3.2: `env.ts` と `src/pages/v2/feedback.ts` を実装する。
- [x] T-3.3: `wrangler.template.jsonc` の本番とプレビューに回数の制限のバインディングを宣言する。
- [x] T-3.4: API の統合テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/pages/v2/feedback.test.ts`
