# Requirements Document

## Introduction

エージェントの導入の仕組みを Claude Code に一本化する。cc-sdd の導入は 1 つのスクリプトが Claude 向けに行い、版を 3.1.0 に固定する。BRW（branch-release-workflow）は、プロジェクトの設定で GitHub の marketplace（`nekono-dev/claude-plugins`）を宣言して有効にする。端末に BRW のコピーは置かず、起動のたびの導入もしない。Codex への cc-sdd・BRW の導入は取り消す。Codex の使い方（MCP の子エージェント）は別の spec `codex-mcp-subagent` が定める。

## Boundary Context (Optional)

- **In scope**: Claude の SessionStart の設定、cc-sdd の導入スクリプトと版、BRW の有効化（プロジェクトの設定）と CI 用の取得元、`.claude/branch-release-workflow.json` の扱い、Codex 向けに生成されていた導入物の取り消し（`AGENTS.md`・`.codex/hooks.json`・`.codex/agents/`・`.agents/skills/` の生成物と、その gitignore の行）。
- **Out of scope**: cc-sdd 本体・BRW スキルの中身、kiro スキルの内容、Codex の MCP 連携と `.codex/config.toml`（`codex-mcp-subagent`）、wrangler と秘密の処理、`scripts/` の配置、`.agents/skills/survey-run/`（Codex 用の複製。扱いは別途決める）、利用者のユーザー設定（`~/.claude/settings.json`）の整理（利用者の承認が要る）。
- **Adjacent expectations**: `codex-mcp-subagent`（Codex の利用）、`ops-config-secrets`（秘密と設定）、`ops-tooling-layout`（配置の移動）、`develop-docs`（導入の手順の記述）。

## Requirements

### Requirement 1: cc-sdd の導入の入口

**Objective:** As a 運用者, I want cc-sdd の導入を 1 つの入口で行う, so that 導入の内容が一箇所で決まる

#### Acceptance Criteria

1. When Claude Code のセッションが開始されたとき, the エージェントの設定 shall cc-sdd の導入を、共有の導入スクリプトの 1 回の呼び出し（`--claude`）で行う
2. The 導入スクリプト shall cc-sdd の版を 3.1.0 に固定して実行する
3. The 導入スクリプト shall 言語の指定（`--lang ja`）を固定して渡す
4. The 導入スクリプト shall 引数 `--claude` だけを受け付ける。引数が無い、または他の値のとき、使い方を標準エラーに出して非ゼロで終了する
5. If cc-sdd の導入が失敗したとき, then the 導入スクリプト shall 非ゼロで終了し、失敗の内容を標準エラーに出し、失敗の記録（`.cache/cc-sdd-install.failed`）を書く。SessionStart は止められない（Claude Code の仕様）ため、停止は UserPromptSubmit で行う（Req 1.6）
6. While 失敗の記録（`.cache/cc-sdd-install.failed`）があるとき, the UserPromptSubmit のフック（`install-gate.mjs`）shall 利用者のプロンプトをブロックし、再試行の方法（`scripts/agent/install-cc-sdd.sh --claude`）を、Claude の外（通常のターミナル）で実行するよう理由として示す
7. While cc-sdd が導入されていない（`.claude/skills/<名前>/SKILL.md` が無い）とき, the UserPromptSubmit のフック（`kiro-gate.mjs`）shall `/kiro-*` のスラッシュコマンドをブロックし、`scripts/agent/install-cc-sdd.sh --claude` の実行を促す
8. When 導入（cc-sdd の導入）が成功したとき, the 導入スクリプト shall 失敗の記録を消す
9. The 導入スクリプト shall クラウドでも、ローカルと同じく失敗を記録して止める（利用者の決定。クラウドでネットワークと `npx` が使えることを前提とする）

### Requirement 2: cc-sdd の導入物の差分

**Objective:** As a 開発者, I want セッション開始で追跡ファイルが変わらない, so that 導入の差分がコミットに混ざらない

#### Acceptance Criteria

1. When cc-sdd の導入を行ったとき, the 導入スクリプト shall 追跡ファイル（`CLAUDE.md`）を変更しない（導入の対象から外す）
2. The リポジトリ shall cc-sdd の導入物（`.claude/skills/kiro-*`・`.kiro/settings/`）を gitignore の対象のまま扱い、コミットに含めない
3. When 固定版の導入を繰り返したとき, the 導入スクリプト shall 同じ結果を出す（2 回目の実行で追跡ファイルの差分を新たに作らない）

### Requirement 3: BRW の取得元（CI 用）

**Objective:** As a CI の管理者, I want BRW の取得元が常に存在する, so that deploy と preview のジョブが取得元の欠落で止まらない

#### Acceptance Criteria

