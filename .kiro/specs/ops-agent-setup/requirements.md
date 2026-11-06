# Requirements Document

## Introduction

エージェント（Claude Code・Codex）の導入の仕組みを 1 つにそろえる。cc-sdd の導入は 1 つのスクリプトが行い、版を 3.1.0 に固定する。BRW（branch-release-workflow）の取得元を復元し、Claude と Codex の BRW の配布をそれぞれ 1 つの経路にする。

## Boundary Context (Optional)

- **In scope**: SessionStart の設定、cc-sdd の導入スクリプトと版、BRW の取得元と Codex への導入、`.claude/branch-release-workflow.json` の扱い。
- **Out of scope**: cc-sdd 本体・BRW スキルの中身、kiro スキルの内容、wrangler と秘密の処理、`scripts/` の配置。
- **Adjacent expectations**: `ops-config-secrets`（秘密と設定）、`ops-tooling-layout`（配置の移動）、`develop-docs`（導入の手順の記述）。

## Requirements

### Requirement 1: cc-sdd の導入の入口

**Objective:** As a 運用者, I want cc-sdd の導入を 1 つの入口で行う, so that Claude と Codex で導入の内容が食い違わない

#### Acceptance Criteria

1. When Claude Code のセッションが開始されたとき, the エージェントの設定 shall cc-sdd の導入を、共有の導入スクリプトの 1 回の呼び出しで行う
2. When Codex のセッションが開始されたとき, the エージェントの設定 shall 同じ導入スクリプトを Codex 向けの引数で呼び出す
3. The 導入スクリプト shall cc-sdd の版を 3.1.0 に固定して実行する
4. The 導入スクリプト shall 言語の指定（`--lang ja`）と導入先（Claude 用・Codex 用）を引数で受け取る
5. If 導入スクリプトが失敗したとき, then the 導入スクリプト shall 非ゼロで終了し、失敗の内容を標準エラーに出す

### Requirement 2: cc-sdd の導入物の差分

**Objective:** As a 開発者, I want セッション開始で追跡ファイルが変わらない, so that 導入の差分がコミットに混ざらない

#### Acceptance Criteria

1. When 固定版の導入物がコミット済みのとき, the 導入スクリプト shall 追跡ファイル（`.kiro/settings/`・`CLAUDE.md`）を変更しない
2. The リポジトリ shall 固定版の導入の結果（`.kiro/settings/`・`CLAUDE.md`）をコミットに含める
3. The 導入スクリプト shall 導入の結果として生成されるスキル（`.claude/skills/kiro-*`・`.agents/skills/kiro-*`）を gitignore の対象のまま扱う

### Requirement 3: BRW の取得元

**Objective:** As a CI の管理者, I want BRW の取得元が常に存在する, so that deploy と preview のジョブが取得元の欠落で止まらない

#### Acceptance Criteria

1. The リポジトリ shall `.branch-release-workflow-source.json` を追跡し、取得元（HTTPS の URL）とブランチを記録する
2. When `scripts/setup-brw.mjs` が実行されたとき, the スクリプト shall 取得元のファイルを読み、指定ブランチの最新コミットを取得して clone の絶対パスを標準出力へ出す
3. If 取得元のファイルが無い、または形式が不正なとき, then the スクリプト shall 非ゼロで終了し、どのファイルのどの項目が不正かを標準エラーに出す
4. The deploy と preview のワークフロー shall `setup-brw.mjs` の出力を `BRW_PLUGIN_DIR` として後続のステップへ渡す（既存の動作を保つ）

### Requirement 4: BRW の導入の入口（Claude と Codex で同じ方式）

**Objective:** As a 運用者, I want Claude と Codex の BRW を同じ入口・同じ commit から導入する, so that 両方のエージェントで同じ版のブランチ運用が動く

#### Acceptance Criteria

1. When `npm run setup:brw` が実行されたとき, the 導入スクリプト shall 取得元の固定ブランチの最新 commit を clone し、その clone から Claude と Codex の両方を導入する
2. The 導入スクリプト shall Codex の導入を clone 内の `scripts/install-codex.mjs` に任せ、導入先を `.agents/skills/`（gitignore 対象）とする
3. The 導入スクリプト shall Claude の導入を、clone をユーザースコープのマーケットプレイスとして登録し、`branch-release-workflow@nekono-dev` をプロジェクトのスコープで有効にする
4. The `.claude/settings.json` shall BRW のマーケットプレイスの取得元（`extraKnownMarketplaces`）を持たない。プラグインの有効化（`enabledPlugins`）だけを宣言する
5. If `claude` コマンドが無いとき, then the 導入スクリプト shall Claude の導入を飛ばし、その旨を標準エラーに出して Codex の導入を続ける
6. When Claude または Codex のセッションが開始されたとき, the SessionStart shall 導入スクリプトを呼ぶ（cc-sdd の導入と同じ入口）
7. The リポジトリ shall ブランチ運用の宣言の正本（`.branch-release-workflow.json`）を 1 つだけ持つ（`.claude/` 側はその正本へのリンク）

### Requirement 5: 導入の対象外の処理

**Objective:** As a 開発者, I want セッション開始の処理の範囲が明確, so that クラウドと手元の挙動の違いを追える

#### Acceptance Criteria

1. The クラウドの初期化スクリプト shall `CLAUDE_CODE_REMOTE` が `true` のときだけ、submodule・`npm install`・`npm run codegen`・`.dev.vars` の雛形コピーを行う
2. While ローカルで実行されているとき, the 初期化スクリプト shall git の hooksPath の設定と BRW の導入（要件 4）だけを行い、他の処理をしない
3. The 初期化スクリプト shall `setup-git-hooks.mjs` を呼んでよい（`npm install` の `prepare` と両方から呼ばれても、結果が同じ冪等な処理のため）
