# Brief: repo-root-layout

## Problem

ルートディレクトリにファイルが増え、どれが設定でどれが文書で、どれが生成物かが一目で分からない。開発者（利用者本人とエージェント）が必要なファイルを探すのに手間がかかる。

## Current State

ルートに約 21 のファイルと多数のディレクトリがある。テスト設定 5 件（`vitest.*.config.ts`）・`playwright.config.ts`・`stryker.config.mjs` と、`orval.config.ts`・`wrangler.template.jsonc`・`.dev.vars.template` などの設定が根に並ぶ。文書（`DEVELOP.md`・`README-jp.md`・`promotion/`）も根にある。`coverage/`・`test-results/`（生成物）が根に出ている。`ops-tooling-layout` は `scripts/` の配置だけを扱い、根は対象外。

## Desired Outcome

- 設定ファイル・文書・生成物が、役割ごとのフォルダに収まり、根に残るのはツールの規約で根に必要なものだけになる。
- 移動の後も、`npm run dev`・`build`・`test:all`・CI（`.github/workflows/`）・hooks・エージェントの導入（cc-sdd・BRW）が移動の前と同じに動く。

## Approach

「移動できないものを除き、役割ごとに移す」方針。参照の更新は `ops-tooling-layout` と同じく、コード・設定・CI・hooks・文書をまとめて直す。大きい移動（`_legacy/`・`lexicons/`・`atproto/`・`openapi/`・`migrations/`）は今回は動かさない。`patches/` は削除する（`@atproto/api` のパッチは検証の結果、不要と判断）。

## Scope

- **In**:
  - テスト設定（`vitest.*.config.ts` 5 件・`playwright.config.ts`・`stryker.config.mjs`）の配置。配置先は design で決める（候補: `config/test/`）。
  - 文書（`DEVELOP.md`・`README-jp.md`・`promotion/`）を `docs/` へ移す。`README.md` は GitHub の表示のため根に残す。
  - `orval.config.ts`・`wrangler.template.jsonc`・`.dev.vars.template` を `config/` 配下へ移す（参照元が見つかるものだけ）。
  - 生成物の出力先（`coverage/`・`test-results/`）を 1 つのキャッシュ用フォルダにまとめ、`.gitignore` を一括で直す。
  - `playwright/`（認証の一時ファイル）を `tests/` 配下へ移す。
  - 上記の参照（`package.json`・CI・hooks・`.vscode`・`.codex`・`.claude`・文書・コメント）の更新。
- **Out**:
  - `_legacy/`・`lexicons/`・`openapi/`・`migrations/`・`atproto/`（submodule）の移動。
  - `.memo`（今後も使うため根に残す）。
  - 根に必要なファイル: `package.json`・`tsconfig.json`・`astro.config.mjs`・`.gitignore`・`.prettierrc`・`.prettierignore`・`.gitmodules`・`README*`・`LICENSE*`・`CLAUDE.md`・`AGENTS.md`・`.branch-release-workflow*.json`・`wrangler.jsonc`（生成物）・`.dev.vars`。隠しディレクトリ（`.claude`・`.codex`・`.kiro` など）と `node_modules`・`.astro`・`dist`・`.wrangler`。
  - `scripts/` の中の配置（`ops-tooling-layout` の範囲）。
  - アプリの振る舞いと CI のジョブ名。

## Boundary Candidates

- 設定ファイルの配置（テスト・ビルド・デプロイの設定）
- 文書と生成物の配置（`docs/`・キャッシュ用フォルダ）
- 参照の更新（移動の後の経路の整合）

## Out of Boundary

- 大きい移動（`_legacy/`・`lexicons/`・`atproto/` など）。別の spec で扱う。
- `scripts/` の内部の配置と命名（`ops-tooling-layout`）。
- `.memo` の扱い（現状のまま）。

## Upstream / Downstream

- **Upstream**: `ops-tooling-layout`（`vitest` の include・`tsconfig` を同じ時期に触るため、着手の順序を design で確認する）。
- **Downstream**: なし。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: `ops-tooling-layout`（`scripts/` と vitest 設定）、`test-foundation`（テスト設定の参照）、`develop-docs`（`DEVELOP.md` の移動）、`ops-agent-setup`（BRW・cc-sdd の導入の参照）。

## Constraints

- `CLAUDE.md`・`AGENTS.md`・`.branch-release-workflow.json` は根に残す（cc-sdd・BRW の規約）。
- `wrangler.jsonc` は `scripts/config/render-wrangler.mjs` が根に生成する。生成先を変える場合は design で決める。
- 移動は `git mv` で行い、履歴を残す。
- 参照の更新の後、`npm run build`・`npm run dev`・`npm run test:all` で確認する。
