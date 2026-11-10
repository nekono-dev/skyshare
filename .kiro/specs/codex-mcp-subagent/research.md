# Gap Analysis: codex-mcp-subagent

## 注記（工程の順序）

- 本分析は、実装の後に行った。要件と設計は未承認のまま、tasks.md は未生成の状態で実装を先に進めていた。これは cc-sdd の工程（分析 → 設計 → 承認 → タスク → 実装）に反する。
- そのため本書は、要件と既存のコードのギャップを、**実装後の状態**に対して記録する。要件・設計は変更していない。
- 承認の前に生じた差分（`.mcp.json` の書き方・`.gitignore` の 1 行・`approvals_reviewer` の扱い）は、設計書の「実装の記録」と「決定」の節に記した。

## 1. 現状調査

### 既存の資産（再利用できるもの）

- `scripts/agent/` の既存モジュール（`ensure-brw-plugin.mjs`・`install-gate.mjs`・`kiro-gate.mjs`）は、`scriptDir` から `repoRoot`（`../..`）を求める同じ書き方を持つ。新しいサーバーもこれに従う。
- 外部 CLI の起動（`spawnSync`・`spawn`）と、失敗の扱い（非ゼロ終了・標準エラー）の書き方は既存のスクリプトと揃えている。
- JSON-RPC や MCP の共有ライブラリは、リポジトリに無い（`git grep` で該当は lock ファイルのみ）。新規に書くしかない。

### 既存の規約

- コメント: `.kiro/steering/comments.md`。先頭ヘッダは 6 行以内、仕様・要件・経緯・日付への参照は書かない。
- テスト: `tests/unit/scripts/` に置く（`config/test/vitest.unit.config.ts` の include に含まれる）。
- 整形: Prettier（`.mjs` は 2 スペース、`.ts` は 4 スペース、`tech.md` と `.prettierrc` による）。

### 既存の Codex 参照（対象の外にあるもの）

| 場所                                                        | 内容                                                        | 扱い                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| `docs/DEVELOP.md` 7・55・56・231 行                         | AGENTS.md・Codex の cc-sdd 導入・`npm run setup:brw` の記述 | 対象外（`develop-docs-agents` が担う）。未了 |
| `.kiro/steering/roadmap.md` Phase 8 と ops-agent-setup の行 | 旧い記述（「Codex と Claude の導入は確認済み」）            | steering の更新が必要。未了                  |
| `.agents/skills/survey-run/`                                | Codex 用の複製                                              | 対象外。残すか消すかは別途決める             |

### 本 spec の変更の前後（実装後の状態）

- 追加: `scripts/agent/codex-mcp-server.mjs`・`.mcp.json`・`.claude/settings.local.json`（追跡しない）・`tests/unit/scripts/codexMcpServer.test.ts`・`tests/unit/scripts/codexSetup.test.ts`
- 変更: `.codex/config.toml`（vpngateway-gui の値に揃えた）・`CLAUDE.md`（英語の委譲の節を追加）・`.gitignore`（`.claude/settings.local.json` の 1 行）
- 未コミット。push はしていない。

### 参照元（vpngateway-gui）

- `scripts/codex-mcp-server.mjs`: 承認の指定が `exec` の後に置かれていた（codex 0.167.0 で拒否される）。本 spec で直した。
- `.mcp.json`: `${CLAUDE_PROJECT_DIR:-.}` を使う。展開されないことを確認した（下の 3.2 を参照）。
- CLAUDE.md の「Codex as a Child Agent (MCP)」節: 本 spec の節の元になった。

## 2. 要件と資産のギャップ（Requirement-to-Asset Map）

タグ: **Missing**（資産が無い）・**Unknown**（確認が要る）・**Constraint**（既存の制約）・**Resolved**（実装と実機で解消した）

| 要件                                          | 必要な資産                      | 実装前の状態                                | タグ                                 | 現在の状態                                                            |
| --------------------------------------------- | ------------------------------- | ------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| 1.1 ツール `codex_exec` を 1 つ提供           | `codex-mcp-server.mjs`          | 無し                                        | Missing                              | Resolved（試験 + 実機）                                               |
| 1.2 `codex` が無いとツールを出さない          | `codexAvailable()`              | 無し                                        | Missing                              | Resolved（試験）                                                      |
| 1.3 承認の指定は `exec` の前                  | `buildCodexArgs()`              | 参照元は `exec` の後                        | Constraint（codex 0.167 は後を拒否） | Resolved（試験）                                                      |
| 1.4 prompt は標準入力、既定 `workspace-write` | `runCodex()`                    | 参照元にあり                                | —                                    | Resolved（試験）                                                      |
| 1.5 sandbox は 2 値だけ                       | `resolveSandbox()`              | 参照元にあり                                | —                                    | Resolved（試験）                                                      |
| 1.6 cwd はリポジトリ内だけ                    | `resolveWorkingDirectory()`     | 参照元にあり                                | —                                    | Resolved（試験）                                                      |
| 1.7 10 分で打ち切り                           | `CODEX_TIMEOUT_MS`              | 参照元にあり                                | —                                    | Resolved（試験。上限は試験で短縮できる）                              |
| 1.8 非ゼロ終了はエラー                        | `runCodex()`                    | 参照元にあり                                | —                                    | Resolved（試験）                                                      |
| 2・3・4・5 委譲の方針                         | CLAUDE.md の節                  | 無し                                        | Missing                              | Resolved（試験は項目の有無のみ）                                      |
| 6.1〜6.2 CLI の代替（read-only）              | 節 + `codex -a never exec`      | 無し                                        | Unknown（受理は未確認）              | 受理は確認（`--help`）。実行の代替は未確認                            |
| 6.3 プロンプトファイルはスクラッチパッド      | 節                              | 無し                                        | Missing                              | Resolved（規約の文）                                                  |
| 7.1 クラウドで Codex が無いときは Claude だけ | 空のツール一覧                  | 無し                                        | Unknown（クラウドで未確認）          | ローカルでは確認。クラウドは未確認                                    |
| 7.3 個人の承認は `settings.local.json`        | `.gitignore` の 1 行            | 無し                                        | Missing                              | Resolved                                                              |
| 8.1 `.mcp.json` はどこから開いても解決        | `.mcp.json` の書き方            | 無し                                        | Unknown                              | Resolved（実機: 相対パスは失敗、`git rev-parse` 形式は 3 か所で接続） |
| 8.2 パスの書き方は実機で確定                  | 同上                            | —                                           | Unknown                              | Resolved（`${CLAUDE_PROJECT_DIR}` は `mcp list` で展開されず不採用）  |
| 8.3 `config.toml` の値                        | `.codex/config.toml`            | 値が違う（network_access = true）           | Missing                              | Resolved（試験）                                                      |
| 8.4 `approvals_reviewer` の扱い               | `.codex/config.toml`            | あり（有効性未確認）                        | Unknown                              | Resolved（codex 0.167 のバイナリが認識するため残す）                  |
| 9.1〜9.4 規約は CLAUDE.md、英語               | CLAUDE.md                       | 日本語の節のみ（別作業で英語化済み）        | Missing                              | Resolved（試験）                                                      |
| 9.2 cc-sdd で CLAUDE.md が上書きされない      | `install-cc-sdd.sh` の manifest | CLAUDE.md を除外済み（ops-agent-setup 2.1） | Constraint                           | 満たしている（試験は `agentSettings`・`cc-sddInstallRecord` の系統）  |

## 3. 実装アプローチの選択肢

### 3.1 サーバーの置き場所と作り方

- **Option A: 既存のモジュールを拡張する**: 対象になる既存のモジュールが無い。`scripts/agent/` の既存スクリプトは CLI の導入・停止の判定であり、MCP とは責務が違う。**不採用**。
- **Option B: `scripts/agent/codex-mcp-server.mjs` を新規に作る（依存なし、標準の `node:` モジュールのみ）**: 既存の `scripts/agent/` の書き方に揃う。外部パッケージが要らず、クラウドで `npm install` を増やさない。**採用**（実装済み）。
- **Option C: MCP SDK（`@modelcontextprotocol/sdk`）を使う**: JSON-RPC の枠を SDK に任せられる。しかし依存が増え、版の管理が要る。1 ツールだけの機能には重い。**不採用**。
- **Option D: 参照元をそのまま取り込む**: 承認の指定が codex 0.167 で拒否されるため、動かない。**不採用**。