1. The リポジトリ shall `.branch-release-workflow-source.json` を追跡し、取得元（HTTPS の URL）とブランチを記録する
2. When `scripts/agent/setup-brw.mjs` が引数なしで実行されたとき, the スクリプト shall 取得元のファイルを読み、指定ブランチの最新コミットを取得して clone の絶対パスを標準出力へ出す
3. If 取得元のファイルが無い、または形式が不正なとき, then the スクリプト shall 非ゼロで終了し、どのファイルのどの項目が不正かを標準エラーに出す
4. The deploy と preview のワークフロー shall `setup-brw.mjs` の出力を `BRW_PLUGIN_DIR` として後続のステップへ渡す（既存の動作を保つ）

### Requirement 4: BRW の有効化（プロジェクトの設定）

**Objective:** As a 利用者, I want BRW をプロジェクトの設定だけで有効にする, so that 端末に BRW のコピーを置かず、起動のたびに利用者の設定を書き換えない

#### Acceptance Criteria

1. The `.claude/settings.json` shall marketplace の宣言（`extraKnownMarketplaces` の `nekono-dev`、取得元は GitHub の `nekono-dev/claude-plugins`）と、プラグインの有効化（`enabledPlugins` の `branch-release-workflow@nekono-dev`）を持つ
2. The リポジトリ shall BRW の本体を端末に clone しない（CI 用の取得は CI だけが行う）
3. The SessionStart shall ユーザーの設定（`~/.claude/settings.json`・ユーザーの marketplace）を書き換えない
4. The 導入の処理 shall Codex への導入（`.agents/skills/` への symlink・clone 内の `install-codex.mjs` の呼び出し）を行わない
5. The リポジトリ shall ブランチ運用の宣言の正本（`.branch-release-workflow.json`）を 1 つだけ持つ（`.claude/` 側はその正本へのリンク）
6. When Claude のセッションが開始されたとき, the SessionStart shall プロジェクトの marketplace の登録と BRW プラグインの導入を確かめ、無いものだけを CLI で導入する（冪等。既にあるときは何もしない）
7. If `claude` コマンドが無いとき, then the SessionStart shall 導入を飛ばし、その旨を標準エラーに出して正常終了する
8. If marketplace の登録またはプラグインの導入が失敗したとき, then the SessionStart shall 失敗の内容と再試行の方法を標準エラーに出し、失敗の状態をプロジェクトの作業用ファイル（`.cache/brw-plugin-install.failed`）に記録する。SessionStart 自体は止められない（Claude Code の仕様）ため、停止は次の 11 で行う
9. If プラグインの更新（`claude plugin update`）が失敗したとき, then the SessionStart shall 失敗の内容を標準エラーに出して続行する（作業は止めない）
10. When 導入（marketplace の登録またはプラグインの導入）を行ったとき, the SessionStart shall スキルが使えない場合があること、その場合はセッションを開き直すことを標準エラーに出す
11. While 失敗の状態のファイル（cc-sdd・BRW のどちらか）があるとき, the UserPromptSubmit のフック（`install-gate.mjs`）shall 利用者のプロンプトをブロックし、再試行の方法（`scripts/agent/install-cc-sdd.sh --claude` または `node scripts/agent/ensure-brw-plugin.mjs`）を、Claude の外（通常のターミナル）で実行するよう理由として示す
12. When 導入（BRW の導入）が成功したとき, the SessionStart shall 失敗の状態のファイルを消す

### Requirement 5: Codex 向けの導入物の取り消し

**Objective:** As a 運用者, I want Codex 向けに生成されていた導入物が残らない, so that Codex の役割が `codex-mcp-subagent` の 1 箇所だけで決まる

#### Acceptance Criteria

1. The リポジトリ shall `.codex/hooks.json` を持たない（Codex の SessionStart による cc-sdd と BRW の導入をやめる）
2. The リポジトリ shall `AGENTS.md` と `.codex/agents/` を持たない
3. The 導入スクリプト shall `--codex` を受け付けず、Codex 向けのスキル（`.agents/skills/kiro-*`）と Codex 向けの子エージェント定義を生成しない
4. The `.gitignore` shall `.agents/skills/kiro-*/` と `.agents/skills/branch-release-workflow` の行を持たない
5. The リポジトリ shall `.codex/config.toml` を本 spec では変更しない（`codex-mcp-subagent` の対象）

### Requirement 6: 導入の対象外の処理

**Objective:** As a 開発者, I want セッション開始の処理の範囲が明確, so that クラウドと手元の挙動の違いを追える

#### Acceptance Criteria

1. The クラウドの初期化スクリプト shall `CLAUDE_CODE_REMOTE` が `true` のときだけ、submodule・`npm install`・`npm run codegen`・`.dev.vars` の雛形コピーを行う
2. While ローカルで実行されているとき, the 初期化スクリプト shall git の hooksPath の設定だけを行い、他の処理をしない
3. The 初期化スクリプト shall `setup-git-hooks.mjs` を呼んでよい（`npm install` の `prepare` と両方から呼ばれても、結果が同じ冪等な処理のため）
