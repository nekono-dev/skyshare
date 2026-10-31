# Brief: ops-tooling-layout

## Problem

`scripts/` は 15 を超えるファイルが平置きで、言語（`.mjs`・`.ts`・`.sh`）と命名（`surveyE2eHarness.mjs`・`oauthLoopbackForwarder.ts` のような camelCase と kebab-case の混在）がそろっていない。アンケート用の `render-survey-config.ts` は `scripts/` 直下にあり、アンケートの CLI は `scripts/survey/` にある。npm スクリプトには誤記（`build:pripare`）と重複（`test` と `test:all`、`dev` と `dev:build` の処理の重なり）がある。

## Current State

- `scripts/` 直下: `build-openapi-document.ts`・`ensure-worker-secrets.mjs`・`generate-oauth-key.mjs`・`lint-lexicon.sh`・`oauthLoopbackForwarder.ts`・`prepare-local-env.mjs`・`render-deploy-config.mjs`・`render-survey-config.ts`・`render-wrangler.mjs`・`run-e2e.mjs`・`setup-brw.mjs`・`setup-git-hooks.mjs`・`surveyE2eHarness.mjs`・`sync-github-variables.mjs`。
- `scripts/survey/`: `cli.ts`・`config.ts`・`lifecycle.ts`・`remote.ts`。
- `scripts/lib/`: `dotenv.mjs`・`github.mjs`・`jsonc.mjs`。
- 参照元: `package.json`（`scripts`）、`astro.config.mjs`（`oauthLoopbackForwarder`・`lib/jsonc`）、`orval.config.ts`（`build-openapi-document`）、`tests/unit/scripts/*.test.ts`、`.github/workflows/deploy.yaml`・`preview.yaml`、`.githooks/pre-push`、`.claude/hooks/session-start.sh`、`src/lib/oauth/*.ts`・`src/lib/api/schema/*.ts` のコメント、`openapi/README.md`・`lexicons/README.md`、`DEVELOP.md`。
- npm の運用系スクリプト: `build:pripare`（誤記。`run-e2e.mjs` も参照）、`dev:build`・`prev`・`build` の処理の重なり、`test` と `test:all` の同一の定義。

## Desired Outcome

- `scripts/` は領域のフォルダに分かれ（agent・config・secrets・survey・e2e・dev・build・git・lib）、ファイル名は kebab-case にそろう。
- 参照（import・spawn・CI・hooks・コメント・文書）の全てが新しいパスを指す。古いパスは残らない。
- 運用系の npm スクリプトは、誤記なく、重複なく、役割ごとに 1 つの名前を持つ。

## Approach

ops-agent-setup と ops-config-secrets の内容が確定した後に、ファイルを移動して参照を一括で直す。移動は内容を変えず、`git mv` で行い、差分を履歴に残す。

## Scope

- **In**: `scripts/` の配置と命名、参照の更新、`package.json` の運用系スクリプトの名前と重複、`tsconfig.json`・`vitest` の include、CI と hooks の参照。
- **Out**: 中身の重複の解消（ops-config-secrets・ops-agent-setup）、アプリ（`src/`）の振る舞い、文書の内容（develop-docs）。

## Boundary Candidates

- `scripts/` の配置（ファイルの移動）
- npm スクリプトの定義（`package.json`）
- 参照の更新（CI・hooks・import・コメント）

## Out of Boundary

- 中身のロジック、CI の処理内容、DEVELOP.md の本文

## Upstream / Downstream

- **Upstream**: ops-agent-setup・ops-config-secrets（確定した入口とファイル名）
- **Downstream**: develop-docs（新しい配置を文書に書く）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `test-foundation`（`tests/unit/scripts/` の import の更新のみ）

## Constraints

- CI の workflow の名前・ジョブ名は変えない（参照するパスと引数だけ直す）。
- `wrangler.jsonc`・`.dev.vars` などの生成物と秘密ファイルは対象外。
- `.claude/hooks/` は Claude の harness が参照するため、移動の対象外（中身だけ `scripts/` の入口を呼ぶ）。