### 3.2 `.mcp.json` のパスの書き方

- **Option a: `${CLAUDE_PROJECT_DIR}/scripts/agent/...`**: `claude mcp list` で展開されず、接続に失敗した。**不採用**。
- **Option b: 相対パス `scripts/agent/...`**: リポジトリ直下からは接続するが、サブディレクトリからは失敗した。**不採用**（要件 8.1 を満たさない）。
- **Option c: `sh -c` で `git rev-parse --show-toplevel` へ移動してから起動**: 直下・`scripts/`・`tests/unit/scripts/` の 3 か所から接続した。**採用**。ただし `sh` と `git` が使えることが前提（クラウドは未確認）。

### 3.3 CLAUDE.md の節の作り方

- **Option X: vpngateway-gui の節を、そのまま英語で移す**: AGENTS.md の前提と、`$kiro-*` の表記が混ざる。**不採用**。
- **Option Y: 項目は揃え、skyshare の事情（`/kiro-*`、AGENTS.md が無いこと、依頼文に規則を書くこと）を足して書く**: 要件 4.5 と 9.3 を満たす。**採用**。

## 4. 工数とリスク

- **工数: S**（実装は済み。残りは検証と文書の更新）。
- **リスク: Medium**。理由:
  - クラウドで `codex` が無いときの表示（`codex` サーバーが失敗として出るかどうか）は未確認。
  - `sh` と `git` の存在が前提になった（クラウドは未確認）。
  - codex CLI の版が変わると、承認の指定が再び動かなくなるおそれがある（本 spec は 0.167.0 で確認）。
  - 委譲の規約は、モデルが守るかどうかを運用で確かめる必要がある。試験では項目の有無しか確かめられない。

## 5. 設計フェーズへの持ち越し（Research Needed）

1. クラウドで `codex` が無いときの、`codex` サーバーの表示と、Claude のセッションが止まらないこと（要件 7.1）。
2. クラウドで `sh` と `git rev-parse` が使えること（要件 8.1 の前提）。
3. `approvals_reviewer = "auto_review"` が、承認 `never` のもとで実際に影響するか（現状は残しているだけ）。
4. 依頼文の規則（AGENTS.md が無いため、Codex は CLAUDE.md を読まない）が、委譲の結果に反映されるか。
5. `.agents/skills/survey-run/`（Codex 用の複製）を残すか消すか（本 spec の対象外）。

## 6. 他の spec との整合（ギャップとして記録）

- **`ops-agent-setup` の順序**: roadmap は「`ops-agent-setup` の改訂が先。その後に `codex-mcp-subagent` を実装する」と定める。改訂のコード（`.codex/hooks.json`・AGENTS.md・`.codex/agents/` の削除）は `5163f1e9` で完了している。しかし `ops-agent-setup` の承認（requirements・design・tasks）は未了のままである。順序は満たしているが、承認の段階では満たしていない。利用者の確認が要る。
- **`docs/DEVELOP.md`**: AGENTS.md・Codex の導入・`npm run setup:brw` を記述している（4 か所）。`develop-docs-agents` の未了の作業。
- **roadmap.md の Phase 8 の状態**: `codex-mcp-subagent` の行は「未了」のまま。実装は済んでいるため、更新が要る。

## 7. コメント規約の是正（この分析で見つけた点）

- 実装の中で、仕様・要件への参照（`Requirement 1.2`・「要件 7〜9」）と、出典（「vpngateway-gui の …」）をコメントに書いていた。`comments.md` は、これらを禁止している。3 箇所を直した（`codex-mcp-server.mjs` の先頭ヘッダと `serve` のコメント、`codexSetup.test.ts` の先頭ヘッダ）。
- 直前のコミット（`5163f1e9`）の `kiro-gate.mjs` にも「（Req 1.7）」が 1 件あった。これも直した（未コミット）。
- コメント規約の試験（`commentRules.test.ts`）は、これらを検出しなかった。試験の検査の範囲が、この種の参照を含んでいないことを示す。検査の追加は別の作業として記録する。

## 8. 状態

- 承認: `requirements` と `design` は未承認。`tasks` は未生成（`spec.json`）。
- 実装: 済み（未コミット）。試験: `codexMcpServer.test.ts`（9 件）と `codexSetup.test.ts`（5 件）が通過。`kiro-gate.mjs` の回帰を含め、関連する 8 ファイル・70 件が通過。
- 実機: `claude mcp list` で接続（3 か所）、`mcp__codex__codex_exec` の `read-only` の呼び出し 1 回で `OK` を確認。

---

## 9. 動作チェックの結果（実装後、2026-11-08）

検証の一環として、実装の状態に対して次の 3 つを実機で確かめた。

| 確認                         | 方法                                                                                            | 結果                                                                                        | 要件     |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| `read-only` が書き込みを防ぐ | MCP サーバーの `runCodex` を `read-only` で呼び、リポジトリ内にファイルを作らせる               | Codex は書き込みを拒否した（「filesystem is read-only」）。ファイルは作られなかった         | 1.5・4.4 |
| 代替の CLI が動く            | `codex -a never exec --sandbox read-only --cd <リポジトリ> - < <プロンプトファイル>` を実行する | 終了コード 0。期待どおりの応答（`FALLBACK-OK`）を返した                                     | 6.1・6.2 |
| `codex` が無い環境の表示     | `codex` を PATH から外した環境（node と claude のみ）で `claude mcp list` を実行する            | サーバーは `Connected` と表示される。`tools/list` は空。Claude には `codex_exec` が見えない | 1.2・7.1 |

補足:

- 3 の表示は「Connected」のため、利用者には失敗として見えない。これは要件 7.1 の「Claude だけで完結する」と整合する。
- セッション内で `codex` が無いときに、Claude がツールの無さをどう扱うか（報告の文言）は未確認。
- 既存の未確認事項（クラウドでの `sh`・`git` の存在、承認 `never` のもとでの `approvals_reviewer` の効き）は残る。

---

## 10. 設計のディスカバリ（light）とシンセシス（kiro-spec-design、2026-11-08）

### 参照したガイダンス

- `rules/design-principles.md`・`rules/design-discovery-light.md`・`rules/design-synthesis.md`・`rules/design-review-gate.md`
- `.kiro/settings/templates/specs/design.md`・`research.md`

### 分類

- **Extension**（既存の skyshare に、`scripts/agent/`・`.codex/config.toml`・CLAUDE.md・`.gitignore` を拡張する）。light discovery を実施。
- 新規の外部ライブラリは無い（Node の標準モジュールのみ）。WebSearch は行わず、ローカルで確かめた値を根拠にした。

### 確認した拡張点と互換性

- `scripts/agent/` の既存スクリプト（`ensure-brw-plugin.mjs`・`install-gate.mjs`）と同じく、CLI の起動と `repoRoot` の求め方を揃える。
- `.mcp.json` は無し（新規）。`.codex/config.toml` は既存（`network_access` を `true` から `false` に変える。直接の codex 実行に影響する）。
- CLAUDE.md は cc-sdd の導入の対象外（`ops-agent-setup` 2.1。`install-cc-sdd.sh` の manifest で除外済み）。
- `.gitignore` に `.claude/settings.local.json` の 1 行を加える（個人の承認）。

### 依存の確認（ローカルで実施）

- codex 0.167.0: `codex -a never exec` は受理される。`codex exec --ask-for-approval` は拒否される。
- codex のバイナリは `approvals_reviewer` と `auto_review` を認識する。
- `claude mcp list`: `sh -c` と `git rev-parse --show-toplevel` の形で、直下・`scripts/`・`tests/unit/scripts/` から接続する。`${CLAUDE_PROJECT_DIR}` は展開されない。相対パスはサブディレクトリで失敗する。
- MCP の経路で `read-only` を指定すると、書き込みは拒否される（第 9 節）。

