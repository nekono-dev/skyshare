# Brief: codex-mcp-subagent

## Problem

Claude が大きなタスクを進めるとき、レビューや別視点の検討は Claude 自身だけで行っている。Codex（別の AI の CLI）を、Claude が呼び出せる子エージェントとして使う仕組みが無い。現状の Codex は cc-sdd の Codex 導入（`.agents/skills/kiro-*`・`.codex/agents/`・`AGENTS.md`）としてだけ使われ、Claude の作業の流れに入っていない。

## Current State

- Codex は cc-sdd の導入物としてのみ存在する。Claude からは呼ばれない。取り消しは既存 spec `ops-agent-setup` の改訂で行う（本 spec の対象外）。
- vpngateway-gui には、Codex を MCP サーバー（`codex_exec` ツール）として Claude に見せる仕組みがある（[scripts/codex-mcp-server.mjs](../../../../vpngateway-gui/scripts/codex-mcp-server.mjs)・`.mcp.json`・`.codex/config.toml`・CLAUDE.md の Codex 節）。
- ただし元のサーバーは `codex exec --ask-for-approval never` を呼んでいる。codex 0.167.0 では `codex exec` がこのオプションを受け付けず、呼び出しが毎回失敗する（2026-11-08 に確認）。
- skyshare には `.mcp.json` が無い。`.claude/settings.local.json` は追跡されていない（個人の設定）。
- vpngateway-gui の最新の状況（2026-11-08 再確認。未コミットの変更を含む）:
  - サーバーは `--ask-for-approval never` を `exec` の**前**に置くよう直された。codex 0.167.0 で `codex --ask-for-approval never exec --help` が受理されることを確認した。
  - `.mcp.json` の `${CLAUDE_PROJECT_DIR:-.}` は変わらず。展開の確認は未了。
  - CLAUDE.md に「Delegation rules (mandatory)」節が加わった: 複数ファイルの読み取り・独立レビュー・並列作業は、先に `codex_exec` へ委譲する。レビューを Claude 自身の結論にしない。委譲の有無を報告する。`codex_exec` が失敗したときは `codex -a never exec --sandbox read-only --cd <リポジトリ> - < <プロンプトファイル>` で代替してよい（代替を報告する）。プロンプトファイルはスクラッチパッドに置く。

## Desired Outcome

- Claude が作業中に、必要なとき Codex を `codex_exec` の子エージェントとして積極的に使う。用途は、独立したレビュー、範囲の決まった実装、広い範囲の探索、並列の作業。
- MCP が使えない環境（クラウドセッションなど）では、`codex_exec` が Claude に見えないため、Claude だけで従来どおり完結する。
- 方針（いつ・どう Codex に任せるか、任せない作業）は CLAUDE.md に書く。cc-sdd が毎回上書きする kiro-* スキルには書かない。
- Codex の出力は未検証とみなし、Claude が差分と検査で確かめてから完了を報告する。

## Approach

vpngateway-gui の MCP 方式を取り込み、次の 3 点を直して使う。

1. **サーバーの直し**: 承認の指定を `-c approval_policy="never"` にする（`--ask-for-approval` は使わない）。サーバーは `scripts/agent/codex-mcp-server.mjs` に置く（`kiro-gate.mjs` と同じ場所）。`codex --version` が失敗する環境では、ツールを 1 つも返さない。これにより、クラウドでは Claude だけになる。
2. **登録**: `.mcp.json` に `codex` サーバーを登録する。パスの書き方は、`${CLAUDE_PROJECT_DIR:-.}` の既定値の展開を実機で確かめてから決める（未確認のため既定値の形は使わない）。個人の承認は `.claude/settings.local.json` の `enabledMcpjsonServers` で行う。
3. **設定と方針**: `.codex/config.toml` は vpngateway-gui の値（model `gpt-6-luna`・reasoning `medium`・`network_access = false`・approval `never`・sandbox `workspace-write`）を取り込む。CLAUDE.md に「Codex as a Child Agent (MCP)」節を置く。

