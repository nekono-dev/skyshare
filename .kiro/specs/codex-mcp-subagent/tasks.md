# 実装計画: codex-mcp-subagent

`[x]` は、実装し確かめたもの。`[ ]` は未了のもの（2026-11-10 の再検査の時点。経緯は末尾の Implementation Notes）。試験の実行は、特記がなければ次の形で行う:
`npx vitest run -c config/test/vitest.unit.config.ts --coverage.enabled=false <ファイル>`
（P0 の分岐閾値は本 spec の対象外のため、計測を外す）。

新しい `.mjs` の先頭には `comments.md` の先頭ヘッダを付ける（目的を 1〜2 行、6 行以内、日本語。spec の参照・日付・経緯を書かない）。

既存の残骸（追跡されないファイルと、旧版の `.codex/config.toml`）は、担当する項目で上書きする。担当しない残骸は、内容を確認してから削除する。退避の控えは `/tmp/codex-residue-backup/` にあった（リポジトリの外。現在は残っていない。末尾の Implementation Notes を参照）。

- [x] 1. 基盤: 前提の確認と、純粋な部品と試験
- [x] 1.1 残骸の控えを確かめ、`ops-agent-setup` の状態を確認する
  - `/tmp/codex-residue-backup/` に、`.mcp.json`・`codex-mcp-server.mjs`・2 つの試験・`.codex/config.toml` の控えがあることを確かめる
  - `.claude/settings.json` の現在の内容を読み、`ops-agent-setup` の改訂（Codex 向けの UserPromptSubmit と SessionStart の取り消し）が済んでいるかを記録する。済んでいなければ、3.5 は着手せず、利用者に返す
  - 完了の条件: 控えの 5 ファイルが揃っていること、`ops-agent-setup` の改訂の状態を最終報告に書けること
  - _Boundary: McpRegistration, CodexProjectConfig_
  - _Requirements: 8.1, 8.3, 8.4_

- [x] 1.2 (P) 委譲の依頼の検証と起動引数を純粋な部品で作る
  - `sandbox` は `read-only` と `workspace-write` だけを受け、省略時は `workspace-write`、それ以外は拒否する
  - 依頼文が空なら拒否する。`cwd` は省略時にリポジトリの根とし、与えられたときは実在と、実体のパスがリポジトリの内側にあることを確かめる
  - 起動引数は `--ask-for-approval never`、`exec`、`--sandbox`、`--cd`、`--output-last-message`、`-` の順で並ぶ
  - 失敗の文面は、終了コード・最後のメッセージ・標準エラーの末尾（4000 文字まで）を含む
  - 完了の条件: `tests/unit/scripts/codexExecRequest.test.ts` が通り、不正な入力はプロセスを起動せずに拒否されること
  - _Boundary: CodexExecRequest_
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.8, 4.4_

- [x] 1.3 (P) 先着順の待ち列を純粋な部品で作る
  - 読み取り（`read-only`）は同時に 5 件まで、書き込み（`workspace-write`）は同時に 1 件まで。両者は別々に数える
  - 先頭が許されなければ、後ろの呼び出しは先頭を追い越さない（書き込みが待つと後ろの読み取りも待つ）
  - 列に入ってから実行を許されるまでの時間が 2 分に達した呼び出しは、列から外して `WaitLimitError` で拒否する。列の件数には上限を設けない
  - 時計（現在時刻とタイマー）は注入し、試験で偽の時計を使う。`release` は二度呼ばれても数えが狂わない
  - 完了の条件: `tests/unit/scripts/codexExecQueue.test.ts` が通り、待ち時間の上限は実行中の時間を含まないこと
  - _Boundary: CodexExecQueue_
  - _Requirements: 1.9, 1.10_

- [x] 1.4 (P) 環境の確認（codex と git の有無、リポジトリの根）を作る
  - PATH から `codex` と `git` を探し、実行できるファイルかを確かめる
  - `git -C <サーバーの場所> rev-parse --show-toplevel` でリポジトリの根を求める。得られなければ利用できないものとして扱う
  - 完了の条件: `tests/unit/scripts/codexEnvProbe.test.ts` が通り、`codex` を PATH から外すと `available: false` と不足の名前が返ること
  - _Boundary: CodexEnvProbe_
  - _Requirements: 1.2, 1.6, 7.1, 7.4_