### 外部の参照元の不一致（未解決）

- vpngateway-gui の現在の規約（利用者の指示では read-only の固定が外れている版）は、確認できた範囲では `dev/multihop-backend`（`9e5b527`）にあり、read-only のまま。`main`・`origin/main`・`nekono/main` には規約が無い。今回の設計は、利用者の指示（レビューに限らず思考を要する作業全般に使う。sandbox は依頼に応じて選ぶ）を正とする。参照元が push されたら照合する。

### リスク

- クラウドで `sh`・`git`・`codex` が揃うか（未確認）。
- 並行の `codex_exec` の上限は設けていない。

### シンセシス（design-synthesis）

- **Generalization**: sandbox は役割ごとに固定せず、依頼の引数として通す。サーバーは値の検査（2 値）だけを持つ。
- **Build vs Adopt**: MCP SDK（`@modelcontextprotocol/sdk`）は採らない。依存が増え、1 ツールの機能には過大。JSON-RPC の 1 行処理は自前で持つ（参照元と同じ方式）。
- **Simplification**: 試験のための注入点（`runCodex` の `command`・`root`、`handleRequest` の `runner`）と環境変数 `SKYSHARE_CODEX_TIMEOUT_MS` は、公開契約に含めない。次の実装で、注入点を減らす候補として記録する。

### 設計判断（Design Decisions）

1. **`.mcp.json` の書き方**: `sh -c` で `git rev-parse --show-toplevel` へ移動してから起動する。理由: 3 か所から接続し、`${CLAUDE_PROJECT_DIR}` と相対パスは不採用（上の確認）。
2. **個人の承認**: `.claude/settings.local.json` を `.gitignore` に入れ、共有しない（要件 7.3）。
3. **`approvals_reviewer`**: 残す。codex 0.167.0 が認識するため。承認が `never` のため通常は効かない（要確認）。
4. **sandbox**: 依頼ごとに明示する。既定（`workspace-write`）に任せない規則は CLAUDE.md の節に置く。サーバーの値は 2 つ（`read-only`・`workspace-write`）。
5. **承認の指定の位置**: `codex --ask-for-approval never exec` の形を固定する（`exec` の後は拒否される）。

### 第 9 節の動作チェックの扱い

- 第 9 節の結果は、設計の根拠として有効。読み取り専用の固定を外した後も、サーバーの sandbox の挙動（`read-only` は書き込みを防ぐ）は変わらない。

---

## 11. 検証の結果と決定（2026-11-08、再検証の前）

### approvals_reviewer の効果（検証済み）

- 方法: 承認を `never`・sandbox を `workspace-write` にし、リポジトリの外（`/home/ubuntu/probe-approvals-reviewer.txt`）への書き込みを依頼した。`approvals_reviewer` を `auto_review` にした実行と、`user` にした実行を比べた。`--json` の出力を比較した。
- 結果: 両方の実行で、イベントの種類は同じ（`thread.started`・`turn.started`・`item.completed`（agent_message）・`turn.completed`）。承認の要求もレビューのイベントも出なかった。書き込みは sandbox で拒否され、ファイルは作られなかった（終了コードは 0。Codex が拒否を報告した）。
- 判断: 承認が `never` のもとでは、`approvals_reviewer` の効果は観測されなかった。承認の要求が発生しないため、この設定は使われない。

### 利用者の決定（2026-11-08、確認の質問への回答）

1. **並行の範囲（Critical Issue 1）**: 書き込みを伴う `codex_exec` は並行させない。読み取りだけの依頼は並行してよい。
2. **`approvals_reviewer`（Critical Issue 3）**: 効果を確かめてから決める。上の検証で効果が観測されなかったため、設定から外す（`.codex/config.toml` から削除する）。

### 再検証に向けた修正の対象

- 設計: 並行の範囲（書き込みの呼び出しは直列）、`approvals_reviewer` の削除（決定の記録も改める）、要件 9.2 の試験項目（偽の `npx` で導入の一覧に `CLAUDE.md` が無いことを確かめる）を Testing Strategy に加える。
- CLAUDE.md の委譲の節: 並行の規則に、書き込みを伴う呼び出しは並行させないことを加える（英語）。
- タスク: 3.2（並行の規則）、4.4（試験）、2.3（`approvals_reviewer` の削除）を、設計に合わせて直す。

---

## 12. 設計の再検証の決定（2026-11-08、kiro-validate-design の 2 回目）

- **書き込みの直列化（Critical Issue 1）**: サーバーで直列化する（決定）。`workspace-write` の呼び出しは、サーバーの単一の待ち行列で 1 つずつ実行する。Claude が編集している間に書き込みの `codex_exec` を走らせない運用規則を、CLAUDE.md に加える（未反映）。
- **読み取りの並行数（Critical Issue 2）**: 同時に 3 件まで（決定）。超えた呼び出しは、サーバーで待たせる（未反映）。
- **sh と git が使えない環境（Critical Issue 3）**: 利用者が違いの説明を求めた。判断は保留（未決）。
- 設計はまだ改めていない。3 点の決定を反映した再検証が必要。

### 反映（2026-11-08、kiro-spec-design の再実行）

- 上の 3 点の決定を、設計書と要件に反映した（要件 1.9・7.4 を追加。設計の Testing Strategy・Error Handling・CLAUDE.md の節も改めた）。
- 反映の判断: 読み取りの実行中に書き込みを開始しない（排他）。読み取りの同時上限は 3 件。待ち時間は 10 分の上限に含めない。
- 未反映: タスク（tasks.md）は、1.9・7.4 と設計の変更に合わせて再生成する。

---

## 13. 再検証（kiro-validate-design の 3 回目）の決定（2026-11-08）

判定は NO-GO。利用者の決定（すべて推奨案）:

1. **直列化の範囲（Critical Issue 1）**: リポジトリ単位のロックを入れる。並行する Claude セッション（サーバーがプロセスごとに分かれる場合）でも、書き込みは 1 つずつ実行する。ロックは `.cache/` 配下の排他的に作るロックファイルとする。古いロックの扱い（持ち主のプロセスが無いときの回収）は設計で定める。
2. **待ち（Critical Issue 2）**: 待ち行列の長さと待ち時間に上限を設ける。上限を超えた呼び出しは、即座に `isError` を返す。上限の具体値は設計で定め、クライアントの呼び出し時間制限との関係を Risks に書く。
3. **書き込み中の読み取り（Critical Issue 3）**: 読み取りは 3 件まで可（書き込みの実行中も止めない）。読み取りが古い状態を見る可能性は、規約と Risks で扱う。

反映の対象: 要件 1.9（ロックの範囲と、読み取りの上限の範囲）、要件 1.10 の新設（待ちの上限）、設計の Scheduling・State Management・Error Handling・Testing Strategy・Risks。

### 反映（2026-11-08、第 13 節の決定）

- 要件 1.9 を改め（リポジトリ単位のロック、1 サーバーの読み取り上限 3 件）、1.10 を追加（待ちの上限 5 件・5 分）。
- 設計の Scheduling・State Management（ロックファイル）・Error Handling・Testing Strategy・Risks・Data Models を改めた。
- 未反映: タスク（tasks.md）の再生成。

---

## 14. 再検証（kiro-validate-design の 4 回目）の決定（2026-11-08）

判定は NO-GO。利用者の決定（すべて推奨案）:

1. **ロックの範囲（Critical Issue 2）**: 作業ツリー単位（worktree ごと）。ロックファイルは各作業ツリーの `.cache/` に置く。別の worktree は別のファイルを書くため、直列化しなくても競合しない。要件 1.9 の「リポジトリ単位」は「作業ツリー単位」に改める。
2. **ロック待ち（Critical Issue 1）**: ロックが取れないときは 1 秒間隔で再試行する。待ち時間には、ロック待ちと行列待ちを合わせて含める。待ち行列の長さの上限（5 件）は、各サーバーで数える。インターフェースに `schedule` と `acquireWriteLock` を加える。
3. **待ち時間の上限（Critical Issue 3）**: 5 分から 2 分に短縮する（要件 1.10 を改める）。クライアントの呼び出し制限時間は、実機で確かめる項目に加える。

