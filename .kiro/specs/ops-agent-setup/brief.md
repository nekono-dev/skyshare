# Brief: ops-agent-setup

## Problem

エージェント（Claude Code・Codex）の導入の仕組みが、セッションのたびに別々の方法で動いている。cc-sdd の導入は版が固定されず（`@latest`）、導入のたびに追跡ファイル（`.kiro/settings/`・`CLAUDE.md`）が書き換わる。BRW（branch-release-workflow）の取得元は、cc-sdd の再導入で設定ファイルが消えたまま CI が参照している。運用者は、どの仕組みがどのエージェントに効くかを追えない。

## Current State

- `.claude/settings.json` の `SessionStart`: `npx cc-sdd@latest --yes --claude-skills --lang ja` を直接書く。加えて `.claude/hooks/session-start.sh` を呼ぶ。
- `.codex/hooks.json`: `npx cc-sdd@latest --yes --codex-skills --lang ja` を直接書く。Claude と同じ導入を別に持つ。
- `.claude/settings.json` の `enabledPlugins`・`extraKnownMarketplaces`: BRW をプラグインとして GitHub から導入する（Claude 側）。
- `.claude/branch-release-workflow.json`: 通常ファイル（BRW の設定。ブランチ運用の宣言）。`DEVELOP.md` は「正本へのリンク」と書くが、実体はリンクではない。
- `scripts/setup-brw.mjs`: `.branch-release-workflow-source.json` を読んで BRW を clone する。`--codex` で `.agents/skills/` に導入する。CI（`deploy.yaml`・`preview.yaml`）が呼ぶ。**このファイルは `0ffaa17` で削除されたまま**のため、CI が失敗する。
- `.agents/skills/branch-release-workflow`: `~/.cache/skyshare/brw` への symlink（gitignore 対象）。
- `.claude/hooks/session-start.sh`: クラウドの初期化。`scripts/setup-git-hooks.mjs`・`npm install`・`npm run codegen`・`.dev.vars` の雛形コピーを行う。`npm install` の `prepare` が `setup-git-hooks.mjs` を既に呼ぶ。

## Desired Outcome

- cc-sdd の導入は 1 つのスクリプトが行い、Claude と Codex の両方がそれを呼ぶ。版は 3.1.0 に固定する。
- 導入の結果をコミットに含め、セッション開始で追跡ファイルの差分が出ない。
- BRW の取得元を復元し、CI の `setup-brw.mjs` が通る。
- BRW の配布は Claude（プラグイン）と Codex（clone と symlink）に分け、それぞれが 1 つの経路だけを使う。

## Approach

エージェントの導入の入口（SessionStart の設定）と、その中身（cc-sdd・BRW・クラウドの初期化）を分ける。中身は 1 つのスクリプトに集め、設定ファイルは呼ぶだけにする。

## Scope

- **In**: SessionStart の設定（Claude・Codex）、cc-sdd の導入スクリプトと版の固定、BRW の取得元と Codex への導入、`.claude/branch-release-workflow.json` の扱い、クラウドの初期化スクリプトの場所。
- **Out**: cc-sdd 本体の仕様、BRW スキルの中身（別リポジトリ）、各 spec の kiro スキル、plugin の marketplace 自体。

## Boundary Candidates

- SessionStart の入口（`.claude/settings.json`・`.codex/hooks.json`）
- cc-sdd の導入（新規の共有スクリプト）
- BRW の取得と配布（`scripts/setup-brw.mjs`・`.branch-release-workflow-source.json`・`.agents/skills/`）

## Out of Boundary

- wrangler・secrets の生成（ops-config-secrets）、hack の配置（ops-tooling-layout）、DEVELOP.md（develop-docs）

## Upstream / Downstream

- **Upstream**: なし（cc-sdd・BRW は外部）
- **Downstream**: ops-tooling-layout（導入スクリプトの配置）、develop-docs（導入の手順の記述）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `ops-config-secrets`（`setup-git-hooks.mjs` は両方から呼ばれうる。所有は本 spec）

## Constraints

- cc-sdd は 3.1.0 固定（`CLAUDE.md` の記録・memory の決定）。
- Codex の BRW の導入は `scripts/install-codex.mjs`（BRW 側）に依存する。
- `.claude/hooks/` は Claude の harness が参照する場所のため、移動しない。