AGENTS.md は作らない（ops-agent-setup で削除する）。Codex に渡す規則は、毎回のプロンプトに書く。

## Scope

- **In**:
  - MCP サーバー（`scripts/agent/codex-mcp-server.mjs`）と、`codex_exec` の引数（`prompt`・`cwd`・`sandbox`）
  - `.mcp.json` の `codex` 登録と、個人の承認（`.claude/settings.local.json`）
  - `.codex/config.toml` の取り込み
  - CLAUDE.md の方針節（いつ委任するか・委任しない作業・プロンプトの書き方・出力の検証）
  - MCP が使えない環境での扱い（ツールを出さない）
  - 動作の確認（サーバーの起動、`codex_exec` の 1 回の呼び出し、承認が効くこと）
- **Out**:
  - cc-sdd の Codex 導入の取り消し、BRW の Codex 側の取り消し、AGENTS.md・`.codex/agents/`・`.codex/hooks.json` の削除（`ops-agent-setup` の改訂）
  - kiro-* スキルの中身（cc-sdd の生成物のため書き換えない）
  - Codex のモデルの性能評価、料金の管理
  - `docs/DEVELOP.md` の文章（完了後に直接の作業として直す）

## Boundary Candidates

- MCP サーバー（プロセスと、ツールの一覧・呼び出し）
- MCP の登録と承認（`.mcp.json`・`.claude/settings.local.json`）
- Codex の設定（`.codex/config.toml`）
- 方針（CLAUDE.md の節）
- クラウドでの扱い（ツールが見えない場合の動き）

## Out of Boundary

- cc-sdd の導入（`scripts/agent/install-cc-sdd.sh`・SessionStart の設定）。`ops-agent-setup` が持つ。
- BRW の導入と配布。`ops-agent-setup` が持つ。

## Upstream / Downstream

- **Upstream**: `ops-agent-setup`（改訂の完了が先。`.codex/hooks.json` と AGENTS.md が残っていると、Codex の役割が二重になる）
- **Downstream**: 今後の `kiro-impl`・`kiro-review` の運用（Claude の手順として Codex を使う。skill は変えない）

## Existing Spec Touchpoints

- **Extends**: なし（新規）。ただし `ops-agent-setup` の改訂と順序が結びつく。
- **Adjacent**: `ops-agent-setup`（SessionStart・cc-sdd・BRW）。両方の変更を同じ作業の中で混ぜないこと。

## Constraints

- Codex は既定で `workspace-write`・承認 `never`（vpngateway-gui と同じ）。Codex にコミット・push・ブランチ操作・spec の承認状態の変更を任せない（CLAUDE.md の規則）。
- Codex の子プロセスは 10 分で打ち切る（vpngateway-gui の値）。
- `codex exec` は `--ask-for-approval` を受け付けない（codex 0.167.0 で確認）。承認の渡し方は 2 つあり、どちらも codex 0.167.0 で受理される（確認済み）: (a) `codex --ask-for-approval never exec ...`（最上位のオプションを `exec` の前に置く。vpngateway-gui の最新の方式）、(b) `codex exec -c approval_policy="never" ...`。
- 決定（2026-11-08）: CLAUDE.md の「MCP 失敗時の CLI 代替」は取り込む（read-only に限る）。クラウドで `codex` が無いときは、ツールを出さず Claude だけで進む（requirements の Requirement 6・7）。
- 未確認（実装の中で確かめる）:
  - `.mcp.json` の `${CLAUDE_PROJECT_DIR:-.}` の既定値の展開（サブエージェントの調査では確認できず、`${CLAUDE_PROJECT_DIR}` だけでも可能性がある）
  - `project_doc_fallback_filenames`（バイナリには文字列があるが、実行時の動きは未確認。AGENTS.md を削除するため、本 spec では使わない）
- プロジェクト追跡の扱い: `.claude/settings.local.json` を追跡するか（現在は未追跡）は、要件で決める。
- 変更対象の `.claude/settings.json` には、セッション開始時に無かった差分（`autoMemoryEnabled` の位置）がある。実装の前に、この差分の扱いを確かめる。