### 反映（2026-11-08、第 14 節の決定）

- 要件 1.9 の「リポジトリ単位」を「作業ツリー単位」に改めた。1.10 の待ち時間を 2 分に改め、ロック待ちと行列待ちを合わせて数えると明記した。
- 設計の Service Interface に `schedule` と `acquireWriteLock` を加え、ロックの再試行間隔（1 秒）を明記した。
- 未反映: タスク（tasks.md）の再生成。

---

## 15. 再検証（kiro-validate-design の 5 回目）の決定（2026-11-08）

判定は NO-GO。利用者の決定:

1. **待ちの上限の試験（Critical Issue 1）**: 待ち時間の上限（2 分）と行列の上限（5 件）は、関数の引数として注入する。試験は小さい値を渡して行う。環境変数による上書きは使わない。ロックの再試行の間隔（1 秒）も、同じ仕組みで注入できるようにする。
2. **進め方（Critical Issue 2 を含む）**: 設計を直して再検証する。実機の確認項目に、クライアントの呼び出し制限時間の確認（待ち 2 分の状況で、待った呼び出しが失敗しないこと）を加える。

### 反映（2026-11-08、第 15 節の決定）

- 設計の Service Interface に `SchedulerLimits` を加え、`schedule` と `acquireWriteLock` の引数で上限を注入する。環境変数による上書きは使わない。
- Testing Strategy に、スケジューラの単体試験と、2 プロセスのロック試験（サーバーを使わない）を分けて書いた。
- 実機の確認項目に、クライアントの呼び出し制限時間の確認を加えた。
- 未反映: タスク（tasks.md）の再生成。

---

## 16. 再検証（kiro-validate-design の 6 回目）の決定（2026-11-08）

判定は NO-GO。利用者の決定:

1. **読み取りが続くときの書き込み（Critical Issue 1）**: 書き込みを優先する。待機中の書き込みがある間は、新しい読み取りを開始しない。待ちの順序は先着順。
2. **古いロックの回収（Critical Issue 2 と 3）**: 改名してから取り直す。古いロックを一意の名前へ改名できたプロセスだけが回収の権利を得る。内容が空または不正なロックは、更新時刻が 15 分を過ぎたときだけ古いとみなす。

### 反映（2026-11-08、第 16 節の決定）

- 要件 1.9 に、書き込み優先・先着順・改名による古いロックの回収を加えた。
- 設計の Scheduling・ロックの節・Service Interface・Error Handling・Testing Strategy（単体 (e)、2 プロセスの回収競合）を改めた。
- 未反映: タスク（tasks.md）の再生成。

---

## 17. 再検証（kiro-validate-design の 7 回目）の決定（2026-11-08）

判定は NO-GO。利用者の決定: 書き込み優先を、プロセスをまたいで共有のマーカーファイルで保証する（推奨案）。待機中の書き込みごとに `.cache/codex-mcp.writers/` の下にファイルを 1 つ作り、読み取りは開始の前にこのディレクトリに有効なファイルがないことを確かめる。

### 反映（2026-11-08、第 17 節の決定）

- 要件 1.9 の書き込み優先を、どのサーバーの待ちでも効くと明記した。
- 設計に、待機中の書き込みのマーカー（`.cache/codex-mcp.writers/`）を加えた。共有の状態、Scheduling、Error Handling、Testing Strategy（2 プロセスの試験）を改めた。
- 未反映: タスク（tasks.md）の再生成。

---

## 18. 再検証（kiro-validate-design の 8 回目）の決定（2026-11-08）

判定は NO-GO（調整規則が多く、複雑さが要件に対して過大）。利用者の決定:

1. **複雑さ（Critical Issue 1）**: 仕組みを単純にし、運用側でカバーする。
   - 書き込みを伴う呼び出しは 1 件ずつ実行する（サーバー内の直列化のみ）。ロックは設けない。
   - 読み取りだけの呼び出しは、件数の上限を設けない（運用の想定は 3〜5 件）。
   - 前提（運用）: 1 つの作業ツリーで、全体調整役（Codex に委譲する Claude のセッション）は 1 つだけ動かす。1 つのブランチを 2 人以上で扱わない。この前提のもとで、書き込みは同じサーバーに届くため、サーバー内の直列化で競合しない。
   - 待ちの上限（待ち行列 5 件・待ち時間 2 分）は残す。
2. **読み取りと書き込みの競合（Critical Issue 2 と 3）**: 1 の決定により、待機のマーカーとロックは設けないため、この論点は解消する。
3. **書き込み優先**: 同じサーバー内で、待機中の書き込みがある間は新しい読み取りを開始しない（先着順）。前提により、全体調整役のすべての呼び出しは同じサーバーに届くため、この規則で足りる。

反映の対象: 要件 1.9（ロック・マーカー・件数上限の削除、前提の追記）、設計の全体（ロック・マーカー・改名回収・再試行間隔・共有の状態の記述を削除。Scheduling と待ちの上限を単純化。試験と Risks を改める）。

### 反映（2026-11-08、第 18 節の決定）

- 要件 1.9 を、1 件ずつの直列化・読み取りの件数制限なし・待機中の書き込みを優先・前提（全体調整役は 1 つ）に改めた。
- 設計から、ロックファイル・改名による回収・待機のマーカー・再試行の間隔を削除した。Scheduling、Limits、State Management、Error Handling、Testing Strategy、Risks を改めた。
- 未反映: タスク（tasks.md）の再生成。

---

## 19. 再検証（kiro-validate-design の 9 回目）の決定（2026-11-08）

判定は NO-GO（読み取りと書き込みの順序、待ち行列の対象が未定義）。利用者の決定: 1 本の先着順の列とする。読み取りは 5 件まで、書き込みは 1 件まで（合計 6 件の並列度）。読み取りも待ち行列の上限の対象に含める。

### 反映（2026-11-08、第 19 節の決定）

- 要件 1.9 を、1 本の先着順の列、読み取り同時 5 件・書き込み同時 1 件（合計 6 件）に改めた。
- 設計の Scheduling、Limits、Service Interface、State Management、Responsibilities、Testing Strategy、Risks、Traceability を改めた。
- 未反映: タスク（tasks.md）の再生成。

---

## 20. 再検証（kiro-validate-design の 10 回目）の決定（2026-11-08）

利用者の決定: 読み取りと書き込みは重ならないようにする。ただし、それはロックで管理せず、単一の全体調整役が運用で同時に実施しないようにする。

### 解釈（kiro-spec-design で確認した内容）

- サーバーは、種類ごとの同時実行の上限（読み取り 5・書き込み 1）と、1 本の先着順の列を強制する。読み取りと書き込みの重なりは、サーバーでは強制しない。
- 重なりを防ぐのは、全体調整役の送る順序である。書き込みの結果がすべて返ってから読み取りを送り、読み取りの結果がすべて返ってから書き込みを送る。CLI の代替もバックグラウンドで実行しない。
- 「合計 6 件」の並列度は取り下げる。両方の種類が同時に走るのは、運用の違反とする。

### 反映（2026-11-08、第 20 節の決定）

- 要件 1.9 を、重なりを運用で防ぎ、サーバーは強制しないことに改めた。要件 2.3 に、読み取りと書き込みを重ねない順序と、CLI の代替の扱いを加えた。
- 設計の Boundary、Responsibilities、Scheduling、State Management、Performance、Traceability、Components、Testing Strategy、Risks、CLAUDE.md の節（並行の規則）を改めた。

### 新たに浮上した論点（利用者の判断が要る）

- クライアントの呼び出し制限時間が、待ち 2 分と実行 10 分の合計（12 分）より短いと、結果が返る前にサーバーで Codex が続く。その場合、次の呼び出しと重なる。制限時間を延ばすか、サーバーの上限を下げるかを決める必要がある。実機の確認項目に加えた。
- 未反映: タスク（tasks.md）の再生成。

---

## 21. 再検証（kiro-validate-design の 11 回目）の決定（2026-11-08）

利用者の決定:

