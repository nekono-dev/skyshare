# Implementation Plan

- [x] 1. 導入の入口を 1 つにそろえる
- [x] 1.1 cc-sdd の導入スクリプトを追加する
  - `scripts/agent/install-cc-sdd.sh` を作る。引数 `--claude`（`--claude-skills`）または `--codex`（`--codex-skills`）を受け、`npx --yes cc-sdd@3.1.0 --yes --lang ja` を実行する
  - 引数が不正なとき、使い方を標準エラーに出して非ゼロで終了する
  - 完了の確かめ方: `scripts/agent/install-cc-sdd.sh --claude` を実行し、固定版の導入後に追跡ファイルの差分が出ないこと
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.2 SessionStart の設定を導入スクリプトの呼び出しに置き換える
  - `.claude/settings.json` の `npx cc-sdd@latest` を `scripts/agent/install-cc-sdd.sh --claude` へ、`.codex/hooks.json` を `--codex` へ置き換える
  - 版の文字列は設定ファイルに書かない（スクリプトの 1 箇所だけ）
  - 完了の確かめ方: 両方の設定で `cc-sdd@` の文字列が 1 箇所（スクリプト）だけになること
  - _Requirements: 1.1, 1.2_

- [x] 1.3 導入の結果をコミットに含める（追跡ファイルの差分を 0 にする）
  - 固定版で導入した `.kiro/settings/`・`CLAUDE.md` の差分をそのまま受け入れ、コミットに含める
  - 完了の確かめ方: `git status` で `.kiro/settings/` と `CLAUDE.md` が変更なしであること（導入を 2 回実行しても差分が出ないこと）
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. BRW の正本と取得元を復元する
- [x] 2.1 取得元の設定を復元する
  - `.branch-release-workflow-source.json` を `0ffaa17^` の版（`repository`・`branch: main`）から復元して追跡する
  - 完了の確かめ方: `node scripts/setup-brw.mjs` が clone の絶対パスを出すこと（ネットワークが無い場合は、取得元の検査部分だけを単体で確かめる）
  - _Requirements: 3.1, 3.2_

- [x] 2.2 取得元の欠落時の文言を改める
  - `setup-brw.mjs` で、ファイルが無いとき「ファイルが無い」と分かる文言で失敗させる（既存の検査は維持）
  - _Requirements: 3.3_

- [x] 2.3 ブランチ宣言の正本をルートに置き、旧パスをリンクにする
  - `0ffaa17^` の `.branch-release-workflow.json` を復元する（BRW の現行の文書が示す正本）
  - `.claude/branch-release-workflow.json` を正本へのシンボリックリンク（`../.branch-release-workflow.json`）に置き換える
  - 完了の確かめ方: 両方のパスの内容が一致し、`.claude/` 側が通常ファイルでないこと
  - _Requirements: 4.4_

- [x] 3. クラウドの初期化と BRW の配布を確かめる
- [x] 3.1 クラウドの初期化の範囲を確かめる
  - `.claude/hooks/session-start.sh` が `CLAUDE_CODE_REMOTE` の判定の後に処理を分けていることを確かめる。`setup-git-hooks.mjs` は冪等のため、`prepare` と SessionStart の両方からの呼び出しは残す（結果が変わらないことを確かめる）
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 3.2 Claude と Codex の BRW の経路を文書化の対象として確定する
  - Claude はプラグイン（`enabledPlugins`）、Codex は `npm run setup:brw`、CI は `setup-brw.mjs` の出力（`BRW_PLUGIN_DIR`）と決める。内容の複製を持たない
  - 完了の確かめ方: 3 つの経路の記述が `develop-docs` の章に対応すること（確定の記録は design の Risks の項に残す）
  - _Requirements: 4.1, 4.2, 4.3_

## 改訂タスク（2026-10-31: BRW の導入の入口を 1 つにする）

- [x] 4. BRW の導入を 1 つの入口にする
- [x] 4.1 `setup-brw.mjs` に `--install` を追加する
  - clone の後に Codex の導入（`clone/scripts/install-codex.mjs --skills-dir <root>/.agents/skills`）を行う
  - `claude` コマンドがあるときだけ Claude の導入を行う（marketplace の remove → add（ユーザースコープ）→ `plugin install branch-release-workflow@nekono-dev --scope project --yes`）。無ければ飛ばして標準エラーに出す
  - 完了の確かめ方: Codex の導入（`.agents/skills/branch-release-workflow` が clone を指す）をこの環境で確認する。Claude の部分は実機で確認する（design の「検証の制約」）
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [x] 4.2 `package.json` の `setup:brw` を `--install` に替える
  - 完了の確かめ方: `npm run setup:brw` が clone と Codex の導入を行い、終了コード 0 で終わる
  - _Requirements: 4.1_

- [x] 4.3 `.claude/settings.json` から marketplace の取得元を外す
  - `extraKnownMarketplaces` を削除し、`enabledPlugins` は残す。SessionStart に `node scripts/agent/setup-brw.mjs --install` を加える（cc-sdd の導入の後）
  - 完了の確かめ方: `git status` で `.claude/settings.json` に BRW 以外の差分が無いこと
  - _Requirements: 4.4, 4.6, 5.2_

- [x] 4.4 `.codex/hooks.json` の SessionStart にも BRW の導入を加える
  - 完了の確かめ方: 両方の SessionStart が同じ導入の入口（`scripts/agent/setup-brw.mjs --install`）を呼ぶこと
  - _Requirements: 4.6_

- [x] 4.5 ローカルでも BRW の導入を行う（方針の変更）
  - 導入の呼び出しは SessionStart の設定（4.3・4.4）から直接行うため、`session-start.sh` は変更しない。ローカルでも SessionStart で導入が走る
  - _Requirements: 5.2_

- [x] 4.6 ドキュメント化の対象を確定する
  - DEVELOP.md の「準備」「BRW」の章に、`npm run setup:brw` と、同名 marketplace の確認手順を書くことを develop-docs へ渡す
  - _Requirements: 4.1, 4.3_

- [x] 5. BRW の受け渡しと正本の確認（2026-10-31: 検証で不足していた要件をタスクに対応づけた）
- [x] 5.1 deploy と preview が BRW の取得結果を後続のステップへ渡すことを確かめる
  - `deploy.yaml`・`preview.yaml` の `Fetch branch-release-workflow` が `node scripts/agent/setup-brw.mjs` の出力を `BRW_PLUGIN_DIR` として `$GITHUB_ENV` に書くこと、後続のステップ（`render-deploy-config.mjs`）がそれを使うことを確かめる
  - 完了の確かめ方: `grep -n "BRW_PLUGIN_DIR" .github/workflows/deploy.yaml .github/workflows/preview.yaml` の結果が上の形であること（2026-10-31 に確認済み）
  - _Requirements: 3.4_

- [x] 5.2 ブランチ運用の宣言の正本が 1 つだけであることを確かめる
  - `.branch-release-workflow.json` が実体、`.claude/branch-release-workflow.json` がそれへのシンボリックリンクであること（`ls -l` で `->` を確認し、`cmp` で内容一致を確かめる）
  - 完了の確かめ方: `test -L .claude/branch-release-workflow.json` が真で、リンク先が `../.branch-release-workflow.json` であること（2026-10-31 に確認済み）
  - _Requirements: 4.7_
