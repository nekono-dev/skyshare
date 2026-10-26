# Implementation Plan

- [x] 1. 運営者情報と測定 ID
- [x] 1.1 `siteEnv.ts`・`siteConfig.ts` を実装し、`astro.config.mjs` に本番ビルドの検査を加える。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1_
- [x] 1.2 `AnalyticsTag.astro` を作り、`Metadatas.astro` から測定 ID を渡す。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1_
- [x] 1.3 受け入れ条件 1.1, 1.2, 1.3 から 2.1, 2.2 と 4.1 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/site tests/hack` と `npx vitest run -c vitest.astro.config.ts`
  - E2E: `tests/e2e/privacyPage.spec.ts` 設定なしの開発サーバーでプライバシーポリシーを開く → ダミーの窓口のメールアドレスが表示される
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1_

- [x] 2. 配備設定とワークフロー
- [x] 2.1 `wrangler.template.jsonc` のドメインを置き換え用の値にし、`render-deploy-config.mjs` で置き換える。
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_
- [x] 2.2 テンプレートから D1 の `database_id`・`zone_name`・previews の D1 と R2 を除く。
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_
- [x] 2.3 プレビュー用のマイグレーション補助を削除し、ワークフローに値の受け渡しを加える。
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_
- [x] 2.4 本番を main だけにし、develop を別の Worker として配備し、dev/\* のプレビューを develop の配下に作る。ステージングを廃止する。
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_
- [x] 2.5 `DEVELOP.md` に運用者ごとの設定を記載する。
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_
- [x] 2.6 受け入れ条件 3.1, 3.2 から 3.4 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/hack`
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_