1. **クライアントの呼び出し時間制限**: 制約としない。Codex の応答が返るまで、全体調整役は作業を止めずに待つ。子エージェントが作業を続けることは、Claude の作業と同じ扱いとする。第 20 節で挙げた論点（待ち 2 分と実行 10 分の合計 12 分と、クライアントの制限時間の比較）は、取り下げる。
2. **読み取りと書き込みの順序**: 全体調整役は、書き込みを伴う呼び出しが完了するまで読み取りを指示せず、読み取りの呼び出しが完了するまで書き込みを開始しない。完了とは、結果（成功またはエラー）が返ることをいう。

### 反映（2026-11-08、第 21 節の決定）

- 要件 2.3 を、利用者の文言（完了まで指示しない・開始しない）に揃えた。
- 設計の Risks から、制限時間の論点を外した（解消として記録）。実機の確認項目から、制限時間の比較と、制限時間が短い場合の扱いを外した。待たされた呼び出しが `isError` で返ることの確認は残した（1.10）。
- CLAUDE.md の Delegation Rules に「結果が返るまで待つ（作業を止めない）」を加えた。並行の規則の文言を、2.3 に揃えた。
- 未反映: タスク（tasks.md）の再生成。

---

## 22. 利用者の決定（2026-11-09。タスク計画の確認の指摘への回答）

利用者の決定:

1. **待ちの数え方**: 待ちは件数に含めない。待ち行列の長さの上限（5 件）は設けない。並列数は、実施中の作業だけを数える。打ち切りは待ち時間（2 分）だけで行う。
2. **読み取りの範囲**: 全体調整役は、Codex への依頼文に読んでよいディレクトリを明記する。書き込みを伴う依頼では、書き込んでよいディレクトリも明記する。読み取りの依頼が書き込み対象のディレクトリを読む必要があるときは、そのディレクトリが進行中の作業の対象であることを依頼文に注意として書く。書き込みの実行中に読むと競合しうるため。

### 反映（2026-11-09、第 22 節の決定）

- 要件 1.9 に「並列数は実施中の作業だけを数える」を加えた。要件 1.10 を、待ち時間（先着順の列での待ちを含む）が 2 分に達したら `isError` を返す、に改めた（待ちの件数の上限を削除）。
- 要件 2.3 に、進行中のディレクトリの注意を加えた。要件 4.1 に、読んでよいディレクトリ（書き込みでは書き込んでよいディレクトリ）を加えた。
- 設計の SchedulerLimits（`waitMs` のみ）、Scheduling、Limits、Error Handling、Testing（待ち時間の試験）、Traceability（1.10・4.1）、CLAUDE.md の節の並行の規則を改めた。実機の待ち確認（4.7 相当）は、直接の stdio クライアントで行い、全体調整役を介さないとした。
- 未反映: タスク（tasks.md）の再生成（草案の 1.5・1.6・3.2・3.3・4.5・4.7・5.1 などの改訂）。

---

## 23. 利用者の決定と作業の巻き戻し（2026-11-09）

利用者の決定と指示:

1. **代替の順序**: 待ち時間の上限による `isError` のあとは、先行する書き込みの完了を待ってから、代替の CLI を実行する（要件 6.6）。
2. **CLAUDE.md の巻き戻し**: 作業を始める前の版（HEAD）に戻す。HEAD の CLAUDE.md には委譲の節が無く、日本語の文字も 0 件だった（既存の節は、ops-agent-setup の作業で英語化済み）。
3. **タスクの巻き戻し**: タスク表の全項目を未実施に戻し、設計からタスクを書き直す。実装を先に行ったため、状態が混在していた。

### 反映（2026-11-09、第 23 節の決定）

- 要件 6 に、6.6（待ち時間の上限によるエラーのときは、先行する書き込みの完了を待ってから代替の CLI を実行する）を加えた。設計の Traceability と CLAUDE.md の節に、同じ規則を書いた。
- CLAUDE.md を HEAD の版に戻した（直前の版はスクラッチパッドに退避した）。
- 作業ツリーに残る実装（`scripts/agent/codex-mcp-server.mjs`、2 つの試験、`.mcp.json`、`.codex/config.toml`、`.gitignore`、`.claude/settings.local.json`）は、削除していない。タスクでは未実施として扱い、着手時に設計と照合する。

---

## 24. 利用者の決定（2026-11-09。タスク計画の確認の指摘への回答）

利用者の決定:

1. **要件 9.5 の前提**: HEAD の CLAUDE.md は既に英語であり、既存の日本語の節は無い。9.5 は「CLAUDE.md に日本語の文を含まない」に改める。
2. **作業ツリーの実装の残骸**: 残して照合せず、タスクの着手時に作り直す。
3. **Codex の利用可否の確認（新しい要件）**: codex は常に使えるとは限らない。思考を要する作業を委譲する前に、`codex_exec` が使えるかをツールの一覧で確かめる。使えないときは原因を確かめ、プランの制限（課金・利用枠）でなければ CLI から委譲する。プランの制限のときは委譲せず、Claude だけで完結させて理由を報告する。原因が判断できないときは、CLI から試す。
4. 実機の確認の扱いは、提案どおりとする（セッション起動の観測は利用者の確認項目へ。自動で行える部分だけをタスクに残す）。

### 反映（2026-11-09、第 24 節の決定）

- 要件 6 に 6.7（利用可否の確認）と 6.8（原因に応じた CLI の使用、プランの制限の扱い）を加えた。要件 9.5 を改めた。
- 設計の Traceability（6.7・6.8・9.5）、Components（CLAUDE.md の節の対応範囲）、CLAUDE.md の節の内容、Modified Files を改めた。
- 未反映: タスク（tasks.md）の再生成。

## 25. 再設計（2026-11-09）の調査

要件の書き直しは行わず、要件書（requirements.md）だけを根拠に設計とタスクを作り直した。その前提で行った確認と、設計で決めたことを記す。旧版の調査（1〜24 節）は根拠にしていない。

### 25.1 確認した事実

- **codex CLI の起動形（codex-cli 0.167.0）**: `codex --help` と `codex exec --help` で確認した。承認の指定は `codex -a never exec ...` の形だけが受理される（`codex exec -a never` は拒否される）。`--sandbox`（`-s`）・`--cd`（`-C`）・`--output-last-message`（`-o`）・標準入力を読む `-` は `exec` の側にある。`--ask-for-approval` は `-a` の長い形。
- **最後のメッセージの取得**: `exec` は `-o <FILE>` で最後のメッセージをファイルに書く。サーバーはこれを読み、標準出力には頼らない（標準出力の形式は確認していない）。
- **プロジェクトの `.codex/config.toml` の読み込み**: `codex doctor` の出力には、読み込んだ設定の出所が出ない。`codex debug` も、設定ファイルの一覧を出す形ではない。したがって、リポジトリの `.codex/config.toml` が `--cd` の実行で効くかは未確認。実装タスクで確かめる（tasks.md の 6.4）。
- **依存**: `package.json` に MCP の SDK は無い。`scripts/agent/*.mjs` は Node の標準モジュールだけを import している。
- **既存のテストの書き方**: `tests/unit/scripts/kiroGate.test.ts` は `spawnSync` で `scripts/agent/*.mjs` を起動して検査している。`config/test/vitest.unit.config.ts` は `tests/unit/**/*.test.ts` を含む。
- **個人の承認ファイル**: `.gitignore`（HEAD）の 51 行目に `.claude/settings.local.json` がある。`git check-ignore` で無視されることを確認できる。
- **CLAUDE.md**: HEAD の版（作業ツリーも同じ）に「Codex」の文字は無く、日本語の文字も無い。委譲の節は新たに書く（要件 9.4・9.5 により英語）。
- **install-cc-sdd.sh**: CLAUDE.md は導入の対象の一覧に無く、導入のスクリプトは CLAUDE.md を書き換えない（要件 9.2 の前提）。

### 25.2 設計で決めたこと

