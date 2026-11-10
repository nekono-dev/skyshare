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

- cc-sdd の導入は 1 つのスクリプトが Claude 向けに行う。版は 3.1.0 に固定する。
- 導入物は gitignore のまま。セッション開始で追跡ファイルの差分が出ない。
- BRW の取得元を復元し、CI の `setup-brw.mjs` が通る。
- BRW の配布は Claude（プラグイン）だけにする。Codex 向けの導入物（AGENTS.md・`.codex/hooks.json`・`.codex/agents/`・`.agents/skills/` の生成物）は持たない。Codex の使い方は `codex-mcp-subagent` が定める。

## Approach

エージェントの導入の入口（SessionStart の設定）と、その中身（cc-sdd・BRW・クラウドの初期化）を分ける。中身は 1 つのスクリプトに集め、設定ファイルは呼ぶだけにする。

## Scope

- **In**: Claude の SessionStart の設定、cc-sdd の導入スクリプトと版の固定、BRW の取得元と Claude への導入、`.claude/branch-release-workflow.json` の扱い、クラウドの初期化スクリプトの場所、Codex 向けの導入物の取り消し。
- **Out**: cc-sdd 本体の仕様、BRW スキルの中身（別リポジトリ）、各 spec の kiro スキル、plugin の marketplace 自体、Codex の MCP 連携（`codex-mcp-subagent`）、`.agents/skills/survey-run/`（扱いは別途）。

## Boundary Candidates

- SessionStart の入口（`.claude/settings.json`）
- cc-sdd の導入（共有スクリプト。Claude 向けだけ）
- BRW の取得と Claude への導入（`scripts/agent/setup-brw.mjs`・`.branch-release-workflow-source.json`）
- Codex 向けの導入物の取り消し（`AGENTS.md`・`.codex/hooks.json`・`.codex/agents/`・`.agents/skills/` の生成物）

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
- `.claude/hooks/` は Claude の harness が参照する場所のため、移動しない。

## 確定した判断（2026-11-08 改訂。以前の判断は下の履歴）

- cc-sdd は `scripts/agent/install-cc-sdd.sh --claude` だけが導入する（固定版 3.1.0・日本語）。Claude の SessionStart が呼ぶ。
- Codex 向けの導入（cc-sdd の `--codex`・`.agents/skills/`・`.codex/agents/`・`.codex/hooks.json`・AGENTS.md）と、BRW の Codex 側（`.agents/skills/branch-release-workflow`・`install-codex.mjs` の呼び出し）は取り消す。利用者の決定による。
- BRW は Claude のプラグインとして、プロジェクトの設定（`.claude/settings.json`）で有効にする。marketplace は GitHub の `nekono-dev/claude-plugins`。起動のたびにユーザーの設定を書き換えず、端末に BRW の clone を置かない（2026-11-08 に変更。以前の `setup-brw --install` の方式はやめる）。
- 導入物（`.claude/skills/kiro-*`・`.kiro/settings/`）は gitignore のまま、コミットしない。
- `.agents/skills/survey-run/`（Codex 用の複製）は本改訂の対象外。扱いは別途決める。

## 確定した判断（2026-10-26〜31。2026-11-08 に一部取り消し）

- cc-sdd は `scripts/agent/install-cc-sdd.sh --claude|--codex` が固定版（3.1.0・日本語）で導入する。Claude と Codex の SessionStart が呼ぶ。
- スキル（`.claude/skills/kiro-*`）と設定の雛形（`.kiro/settings/templates/`）は gitignore し、導入のたびに固定版で入れ直す。
- SessionStart の導入は、起動の種類（`startup`・`resume`・`clear`・`compact`）を問わず毎回走らせる（`.claude/settings.json`・`.codex/hooks.json`）。templates が消えたまま spec を作る事象を防ぐため。
- cc-sdd のインストーラーは CLAUDE.md を丸ごと上書きするため、CLAUDE.md・AGENTS.md は導入の対象から外す。`--overwrite skip` は新規ファイルまで飛ばすため使わない。
- BRW の正本はルートの `.branch-release-workflow.json`。`.claude/branch-release-workflow.json` は正本へのシンボリックリンク。取得元は `.branch-release-workflow-source.json`。`npm run setup:brw` が Claude と Codex の両方へ導入する。
- 未了: Claude の実機確認（`.claude/settings.json` の変更、ユーザー設定の marketplace の入れ替え）。

## 既知の制約

- 導入直後のセッションでは、新しいスキルがスキル一覧に出ないことがある。その場合は SKILL.md を直接読む。
- plugin（`branch-release-workflow@nekono-dev`）は projectPath ごとに入れる。worktree では `claude plugin install <p>@nekono-dev --scope project` が要る。