- [x] 1.5 (P) リポジトリの信頼の判定と、利用者の入力を止める UserPromptSubmit の入口を作る
  - 候補パスは、作業ツリーの根、親のリポジトリの根（`git rev-parse --path-format=absolute --git-common-dir` の親）、それぞれの実体パス。重複は除く
  - Codex の設定（`CODEX_HOME` の下、無ければ `~/.codex`）の `[projects."<パス>"]` に `trust_level = "trusted"` があれば信頼とみなす。読み取りだけを行い、書き込まない
  - `codex` が PATH に無ければ何もしない。設定ファイルが無い場合は信頼されていない扱いで止める。解析や読み取りの例外は標準エラーに理由を出し、通す
  - 止めるときは `decision: "block"` と理由を返す。理由には、Codex で開いて信頼する手順、または `[projects."<実体のパス>"]` と `trust_level = "trusted"` を書く手順、確認後に入力し直す方法を含める
  - 完了の条件: `tests/unit/scripts/codexTrustGate.test.ts` が設計の信頼の試験 1〜8（6a・6b を含む）で通り、入口は標準入力の JSON から判定の JSON を出すこと
  - _Boundary: CodexTrustGate_
  - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 2. 中核: MCP サーバーと codex の実行
- [x] 2.1 codex の子プロセスを 1 回実行する部品を作る
  - 依頼文は標準入力に書いて閉じる。依頼文はファイルに書かない
  - 最後のメッセージは、`os.tmpdir()` の下に作る専用のディレクトリのファイルで受け、実行の後にディレクトリごと消す
  - 作業ディレクトリは検証済みの `cwd`
  - 10 分を超えたら SIGTERM を送り、5 秒の猶予の後に終わらなければ SIGKILL を送る。結果は `timeout` にする
  - 終了コード 0 は `completed`、非ゼロは `failed`（終了コード・シグナル・最後のメッセージ・標準エラーの末尾）、起動の失敗は `spawn_error`
  - 完了の条件: `tests/unit/scripts/codexExecRunner.test.ts` が偽の `codex` で通り、打ち切りの後に子プロセスが残らず、一時ディレクトリも残らないこと
  - _Depends: 1.2_
  - _Boundary: CodexExecRunner_
  - _Requirements: 1.4, 1.7, 1.8_

- [x] 2.2 MCP の JSON-RPC の入口を作る（`codex_exec` の一覧まで）
  - 改行区切りの JSON-RPC を読み、`initialize`（要求された版を返す）、`notifications/initialized`（応答しない）、`tools/list` に応答する
  - `tools/list` は、環境が利用できるときだけ `codex_exec` の定義を 1 つ返す。定義は `prompt`（必須）、`sandbox`（省略時 `workspace-write`）、`cwd`（任意）を持つ。利用できないときは空の一覧を返す
  - 未知のメソッドで `id` があれば `-32601`、JSON の解析の失敗は `-32700`。通知（`id` が無い）には応答しない
  - ログは標準エラーにだけ出し、プロンプトと結果の本文は出さない
  - 完了の条件: `tests/unit/scripts/codexMcpServer.test.ts` のうち、上の応答の項目が通り、`codex` を PATH から外すと `tools/list` が空になること
  - _Depends: 1.4_
  - _Boundary: McpStdioServer_
  - _Requirements: 1.1, 1.2, 7.1, 7.4_

- [x] 2.3 `tools/call` の結線を作る（検証・待ち列・実行・結果の返し方）
  - `tools/call` は、検証（1.2）→ 待ち列（1.3）→ 実行（2.1）の順に行い、必ず 1 つの結果を返す
  - 検証の失敗と待ち時間の上限は、プロセスを起動せずに `isError: true` を返す。非ゼロ終了と打ち切りも `isError: true` にし、最後のメッセージと標準エラーの末尾を文面に含める
  - 成功時は `isError: false` で、`content` に最後のメッセージを入れる
  - 公開されていないツールの呼び出しは、未知のツールとして `isError: true` を返す
  - 完了の条件: 偽の `codex` を使った試験で、不正な `sandbox` の呼び出しが起動せずに `isError` になり、成功・非ゼロ・打ち切りの 3 つの結果の形が設計どおりであること
  - _Depends: 1.2, 1.3, 2.1, 2.2_
  - _Boundary: McpStdioServer_
  - _Requirements: 1.5, 1.7, 1.8, 1.10, 1.4_