- **MCP の実装は SDK を使わず、JSON-RPC の必要な部分（initialize・tools/list・tools/call・通知）だけを手で書く**。理由: 依存を増やさない。提供するメソッドが少ない。代替（SDK の導入）は、npm の依存と版の管理を増やすため採らない。
- **サーバーの部品を 4 つに分ける**: 引数の検証と組み立て（純粋）、待ち列（純粋。時計を注入する）、子プロセスの実行（副作用）、起動時の環境の確認。純粋な部分を分けると、要件 1.9・1.10 の待ち列の規則を、プロセスを起動せずに試験できる。
- **待ち列は先着順の 1 本の列とし、読み取りと書き込みの上限は別々に数える**（読み取り 5、書き込み 1）。読み取りと書き込みを重ねないことは運用で守る（要件 1.9）ので、サーバーは重ねを拒否しない。
- **`.mcp.json` のパスの書き方は、この段階では確定しない**。要件 8.2 により実機の確認で決める。候補は次のとおり。
  - 候補 A: `${CLAUDE_PROJECT_DIR}/scripts/agent/codex-mcp-server.mjs`（`.mcp.json` の環境変数の展開を使う）
  - 候補 B: `scripts/agent/codex-mcp-server.mjs`（相対パス。サーバーの起動時の作業ディレクトリに依存する）
  - 候補 A は、`${CLAUDE_PROJECT_DIR}` が `.mcp.json` で展開されることを実機で確かめて採る。確かめられなければ候補 B を、リポジトリの下位のディレクトリから起動しても動くことを確かめて採る。どちらも確かめられない場合は、利用者に返す。
- **個人の承認の追跡**: `.claude/settings.local.json` は HEAD の `.gitignore` で無視されるため、`.gitignore` は変えない（要件 7.3 の追跡の扱い）。
- **最後のメッセージの一時ファイル**: `os.tmpdir()` の下に作る専用のディレクトリに置き、実行の後に削除する。これは依頼文のファイルではない（要件 6.3 の「プロンプトファイル」には当たらない）。依頼文は標準入力で渡し、ファイルに書かない。
- **失敗の文面**: 終了コード、最後のメッセージ、標準エラーの末尾（4000 文字）を返す。打ち切りの場合も同じ形で、`isError` を返す。
- **CLAUDE.md の節**: 見出しは「## Codex as a Child Agent (MCP)」。要件 9.3 の項目を節の中で一つずつ持つ。

### 25.3 残った不確かさ（実装タスクで確かめる）

- `.mcp.json` のパスの書き方（25.2 の候補 A と B）。
- `.codex/config.toml` が、リポジトリで `codex exec --cd` を実行したときに効くか。効かない場合、要件 8.3 の値は次の方法で補う: サーバーが `-c` で同じ値を渡す（追加の方法は確認の結果で決める）。
- 6.8 の「プランの制限」の判定の文言。Codex の応答の文言を実機で見てから、CLAUDE.md の判断の例を書く。

---

## 26. 実機の検証と全面の書き直し（2026-11-09）

利用者の指示: (1) `.codex/config.toml` の読み込みは別の検証環境で通ることが確認されているため、そのまま進めてよい。codex はこの環境で使えるので検証してよい。(2) 要件を正として設計を全面的に書き直す。(3) 実機で検証する。第 1〜25 節の判断は根拠にしない。

環境: codex-cli 0.167.0、Claude Code 2.1.319、Node v22.16.0。検証用の一時ディレクトリは `/tmp` に作り、リポジトリには書いていない（確認のため `.claude/settings.local.json` と `.mcp.json` の一時版を `/tmp/mcp-probe` に作った）。

### 26.1 `codex exec` の起動形

| 確認                   | 方法                                                                                                          | 結果                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 承認の指定の位置       | `codex exec -a never --sandbox read-only -C . "x"`                                                            | `error: unexpected argument '-a' found`（拒否）                   |
| 承認の指定の位置（正） | `codex -a never exec --sandbox read-only --cd <repo> --output-last-message <file> -` を標準入力の依頼文で実行 | 終了コード 0。最後のメッセージのファイルに `FALLBACK-OK` が入った |

### 26.2 `.codex/config.toml` の読み込み（要件 8.3）

検証の方法: `CODEX_HOME` を一時ディレクトリに置き（`auth.json` のみ複写）、その `config.toml` の `model_reasoning_effort` を `high` にした。リポジトリの `.codex/config.toml` は `medium`。`exec` のヘッダに出る有効な値を比べた。

| 確認                                                                                       | 結果                                                                              |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 信頼されたリポジトリ（skyshare。`trust_level = "trusted"`）                                | `reasoning effort: medium`。リポジトリの値が `high` を上書きした                  |
| 信頼されていないリポジトリ（一時の git リポジトリ。`.codex/config.toml` は `low`）         | `reasoning effort: high`。リポジトリの値は無視された                              |
| `network_access`（一時の `CODEX_HOME` は `true`、リポジトリは `false`。`workspace-write`） | `curl` が `Could not resolve host`（終了コード 6）。リポジトリの `false` が効いた |

判断: 要件 8.3 の値は、信頼されたリポジトリで効く。運用の前提として設計の Open Questions 2 に書いた。

注意（検証の途中）: `codex exec` を標準入力が開いた状態で実行すると、「Reading additional input from stdin」で止まる。`</dev/null` を付けて実行する。

### 26.3 MCP サーバーの登録と接続（要件 1.1・1.2・8.1・8.2）

