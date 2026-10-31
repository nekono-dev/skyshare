# Design Document

## Overview

**Purpose**: `scripts/` を領域のフォルダに分け、命名を kebab-case にそろえ、参照を一括で新しいパスへ直す。運用系の npm スクリプトの誤記を直す。
**Users**: 開発者・運用者（探しやすさ）、CI（参照の正しさ）。
**Impact**: `scripts/` の全ファイルのパスが変わる。import・spawn・CI・hooks・コメント・文書の参照が変わる。

### Goals

- 領域別のフォルダ（`agent`・`config`・`secrets`・`survey`・`e2e`・`dev`・`build`・`git`・`lib`）
- ファイル名を kebab-case にする
- 移動の前後で、型検査・テスト・ビルドの結果が変わらない

### Non-Goals

- 中身のロジック（ops-config-secrets・ops-agent-setup で扱う）
- CI のジョブ名、DEVELOP.md の本文（develop-docs）

## Architecture

### Existing Architecture Analysis

`scripts/` 直下に 14 ファイル、`scripts/survey/` と `scripts/lib/` がある。`render-survey-config.ts` は `scripts/` 直下、アンケートの CLI は `scripts/survey/`。`.claude/hooks/` は Claude の harness が参照するため、移動しない。

### 移動の対応表

**規則**: ops-agent-setup と ops-config-secrets は、新しく作るファイルを最終の配置（`scripts/agent/`・`scripts/config/`・`scripts/secrets/`・`scripts/lib/`）で作る。既存ファイルの移動は、この表に従って本 spec だけで行う（`git mv` で履歴を残す）。

| 移動の前                                          | 移動の後                                                               | 理由                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| `scripts/setup-brw.mjs`                           | `scripts/agent/setup-brw.mjs`                                          | BRW の取得                           |
| `scripts/render-wrangler.mjs`                     | `scripts/config/render-wrangler.mjs`                                   | 設定の生成                           |
| `scripts/render-deploy-config.mjs`                | `scripts/config/render-deploy-config.mjs`                              | 設定の生成                           |
| `scripts/prepare-local-env.mjs`                   | `scripts/secrets/prepare-local-env.mjs`                                | 秘密の準備                           |
| `scripts/ensure-worker-secrets.mjs`               | `scripts/secrets/ensure-worker-secrets.mjs`                            | 秘密の登録                           |
| `scripts/sync-github-variables.mjs`               | `scripts/secrets/sync-github-variables.mjs`                            | 秘密の登録                           |
| `scripts/generate-oauth-key.mjs`                  | `scripts/secrets/generators.mjs`（統合済み。要件 6.3）                 | 秘密の生成                           |
| `scripts/render-survey-config.ts`                 | `scripts/survey/render-survey-config.ts`                               | アンケートの設定（CLI と同じ領域）   |
| `scripts/run-e2e.mjs`                             | `scripts/e2e/run-e2e.mjs`                                              | E2E                                  |
| `scripts/surveyE2eHarness.mjs`                    | `scripts/e2e/survey-e2e-harness.mjs`                                   | E2E（kebab-case）                    |
| `scripts/oauthLoopbackForwarder.ts`               | `scripts/dev/oauth-loopback-forwarder.ts`                              | 開発サーバーの中継（kebab-case）     |
| `scripts/build-openapi-document.ts`               | `scripts/build/build-openapi-document.ts`                              | ビルド                               |
| `scripts/lint-lexicon.sh`                         | `scripts/build/lint-lexicon.sh`                                        | 検査                                 |
| `scripts/setup-git-hooks.mjs`                     | `scripts/git/setup-git-hooks.mjs`                                      | hooksPath                            |
| `scripts/lib/*`                                   | `scripts/lib/*`（変更なし）                                            | 共通                                 |
| `scripts/survey/{cli,config,lifecycle,remote}.ts` | `hack/survey-cli/*`（改訂 2026-10-31: 手作業の CLI のため `hack/` へ） | アンケートの CLI（`npm run survey`） |
| `scripts/survey/render-survey-config.ts`          | 変更なし（自動化: `npm run survey:render`）                            | アンケートの設定の生成               |

### 参照の更新の一覧（移動の後に検索して 0 件にする）

- `package.json`: `prepare`・`apigen:doc`・`setup:local`・`survey`・`survey:render`・`test:lexicon`・`test:e2e`・`sync:github`・`setup:brw`
- `astro.config.mjs`: `./scripts/oauthLoopbackForwarder.ts`・`./scripts/lib/jsonc.mjs`（lib は変わらない）
- `orval.config.ts`: `./scripts/build-openapi-document`
- `tests/unit/scripts/*.test.ts`: import のパス
- `.github/workflows/deploy.yaml`・`preview.yaml`・`e2e.yaml`: `scripts/setup-brw.mjs`・`scripts/render-deploy-config.mjs`・`scripts/ensure-worker-secrets.mjs`
- `.githooks/pre-push`: `scripts/sync-github-variables.mjs`・`scripts/setup-git-hooks.mjs`（コメント）
- `.claude/hooks/session-start.sh`: `scripts/setup-git-hooks.mjs`
- `scripts/**` の内部: 相対 import、`node scripts/...` の spawn、使い方のコメント
- `src/lib/oauth/*.ts`・`src/lib/api/schema/*.ts`・`openapi/README.md`・`lexicons/README.md`・`wrangler.template.jsonc`・`astro.config.mjs` のコメント

### npm スクリプトの整理

| スクリプト      | 変更                                                                              | 理由                       |
| --------------- | --------------------------------------------------------------------------------- | -------------------------- |
| `build:pripare` | `build:prepare` に改名（`build`・`dev`・`run-e2e` の参照も更新）                  | 誤記                       |
| `test`          | 変更なし（`test:all` への別名。`npm test` の入口として残す）                      | 確認の結果、重複は別名だけ |
| `dev:build`     | 変更なし（`setup:local` → `build` → `wrangler dev` の入口。DEVELOP の手順に対応） | 重なりは用途が違う         |
| `prev`          | 変更なし（DEVELOP のプレビュー手順が使う）                                        | 参照あり                   |

## Testing Strategy

- **型検査**: `npm run test:type`（`tsconfig.json` の `scripts/**/*`）。移動の前後で通る。
- **単体**: `npm run test:unit`（`tests/unit/scripts/`）。import の更新だけで期待値は変えない。
- **ビルド**: `npm run build` が移動の前と同じ成果物を出す（`dist/` の存在と `wrangler.jsonc` の生成まで）。
- **参照の検査**: 移動の後に旧パスを検索し、0 件であることを確かめる（`grep -rn "scripts/<旧名>"`）。

## Risks and Open Questions

- `astro.config.mjs` と `orval.config.ts` は、`scripts/` の import が無いと起動に失敗する。移動の後に `npm run dev` と `npm run apigen` を実行して確かめる。
- CI の workflow は、移動の後のパスで実行されるまで検証できない。`actionlint` 相当の構文検査と、パスの存在確認（`test -f`）で代替する。
