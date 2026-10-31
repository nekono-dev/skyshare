# Brief: ops-config-secrets

## Problem

設定とシークレットの処理が、同じ処理を複数の場所に持っている。wrangler.jsonc の生成は 4 箇所から子プロセスで呼ばれ、dotenv の解析は 2 通り、JSONC の解析は 2 通り（`scripts/lib/jsonc.mjs` と宣言されていない `jsonc-parser`）、wrangler の `name` の読み取りは正規表現で 2 箇所に複製されている。どれが正本かが読んでも分からない。

## Current State

- wrangler.jsonc の生成: `scripts/render-wrangler.mjs`（`buildWranglerConfig`・`readConfig` を export し、CLI は main ガード付き）。呼び出し元は `scripts/prepare-local-env.mjs`（`execFileSync`）、`scripts/run-e2e.mjs`（`spawnSync` で `e2e`・`develop` の 2 回）、`scripts/render-deploy-config.mjs`（`execFileSync` で `production`）、`scripts/sync-github-variables.mjs`（`readConfig` を import）。
- dotenv: `scripts/lib/dotenv.mjs`（`parseDotenv`）と、`scripts/prepare-local-env.mjs` の `RegExp` による書き換え。
- JSONC: `scripts/lib/jsonc.mjs`（`astro.config.mjs`・`scripts/render-wrangler.mjs`・テストが使う）と `jsonc-parser`（`hack/survey-cli/remote.ts`。`package.json` に無い推移的依存）。
- wrangler の `name` の読み取り: `scripts/ensure-worker-secrets.mjs` と `scripts/sync-github-variables.mjs` が、それぞれ `/"name"\s*:\s*"([^"]+)"/` で読む。
- 秘密の生成: `scripts/prepare-local-env.mjs` の `GENERATORS`（`ensure-worker-secrets.mjs` が import）と `scripts/generate-oauth-key.mjs`。役割は分かれている。
- GitHub のリポジトリ判定: `scripts/lib/github.mjs`。`sync-github-variables.mjs` と `survey/remote.ts` が使う。共有できている。
- **既知の論点（未決定）**: `.githooks/pre-push` は `test:all` の後に `scripts/sync-github-variables.mjs --if-configured` を実行し、push のたびに GitHub の Variables・Secrets を書き換える（運用上の要件と利用者が判断）。挙動は変えず、ここでは記録だけを残す。見直すなら利用者の判断を得てから行う。

## Desired Outcome

- wrangler.jsonc の生成は、1 つの関数（`scripts/config/`）を呼ぶ。子プロセスでの呼び出しはなくなる。
- dotenv の解析と JSONC の解析は、`scripts/lib/` の 1 つずつだけを使う。wrangler の `name` の読み取りも 1 つの関数にまとめる。
- 宣言されていない依存（`jsonc-parser`）を使わない。
- 秘密の値の扱い（生成・登録・表示しない）は変えない。

## Approach

設定（config → wrangler.jsonc）と秘密（.dev.vars・GitHub・Worker）の 2 つの責務に分ける。共通の解析は `scripts/lib/` に置き、各スクリプトは責務の処理だけを持つ。

## Scope

- **In**: wrangler.jsonc の生成の入口、dotenv・JSONC・wrangler 名の読み取りの共通化、秘密の生成と登録の責務の分担、`render-deploy-config.mjs` の `execFileSync` 呼び出し、`.dev.vars`・`config/*.json` の読み書きの経路。
- **Out**: pre-push の挙動（既知の論点として残す）、CI の workflow の構成、ファイルの配置（ops-tooling-layout）、DEVELOP.md（develop-docs）。

## Boundary Candidates

- 設定の生成（render-wrangler・render-deploy-config・prepare-local-env の一部）
- 秘密の準備と登録（prepare-local-env・ensure-worker-secrets・sync-github-variables・generate-oauth-key）
- 共通の解析（scripts/lib/dotenv・jsonc・github）

## Out of Boundary

- BRW・cc-sdd の導入（ops-agent-setup）、survey CLI の中身（survey の解析の JSONC 差し替えだけを本 spec で扱う）、E2E の起動（ops-tooling-layout の移動のみ）

## Upstream / Downstream

- **Upstream**: なし
- **Downstream**: ops-tooling-layout（配置の移動が、ここで決めた入口を参照する）、develop-docs

## Existing Spec Touchpoints

- **Extends**: なし（`test-foundation` の hack のテストは、解析の入口の変更に合わせて更新する）
- **Adjacent**: `ops-agent-setup`（`setup-git-hooks.mjs`）、`ops-tooling-layout`（移動）

## Constraints

- `wrangler.jsonc` は生成物で、手で編集しない。生成の結果（内容）は変えない。
- 生成した値は標準出力・ログに出さない（既存の規則）。
- `tests/unit/scripts/` の既存テスト（`renderWrangler.test.ts`・`syncGithubVariables.test.ts`）を通す。