| 確認                                        | 方法                                                                                                                 | 結果                                                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codex_exec` の呼び出し（Claude Code から） | `claude -p ... --allowedTools mcp__codex__codex_exec --output-format stream-json --verbose`                          | `tool_use: mcp__codex__codex_exec {"prompt":"Reply with exactly: OK","sandbox":"read-only"}`。`tool_result` の本文は `[{"type":"text","text":"OK"}]`。`is_error` は付かない |
| `codex` を PATH から外す                    | node・claude・git・sh・env・bash・timeout だけを置いた PATH で起動                                                   | `claude mcp list` は `codex ... Connected`。セッションの init の `tools` に `codex` を含むものは無い（`codex_exec` は見えない）                                             |
| `.mcp.json` の形                            | 一時のリポジトリに、同じ形の 3 種類の `.mcp.json` を置いて起動先の作業ディレクトリと `CLAUDE_PROJECT_DIR` を記録した | 下表                                                                                                                                                                        |

`.mcp.json` の形の比較（`--mcp-config` で同じ文字列を渡した。`.mcp.json` の承認は、一時のリポジトリがこの Claude 環境で未信頼のため使えなかった）:

| 形                                                                             | リポジトリの根から | 下位（`sub/deep`）から                                          |
| ------------------------------------------------------------------------------ | ------------------ | --------------------------------------------------------------- |
| `sh -c "cd \"$(git rev-parse --show-toplevel)\" && exec node scripts/agent/…"` | 起動（cwd は根）   | 起動（cwd は根）                                                |
| `sh -c "node \"${CLAUDE_PROJECT_DIR}/scripts/agent/…\""`                       | 起動               | 起動しない（`CLAUDE_PROJECT_DIR` が下位のディレクトリを指した） |
| `sh -c "node scripts/agent/…"`（相対）                                         | 起動               | 起動しない                                                      |

判断: 採用は `sh -c` と `git rev-parse` の形。実際の skyshare の `.mcp.json` の `codex` は、この形で根と下位（`scripts/`・`tests/unit/scripts/`）からも承認済みの状態で `Connected` になった（`claude mcp list`）。

### 26.4 この検証で残ったこと

- 6.8 のプランの制限の文言は、実機で発生させられなかった。判断の例は規約に書かない（設計の Open Questions 1）。
- 待ち時間の上限（2 分）の `isError` が Claude Code に届く確認は、実装の後に行う（設計の実機の確認）。
- 一時のリポジトリの `.mcp.json` の承認（`enabledMcpjsonServers`）は、`claude mcp list` では反映されなかった。skyshare の `.claude/settings.local.json` は反映された。違いは、一時のリポジトリが信頼されていないことによると推定する（未確認）。
- この検証は、作業ツリーに残る旧実装の `scripts/agent/codex-mcp-server.mjs` を使った。新しい設計で作り直した後に、同じ確認を繰り返す（tasks の実機の項目）。

### 26.5 設計への反映（2026-11-09）

- 設計（design.md）を、要件を正として全面的に書き直した。第 1〜25 節の判断は引き継がない。
- 設計に「Verified Platform Facts」の節を加え、上の確認の結果を書いた。
- `.mcp.json` は `sh -c` と `git rev-parse` の形に確定した（要件 8.2 の確認済み）。
- `.codex/config.toml` は要件 8.3 の値のとおり（`approvals_reviewer` を含まない）。信頼されたリポジトリでだけ効くことを、運用の前提として書いた。
- タスク（tasks.md）は、この設計に合わせて未生成（旧版のまま）。承認後に `/kiro-spec-tasks` で作り直す。

---

## 27. リポジトリの信頼の確認（要件 10）の実機の確認（2026-11-09）

利用者の指示: リポジトリは信頼する工程を挟む。信頼されていない場合は、セッションの開始前に中断する。

### 27.1 Claude Code のフックの仕様（実機）

検証の方法: `claude -p ... --settings <一時の設定>` で、フックだけを一時的に加えた（リポジトリの設定ファイルは変えていない）。出力は `--output-format stream-json --verbose` で読んだ。

| 確認                                                           | 結果                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| UserPromptSubmit が `{"decision":"block","reason":...}` を返す | プロンプトへの応答（assistant のメッセージ）は 0 件。理由（`PROBE-BLOCK: ...`）が表示された |
| SessionStart が終了コード 2 で終わる                           | セッションは進み、プロンプトに応答した（assistant のメッセージ 1 件）                       |

判断: 要件の「セッションの開始前に中断」は、Claude Code では実現できない。停止は UserPromptSubmit で行い、セッションは開いたままにする（設計の Open Questions 6 で承認を求める）。`install-gate.mjs` の冒頭の説明（SessionStart は終了コードで止められない）とも一致する。

### 27.2 Codex の信頼の設定（実機）

- skyshare の `~/.codex/config.toml` には `[projects."/home/ubuntu/git/nekono-dev/skyshare"]` と `trust_level = "trusted"` がある（vpngateway-gui も同様）。
- 第 26 節の確認のとおり、信頼されたリポジトリでは `.codex/config.toml` が効き、信頼されていない一時のリポジトリでは無視された。

### 27.3 設計への反映

- 要件に第 10 節（信頼の確認。10.1〜10.7）を追加した。
- 設計に CodexTrustGate（`scripts/agent/codex-trust-gate.mjs`）と、`.claude/settings.json` の UserPromptSubmit への登録を加えた。
- 判定: `codex` が PATH にあり、リポジトリの実体パスの `trust_level = "trusted"` が無いときに止める。`codex` が無いとき、設定が読めないときは通す（要件 10.6・10.7）。
- 未実施: 実装後の、信頼されていない `CODEX_HOME` での実フックの確認（設計の実機の項目）。

---

## 28. 設計の検証（kiro-validate-design、2026-11-09）

判定: NO-GO。設計を直してから再検証する。

### 指摘（重大）

1. **git worktree の扱い**: Codex の信頼は作業ツリーのパス単位。`brw` は worktree を使う（CLAUDE.md）。新しい worktree では最初の入力が止まる。設計に扱いが無い（要件 10.1・10.3 の影響）。
2. **信頼のキーの形**: 設計は実体パス（realpath）だけで照合する。Codex がキーを開いた時のパスで保存する場合、シンボリックリンク経由の起動で誤判定する。保存の形は未確認（skyshare の例は実体パスと一致したのみ）。
3. **`.claude/settings.json` の共有**: このファイルは `ops-agent-setup` の改訂（フックの変更）と同じファイルを変える。順序と担当の境界が設計に無い。

### 強み

- 実機で確かめた事実を根拠にしている（第 26・27 節）。
- 純粋な部品と副作用の部品を分け、要件 1〜10 の全項目をトレーサビリティに対応させた。

### 次の一手

kiro-spec-design で 1〜3 を設計に反映し、再検証する。1 の扱いは利用者の判断が要る（worktree ごとに信頼させる／親リポジトリの信頼を見る 等）。

### 28.1 指摘への対応と再検証（2026-11-09）

- 指摘 1（worktree）: 利用者の決定により、親のリポジトリの信頼を worktree にも適用する。要件 10.2 に反映した。
- 実機の確認（worktree の根の解決）: `git rev-parse --path-format=absolute --git-common-dir` の親が親のリポジトリの根になった（一時の worktree で確認し、削除した）。
- 実機の確認（Codex が親の信頼を worktree に適用するか）: `CODEX_HOME` の設定で親（skyshare）だけを信頼し、一時の worktree（`/tmp/wt-codex`）で `codex exec` を実行した。worktree 側の `.codex/config.toml`（`model_reasoning_effort = "low"`）が効き、ヘッダは `reasoning effort: low` だった。親の信頼が worktree に適用された。worktree は削除した。
- 指摘 2（キーの形）: 候補パスを実体と非実体の両方で照合する設計に改めた。保存の形そのものは未確認のまま残し、実装後の項目に移した。
- 指摘 3（settings.json の共有）: `ops-agent-setup` の改訂を先に済ませ、並行で編集しない、という順序を設計に書いた。

判定: GO（設計の承認を条件とする）。要件 10 の承認と、設計の承認の後に tasks を作る。

## 第 29 節 実機の確認（タスク 4.2）

2026-11-09、この環境の codex-cli と Claude Code で、実際の CLI を使って確かめた。依頼は読み取り専用（`read-only`）だけを使い、作業ツリーに書き込む依頼は行っていない。

| 確認                                              | 実行した形                                                                                                              | 観測した結果                                                                                                                                  | 判定 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| A. Claude Code から `codex_exec` を呼ぶ           | `claude -p ... --output-format stream-json --verbose --allowedTools 'mcp__codex__codex_exec'`（sandbox は `read-only`） | `mcp__codex__codex_exec` の呼び出しが発生し、結果は `OK`、`is_error: false`                                                                   | 合格 |
| B. codex が PATH に無いとき、ツールが公開されない | `codex` を含まない一時の PATH（`claude.exe`・`node`・`git`・`sh`・`env` のみ）で `claude -p` を実行                     | MCP サーバー `codex` は `connected` のまま。起動時の一覧と実行の出力のどちらにも `mcp__codex__codex_exec` は現れない                          | 合格 |
| C. CLI の代替（読み取り専用）                     | `codex -a never exec --sandbox read-only --cd <リポジトリ> --output-last-message <file> - < <prompt>`                   | 終了コード 0、最後のメッセージ `OK`、ログに `sandbox: read-only`                                                                              | 合格 |
| D. 読み取り専用で書き込みが拒否される             | 同じ CLI で、リポジトリの根に `codex-readonly-probe.txt` を作るよう依頼                                                 | Codex は「書き込めない（読み取り専用）」と報告。ファイルは作られていない                                                                      | 合格 |
| E. 不正な `sandbox` が MCP 層で拒否される         | `claude -p` で `sandbox: danger-full-access` を指定                                                                     | `is_error: true`、文面は `sandbox は read-only か workspace-write で指定してください`。Codex は起動していない（`codex-exec-*` の残りは 0 件） | 合格 |

未確認の項目（実機で発生させていない）:

- 待ち時間の上限（2 分）の `isError` が Claude Code に届くこと（要件 1.10）。待ちを作る並行の書き込みが要るため、今回は行っていない。
- プランの制限の応答の文言（要件 6.8）。発生させていないため、規約には判断の仕方だけを書いた。

補足: 偽の codex を使う単体の試験と、この実機の確認は別のものである。B は、codex を PATH から外した状態で、サーバーが接続されたままツールを公開しないことを、Claude Code の実際の起動で確かめた。

## 第 30 節 実機の信頼の確認（タスク 4.3）

2026-11-09、実際の UserPromptSubmit フック（`.claude/settings.json` の `codex-trust-gate.mjs`）を、`CODEX_HOME` を一時の設定に向けた `claude -p` で動かして確かめた。Codex の本来の設定（`~/.codex`）は変更していない。

| 確認                   | 設定                                                                                                         | 観測した結果                                                                                                              | 判定                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 未信頼で入力が止まる   | `CODEX_HOME` の `config.toml` に skyshare の信頼が無い                                                       | アシスタントの応答 0 件。理由に「信頼されていないため、利用者の入力を止めています」と、信頼の手順と「もう一度入力」が出る | 合格（10.1・10.3）                              |
| 信頼後に次の入力が通る | 同じ `CODEX_HOME` に `[projects."/home/ubuntu/git/nekono-dev/skyshare"]` と `trust_level = "trusted"` を書く | 入力が通り、結果は `OK`                                                                                                   | 合格（10.4。止めた状態は残らない）              |
| 設定ファイルが無い     | `CODEX_HOME` に `config.toml` が無い                                                                         | 入力は止まり、理由は未信頼と同じ                                                                                          | 設計どおり（10.2 の既定。Codex の既定は未信頼） |

未確認の項目:

- シンボリックリンク経由で開いたときの信頼のキーの形（Open Questions 7a）。Codex が信頼を書くのは対話の操作だけで、この環境では自動で再現できない。判定は作業ツリーの実体と非実体の両方で照合する設計なので、どちらの形で保存されていても判定できる。キーの形そのものは、利用者が対話で信頼したときに確かめる。

補足: 「設定ファイルが無い利用者は毎回止まる」点は、Codex の既定（未信頼）に合わせた設計の結果である。Codex を入れた利用者が、この repo を一度も信頼していなければ止まるのは要件 10.3 の意図どおりであり、信頼の手順が理由に出る。

## 第 31 節 再検査と feature 検証（2026-11-10）

実装の途中で止まったかどうかを確かめるため、タスクごとの再検査と、feature 単位の検証（kiro-validate-impl）を行った。独立の確認は Codex（`codex_exec`、読み取り専用）に依頼した。

### 31.1 経緯の確認

- 本書に記録された NO-GO は、すべて設計の検証（kiro-validate-design。第 13〜19 節と第 28 節）のもの。第 28.1 節で GO になり、その後に実装した。実装の段階の NO-GO（kiro-validate-impl）の記録は無い。
- 実装のコミットは 1.2 から 4.3 まで続いている。止まっていたのは、最後の feature 検証と、tasks.md の親項目のチェック、冒頭の説明の更新。

### 31.2 待ち時間の上限（要件 1.10）の確認

第 29 節で未確認だった項目を、実際の時間で確かめた。実物の `scripts/agent/codex-mcp-server.mjs` を標準入出力でつなぎ、PATH の先頭に偽の `codex`（140 秒かかり、最後のメッセージを書いて終了コード 0）を置いた。`workspace-write` の `tools/call` を 2 件、1 秒あけて送った。

| 観測                | 結果                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2 件目（列で待つ）  | 送ってから 120 秒後（開始から 121.0 秒）に `isError: true`、文面は「待ち時間が上限（120000 ミリ秒）に達したため、実行しませんでした」 |
| 1 件目（実行中）    | 140.0 秒で `isError: false`、最後のメッセージが返る。待ち時間の上限は、実行中の時間に影響しない                                       |
| 偽の `codex` の起動 | 1 回だけ（2 件目は起動していない）                                                                                                    |

Claude Code に `isError` が届くことは、第 29 節の E（不正な `sandbox` が `is_error: true` で届く）で確かめてある。2 つを合わせて、要件 1.10 は充足とみなす。Claude Code を通して 2 分待たせる確認は、行っていない。

### 31.3 feature 検証の結果

- 試験: `tests/unit/scripts/codex*.test.ts` の 7 ファイル 149 件が通過。`npx tsc --noEmit` は終了コード 0。
- 結線（request → queue → runner → server、trust-gate と `.claude/settings.json`）: 食い違い無し。
- 設計との一致と境界: 重大な食い違い無し。実装の 6 ファイルに TODO の類と、秘密の直書きは無い。
- 判定: `MANUAL_VERIFY_REQUIRED`。理由は下の 31.4。

### 31.4 残っている確認（利用者の操作が要る）

1. **シンボリックリンク経由のキーの形（タスク 4.3、Open Questions 7a）**: リポジトリへのシンボリックリンクを作り、そのパスから Codex を対話で開いて信頼する。`~/.codex/config.toml` の `[projects."<パス>"]` が、リンクのパスか実体のパスかを見る。同じパスから Claude Code を開き、入力が止まらないことを確かめる。判定は実体と非実体の両方で照合するため、どちらの形でも通る見込み。
2. **プランの制限の応答の文言（要件 6.8）**: 発生させていない。規約には判断の仕方だけを書いてある（タスク 4.2 が未確認のまま残すと定めた項目）。
3. **`sh` または `git` が無い環境での起動（要件 7.4）**: `codex` が無い場合は実機で確かめた（第 29 節の B）。`sh`・`git` が無い場合は、単体の試験だけで確かめている。

## 第 32 節 残っていた実機の確認（2026-11-10）

第 31.4 節の 1 と 3 を、利用者の承認を得て Claude が行った。対話の画面は tmux で操作した。Codex の本来の設定（`~/.codex/config.toml`）は、作業の前に控えを取り、確認の後に控えと一致する状態へ戻した（追加された 1 項目だけを消した）。

### 32.1 シンボリックリンク経由のキーの形（タスク 4.3、Open Questions 7a）

| 確認                                                             | 実行した形                                                                                                                               | 観測した結果                                                                                                                                                      | 判定                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A. 信頼済みのリポジトリを、リンクのパスから Codex で開く         | skyshare へのシンボリックリンクを作り、そのパスへ `cd` して `codex` を対話で起動                                                         | 信頼の確認は出ない。画面の作業フォルダは実体のパス（`~/git/nekono-dev/skyshare`）。`config.toml` は変わらない                                                     | 実体のパスで照合する |
| B. 未信頼のリポジトリを、リンクのパスから Codex で開いて信頼する | 試験用の git リポジトリ（`real-repo`）とそのリンク（`link-repo`）を作り、リンクのパスから `codex` を起動して「Trust and continue」を選ぶ | 確認の画面に出るパスは実体（`.../real-repo`）。`config.toml` に `[projects."<実体のパス>"]` と `trust_level = "trusted"` が加わる。リンクのパスのキーは書かれない | キーは実体のパス     |
| C. リンクのパスから Claude Code を開く                           | skyshare へのリンクのパスで `claude -p "OK とだけ答えて" --output-format stream-json --verbose`                                          | 終了コード 0、結果は `OK`。入力は止まらない。`init` の `cwd` は実体のパス。MCP サーバー `codex` は `connected`                                                    | 合格（10.1・10.4）   |

結論: codex-cli 0.167.0 は、シンボリックリンク経由で開いても、信頼のキーを実体のパスで保存し、照合も実体のパスで行う。信頼の確認（CodexTrustGate）は実体と非実体の両方で照合するため、この形で判定できる。Open Questions 7a は解消した。

### 32.2 `sh` または `git` が無いときの起動（要件 7.4）

`.mcp.json` と同じ起動の形を `--strict-mcp-config --mcp-config <一時の設定>` で渡し、MCP サーバーの環境だけを変えて `claude -p "OK とだけ答えて"` を実行した（プロジェクトのフックは通常の PATH で動く）。

| 確認         | 設定                                                                      | 観測した結果                                                                                        | 判定 |
| ------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---- |
| `git` が無い | サーバーの `PATH` を、`node`・`codex`・`sh`・`env` だけの一時の場所にする | サーバーは `connected`。`mcp__codex__codex_exec` は出現しない。終了コード 0、結果は `OK`            | 合格 |
| `sh` が無い  | サーバーの `command` を、存在しないパス（`/nonexistent/sh`）にする        | サーバーは `failed`。`mcp__codex__codex_exec` は出現しない。終了コード 0、結果は `OK`（作業は続く） | 合格 |

### 32.3 残っている未確認

- **プランの制限の応答の文言（要件 6.8）**: 発生させていない。規約（CLAUDE.md の 6 項）は、文言に頼らず「応答に利用枠・課金の制限とあるか」で判断すると定めているため、実装の不足ではない。発生したときに、応答の文言を本書に追記する。
