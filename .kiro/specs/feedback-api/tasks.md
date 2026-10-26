# Implementation Plan

- [x] 1. ビルドの情報
- [x] 1.1 `buildEnv.ts` の `resolveBuildInfo`・`parseRepositorySlug` と `buildInfo.ts` を実装する。
  - _Requirements: 3.5, 4.1, 4.2_
- [x] 1.2 `astro.config.mjs` で Git の値を読み、`define` でコミットとリポジトリを埋め込む。
  - _Requirements: 3.5, 4.1, 4.2_
- [x] 1.3 単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/site/buildEnv.test.ts`
  - _Requirements: 3.5, 4.1, 4.2_

- [x] 2. Issue の組み立てと作成
- [x] 2.1 `issueContent.ts` の `buildIssue`・`fencedBlock`・`inlineValue` を実装する。
  - _Requirements: 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5_
- [x] 2.2 `githubIssue.ts` の `createGithubIssue` を実装する。
  - _Requirements: 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5_
- [x] 2.3 単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/feedback`
  - _Requirements: 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 受付の API
- [x] 3.1 `limits.ts` とスキーマ `v2/feedback/post.ts` を追加して対応表に登録し、`npm run codegen` を実行する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
- [x] 3.2 `env.ts` と `src/pages/v2/feedback.ts` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
- [x] 3.3 `wrangler.template.jsonc` の本番とプレビューに回数の制限のバインディングを宣言する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
- [x] 3.4 API の統合テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/pages/v2/feedback.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