- [x] 3. 設定と規約の結線
- [x] 3.1 `.mcp.json` に `codex` を登録し、どこから開いても起動できることを確かめる
  - `codex` を `type: stdio`、`command: sh`、`args` に `cd "$(git rev-parse --show-toplevel)" && exec node scripts/agent/codex-mcp-server.mjs` を含む形で登録する
  - 完了の条件: `codexSetup.test.ts` の登録の項目が通り、`claude mcp list` が、リポジトリの根と下位のディレクトリの両方で `codex` を接続済みとして示すこと（個人の承認は 3.3 で行う。承認前は `Pending approval` と出るため、確認は 4.2 で行う）
  - _Depends: 2.3_
  - _Boundary: McpRegistration_
  - _Requirements: 8.1, 8.2_

- [x] 3.2 (P) `.codex/config.toml` を要件の値に書き直す
  - `model = "gpt-6-luna"`、`model_reasoning_effort = "medium"`、`approval_policy = "never"`、`sandbox_mode = "workspace-write"`、`[sandbox_workspace_write] network_access = false` の 5 つを持つ
  - `approvals_reviewer` を含まない
  - 完了の条件: `codexSetup.test.ts` の設定値の項目が通ること
  - _Boundary: CodexProjectConfig_
  - _Requirements: 8.3, 8.4_

- [x] 3.3 (P) 個人の承認を `.claude/settings.local.json` に置く
  - `enabledMcpjsonServers` に `codex` を入れる。既存のキーは保持する
  - 完了の条件: `codexSetup.test.ts` の項目で、`git check-ignore` が `.claude/settings.local.json` を無視として報告し、既存キーが残っていること
  - _Boundary: PersonalApproval_
  - _Requirements: 7.3_

- [x] 3.4 (P) CLAUDE.md に英語の委譲の規約の節を追加する
  - 見出しは「## Codex as a Child Agent (MCP)」。既存の節は変えない
  - 節は次の 9 項目を持つ: 思考を要する作業の委譲（レビューに限らない）、積極的な委譲、独立レビューの自己実施の禁止、読み取りの並列と書き込みの 1 件ずつの順序、委譲の報告と直接対応の例外、MCP 失敗時の CLI の代替と、プランの制限の判断、依頼文の書き方（sandbox を呼び出しごとに明示し、読み取り専用に固定しない）、検証、環境による扱い
  - 節は英語で書く。CLAUDE.md の全体に日本語の文字を含めない
  - `scripts/agent/install-cc-sdd.sh` が CLAUDE.md を書き換える対象に含まれないことを読んで確かめる（変更はしない）
  - 完了の条件: `codexSetup.test.ts` の節の項目（見出し、9 項目の要点、日本語の文字が無いこと）が通ること
  - _Boundary: DelegationPolicy_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.2, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 3.5 `.claude/settings.json` の UserPromptSubmit に信頼の確認を 1 件加える
  - 着手の前に、1.1 で確かめた `ops-agent-setup` の改訂が済んでいることを確かめる。済んでいなければ、着手せずに利用者に返す（同じファイルを並行で編集しない）
  - `UserPromptSubmit` に `node "$CLAUDE_PROJECT_DIR/scripts/agent/codex-trust-gate.mjs" user-prompt-submit`（timeout 10）を 1 件加える。他のフックは変えない
  - 完了の条件: `codexSetup.test.ts` の項目で、`UserPromptSubmit` に 1 件あり、既存のフックが消えていないこと
  - _Depends: 1.5, 1.1_
  - _Boundary: CodexTrustGate_
  - _Requirements: 10.1_

- [x] 4. 検証: 統合と実機の確認
- [x] 4.1 単体・統合の試験を全部通す
  - `tests/unit/scripts/` の試験（codexExecRequest・codexExecQueue・codexExecRunner・codexEnvProbe・codexMcpServer・codexSetup・codexTrustGate）を、設計の試験 1〜12 と 1〜8、統合の 1〜3、設定の 1〜7 に照らして通す
  - `npx tsc --noEmit` が、追加したファイルで型のエラーを出さないこと
  - 完了の条件: 対象の試験がすべて通り、失敗があればその出力を最終報告に書けること
  - _Depends: 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_
  - _Boundary: McpStdioServer, CodexTrustGate, DelegationPolicy, McpRegistration, CodexProjectConfig, PersonalApproval_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 7.1, 7.3, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.4, 10.5, 10.6, 10.7_

