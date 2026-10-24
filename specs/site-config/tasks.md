# 運用者ごとの設定 タスク一覧

## Phase 1: 運営者情報と測定 ID

- 対応: D-1
- [x] T-1.1: `siteEnv.ts`・`siteConfig.ts` を実装し、`astro.config.mjs` に本番ビルドの検査を加える。
- [x] T-1.2: `AnalyticsTag.astro` を作り、`Metadatas.astro` から測定 ID を渡す。
- [x] T-1.3: 受け入れ条件 AC-1 から AC-6 と AC-10 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/site tests/hack` と `npx vitest run -c vitest.astro.config.ts`
- E2E: `tests/e2e/privacyPage.spec.ts` 設定なしの開発サーバーでプライバシーポリシーを開く → ダミーの窓口のメールアドレスが表示される

## Phase 2: 配備設定とワークフロー

- 対応: D-2
- [x] T-2.1: `wrangler.template.jsonc` のドメインを置き換え用の値にし、`render-deploy-config.mjs` で置き換える。
- [x] T-2.2: テンプレートから D1 の `database_id`・`zone_name`・previews の D1 と R2 を除く。
- [x] T-2.3: プレビュー用のマイグレーション補助を削除し、ワークフローに値の受け渡しを加える。
- [x] T-2.4: 本番を main だけにし、develop を別の Worker として配備し、dev/\* のプレビューを develop の配下に作る。ステージングを廃止する。
- [x] T-2.5: `DEVELOP.md` に運用者ごとの設定を記載する。
- [x] T-2.6: 受け入れ条件 AC-7 から AC-9 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/hack`