- [x] 4.2 実機で MCP と CLI の代替を確かめる
  - `claude -p` で `mcp__codex__codex_exec` を読み取り専用で呼び、結果が返ることを確かめる（`--output-format stream-json --verbose` で tool_use を見る）
  - `codex` を PATH から外して起動し、`tools/list` が空になることを確かめる
  - 代替の CLI（`codex -a never exec --sandbox read-only --cd <リポジトリ> --output-last-message <ファイル> -`）が動くことを確かめる
  - 読み取り専用の依頼で書き込みが拒否されることを確かめる（1.4・4.4）
  - 完了の条件: 各確認の結果（成功・失敗の出力）を research.md に追記し、未確認の項目（2 分の `isError` の届き方、プランの制限の文言）は未確認として残すこと
  - _Depends: 4.1_
  - _Boundary: McpStdioServer, McpRegistration_
  - _Requirements: 1.1, 1.2, 1.4, 4.4, 6.1, 6.2, 7.1, 8.2_

- [x] 4.3 実機で信頼の確認を確かめる
  - 信頼されていない `CODEX_HOME` を用意し、実際の UserPromptSubmit のフックが利用者の最初の入力を止め、理由に手順が出ることを確かめる
  - 同じ `CODEX_HOME` で信頼を書き（手で、利用者の操作を模して）、次の入力が通ることを確かめる。判定は毎回行われ、止めた状態が残らないこと
  - シンボリックリンク経由で開いた場合のキーの形を確かめ、research.md の 7a を更新する
  - 完了の条件: 止まった入力と、通った入力の記録を research.md に追記すること（第 30 節。キーの形は第 32.1 節）
  - _Depends: 4.1_
  - _Boundary: CodexTrustGate_
  - _Requirements: 10.1, 10.3, 10.4_

## Implementation Notes

- 1.1 の控え（`/tmp/codex-residue-backup/`）は、`/tmp` に置いたため 2026-11-10 の時点で残っていない。控えの用途（残骸を上書きする前の退避）は、担当の項目（3.1・3.2 ほか）が上書きとコミットを終えたため、済んでいる。1.1 のもう一方の条件（`ops-agent-setup` の改訂が済んでいること）は、コミットの順序（`ops-agent-setup` の改訂 5163f1e9 が、3.5 の e32b621a より前）と、現在の `.claude/settings.json` で確かめた。
- 退避の控えは、セッションをまたいで残らない場所（`/tmp`）に置くと、後から完了の条件を再確認できない。再確認が要る証跡は、リポジトリの中（spec の記録）に結果を書く。
- 4.1 は 2026-11-10 に再実行した（7 ファイル 149 件が通過、`npx tsc --noEmit` は終了コード 0）。
- 2026-11-10 の feature 検証（kiro-validate-impl）の判定は `MANUAL_VERIFY_REQUIRED`。残りは 4.3 のキーの形の確認（利用者の操作）。結線・設計との一致・境界に問題は無かった（research.md 第 31 節）。
- 4.3 のキーの形は、2026-11-10 に利用者の承認を得て Claude が tmux で Codex の対話画面を操作して確かめた（research.md 第 32.1 節）。codex-cli 0.167.0 は、リンク経由でも実体のパスで信頼を保存する。要件 7.4 の `sh`・`git` が無い場合も実機で確かめた（第 32.2 節）。
- 2026-11-10 の 2 回目の feature 検証（kiro-validate-impl）: 判定は `GO`。全試験（`npm run test:all`。push 前の検査として実行）は終了コード 0。起動の確認（`.mcp.json` と同じ形で MCP サーバーを起動し、`initialize` と `tools/list` に応え、`codex_exec` を公開すること）も通った。判断の項目（結線・要件の網羅 10/10・設計との一致・境界）は、Codex（`codex_exec`、読み取り専用）の独立した検証で、重大な指摘は無い。要件 6.8 のプランの制限の応答の文言は、発生時にしか観測できないため、実装の不足としない（research.md 第 32.3 節）。

## 追補（権限の制御）

- [x] 5.1 `codex_exec` のネットワーク・スクラッチ・読み取り範囲・追加拒否 glob を実装し、`read_paths_on_workspace_write`、既定の全体読み取り、限定読み取りルート、`.git` とホーム認証情報の拒否、TOML エスケープを含む単体試験を追加した。
- [ ] 5.2 指定された Codex の単体試験、型検査、変更ファイルの Prettier 検査を実行する。実機確認は親が入れ子でない環境で実施済みであり、入れ子 sandbox での確認は対象外。
