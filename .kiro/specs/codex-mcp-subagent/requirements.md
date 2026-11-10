# Requirements Document

## Project Description (Input)

Claude Code で開発する開発者（skyshare の作業者）が、大きなタスクの途中で、設計・分析・実装・デバッグ・レビュー・探索といった思考を要する作業を Codex に任せられるようにする（レビューはその一部）。Codex は MCP サーバー `codex` の `codex_exec` ツールとして Claude から子エージェントのように呼ぶ。現状は Codex が cc-sdd の導入物としてだけ存在し、Claude の作業の流れに入っていない。変更後は、Claude が思考を要する作業を積極的に Codex に委譲する。MCP が使えない環境（クラウドセッションなど）では Claude だけで従来どおり完結する。

詳細は [brief.md](brief.md) を参照。Codex の cc-sdd 導入の取り消しは `ops-agent-setup` の改訂で行い、本 spec の対象外。委譲の規約は、vpngateway-gui の CLAUDE.md（2026-11-08 時点の版）を参照元とする。

## Introduction

Claude が作業の主体のまま、思考を要する作業を Codex に委譲する仕組みを定める。委譲先は MCP サーバー `codex` のツール `codex_exec`。Codex が使えない環境では、Claude だけで作業を完結させる。

## Boundary Context (Optional)

- **In scope**: MCP サーバー（`codex_exec` の提供）、`.mcp.json` への登録、個人の承認（`.claude/settings.local.json`）、`.codex/config.toml` の取り込み、CLAUDE.md の委譲の規約、CLI への代替（MCP 失敗時）、クラウドでの扱い、リポジトリの信頼の確認（Requirement 10）、動作の確認。
- **Out of scope**: cc-sdd の Codex 導入の取り消しと BRW の Codex 側（`ops-agent-setup`）、kiro スキルの中身（cc-sdd の生成物のため書き換えない。規約は CLAUDE.md に置く）、Codex のモデルの性能評価と料金。
- **Adjacent expectations**: `ops-agent-setup`（SessionStart と Codex 向けの導入物）、`ops-config-secrets`（秘密の扱い）。

## Requirements

### Requirement 1: MCP サーバーの提供

**Objective:** As a 開発者, I want Claude が Codex を MCP のツールとして呼べる, so that 委譲が Claude の通常のツール呼び出しとして行える

#### Acceptance Criteria

1. When Claude Code が MCP サーバー `codex` を起動したとき, the サーバー shall ツール `codex_exec` を 1 つ提供する
2. If `codex` の実行ファイルが使えないとき, then the サーバー shall ツールを 1 つも提供しない（Claude には `codex_exec` が見えず、Claude だけで進む）
3. The サーバー shall 承認の指定（`--ask-for-approval never`）を `exec` の前に置いて `codex exec` を起動する（`exec` の後に置くと、codex 0.167 が拒否する）
4. The サーバー shall `prompt` を標準入力で渡す。`sandbox` の既定値は `workspace-write` とする
5. The サーバー shall `sandbox` の値を `read-only` と `workspace-write` の 2 つに限る。それ以外は実行せず、エラーを返す
6. If `cwd` がリポジトリの外を指すとき, then the サーバー shall 実行せず、エラーを返す
7. The サーバー shall 1 回の Codex の実行を 10 分で打ち切る
8. If Codex が非ゼロで終了したとき, then the サーバー shall エラーとして、最後のメッセージと標準エラーの末尾を返す
9. The サーバー shall 書き込みを伴う（`workspace-write`）呼び出しと読み取りだけの呼び出しを 1 本の先着順の列で待たせ、同時に実行するのは読み取りが 5 件まで、書き込みが 1 件までとする。並列数は、実施中の作業だけを数える（待っている呼び出しは数えない）。先着順なので、待機中の呼び出しを追い越さない。読み取りと書き込みを重ねないことは、サーバーでは強制せず、全体調整役（Codex に委譲する Claude のセッション）が運用で行う（ロックは設けない）。前提として、1 つの作業ツリーで全体調整役は 1 つだけ動かす
10. If ある呼び出しの待ち時間（先着順の列での待ちを含む）が 2 分に達したとき, then the サーバー shall その呼び出しを実行せず、`isError` を返す（待ちの件数には上限を設けない。1 回の実行の 10 分は待ち時間に含めない）

### Requirement 2: 委譲の方針（積極的な利用）

**Objective:** As a 利用者, I want Claude が思考を要する作業を積極的に Codex に任せる, so that Claude は指示・検証・報告・承認に集中できる

#### Acceptance Criteria

1. While `codex_exec` が使えるとき, the Claude shall 思考を要する作業を、直接作業する前に `codex_exec` へ委譲する。対象は次のとおりで、レビューに限らない: 設計・分析・要件の検討、新規実装と修正、デバッグの原因調査、独立したレビュー、広範囲の探索
2. The Claude shall 委譲したあと、委譲先への指示、結果の検証、利用者への報告、承認状態の変更、利用者への確認事項に集中する。委譲先の応答が返るまで待ち、原則として作業を止めない（クライアント側の呼び出し制限時間を、作業を止める理由にしない。サーバーの上限は Requirement 1.7・1.10 による）
3. When 互いに依存しない作業が複数あるとき, the Claude shall 読み取りだけの `codex_exec` の呼び出しを同じターンで並べて送る。書き込みを伴う（`workspace-write`）呼び出しは並べず、1 つずつ行う。読み取りと書き込みは重ねない。全体調整役は、書き込みを伴う呼び出しが完了するまで読み取りの呼び出しを指示せず、読み取りの呼び出しが完了するまで書き込みを伴う呼び出しを開始しない。完了とは、結果（成功またはエラー）が返ることをいう。CLI の代替（Requirement 6）も同じ順序に従い、バックグラウンドで実行しない。全体調整役は、読み取りの依頼が書き込み対象のディレクトリを読む必要があるとき、そのディレクトリが進行中の作業の対象であることを依頼文に注意として書く（書き込みの実行中に読むと競合しうるため）
4. The Claude shall 仕様書や実装の独立レビューの結論を、書いた本人として出さない。独立レビューは `codex_exec` に行わせ、その指摘を入力にする（sandbox は依頼の内容に応じて選ぶ）
5. When 委譲を省いたとき, the Claude shall その理由を最終報告に書く
6. The 最終報告 shall 次を含む: どの作業を Codex に委譲したか、Claude が何を検証したか

### Requirement 3: 直接対応してよい作業（例外）

**Objective:** As a 開発者, I want 委譲が不要な作業と禁止される作業が明確, so that 規約を機械的に当てはめずに済む

#### Acceptance Criteria

1. The Claude may 次の作業を直接行う: 1 行から数行の機械的な修正（誤字、設定値の差し替えなど）、利用者の判断待ちの事項、`spec.json` の承認フラグの変更、git 操作、秘密情報の扱い
2. When Claude が直接行ったとき, the Claude shall その理由を最終報告に書く
3. The Claude shall 次の作業を Codex に委譲しない: 利用者の判断・承認が要る事項、破壊的操作（reset・強制削除・ログインやボリュームの削除）、外部システムに作用する操作、秘密情報や認証情報を扱う作業
4. The 依頼文 shall トークン・パスワード・アカウント識別子を含まない

### Requirement 4: 依頼文の書き方

**Objective:** As a Claude, I want Codex が会話の文脈なしで作業できる依頼文, so that 委譲の結果を検証しやすくなる

#### Acceptance Criteria

1. The 依頼文 shall 自己完結する: 目的、対象ファイルの正確なパス、要件・設計・タスクの番号、境界と言語の規則などの制約、出力の形式を含む。さらに、読んでよいディレクトリを明記する（書き込みを伴う依頼では、書き込んでよいディレクトリも明記する）
2. The 依頼文 shall 会話の全体を貼り付けない
3. Where 実装を依頼するとき, the 依頼文 shall テストの実行コマンドと完了の判定条件を含む
4. The Claude shall `codex_exec` の呼び出しごとに `sandbox` を明示する。値は依頼の内容に応じて選ぶ（ファイルを変えさせない依頼は `read-only`、変えさせる依頼は `workspace-write`）。既定の値に任せない
5. The 依頼文 shall プロジェクトの規則（CLAUDE.md の該当箇所）を、必要な分だけ含める。Codex は AGENTS.md を読まない前提で書く

### Requirement 5: 検証と報告

**Objective:** As a 利用者, I want Codex の報告を鵜呑みにしない, so that 完了の主張が検証された状態で出る

#### Acceptance Criteria

1. The Claude shall Codex の報告を、検証するまで未確認として扱う
2. Before 完了を報告する, the Claude shall `git diff` で変更を確認し、依頼文に書いたテストを実行する
3. If Codex の結果に誤りや不足があるとき, then the Claude shall 具体的な不備を示して `codex_exec` に再依頼するか、自分で直す
4. The Claude shall Codex が行った作業、Claude が検証した内容、未検証の事項を報告する。完了の主張の前に `kiro-verify-completion` に従う
5. The Codex shall git の commit・push・ブランチ操作と、`spec.json` の承認状態の変更を行わない（依頼文で禁止する）

### Requirement 6: MCP が使えないときの代替

**Objective:** As a Claude, I want MCP のツールが失敗したときの手順, so that 委譲が途中で止まらない

#### Acceptance Criteria

1. If `codex_exec` の呼び出しがエラーになり、かつ `codex` の実行ファイルが使えるとき, then the Claude may 同じ依頼を CLI で実行する: `codex -a never exec --sandbox <依頼の値> --cd <リポジトリ> - < <プロンプトファイル>`
2. The 代替の CLI の実行 shall 失敗した `codex_exec` と同じ sandbox の値を使う。承認の指定は `exec` の前に置く
3. The Claude shall プロンプトファイルを `/tmp` ではなくセッションのスクラッチパッドに置く
4. When 代替を使ったとき, the Claude shall その旨を最終報告に書く
5. If MCP のツールも CLI の代替も使えないとき, then the Claude shall 委譲を省き、Claude だけで作業を完結させ、その理由を報告する
6. If `codex_exec` の失敗が待ち時間の上限（Requirement 1.10）によるとき, then the Claude shall 先行する書き込みの完了を待ってから、代替の CLI を実行する（Requirement 2.3 の順序に従う）
7. The Claude shall 思考を要する作業を委譲する前に、`codex_exec` が使えるかを確かめる（ツールの一覧にあるかを見る）。codex は常に使えるとは限らないため、この確認を委譲の最初の手順とする
8. If `codex_exec` が使えないとき, then the Claude shall その原因を確かめる。原因がプランの制限（課金・利用枠）でなければ、`codex` の実行ファイルが使える限り、6.1 と同じ規則で CLI から委譲する。原因がプランの制限のときは委譲せず、Claude だけで作業を完結させ、その理由を報告する。原因が判断できないときは、CLI から委譲を試し、その結果に従う

### Requirement 7: 環境による扱いの違い（クラウドを含む）

**Objective:** As a クラウドセッションの利用者, I want Codex が無い環境でも作業が止まらない, so that MCP の有無に関わらず従来どおり Claude だけで完結する

#### Acceptance Criteria

1. When クラウドセッションなどで `codex` の実行ファイルが無いとき, the 設定 shall Codex を使わない状態になり、Claude だけで作業を完結させる
2. The 規約 shall 環境に応じた動きを、委譲の義務（Requirement 2）より優先しない。Codex が使えない環境では、委譲の義務は適用しない
3. The 個人の承認 shall `.claude/settings.local.json` の `enabledMcpjsonServers` に置き、共有の設定ファイルには書かない（追跡の扱いは design で確定する）
4. If MCP サーバー `codex` が起動できないとき（`sh` または `git` が無い環境など）, then the Claude shall `codex_exec` を使わずに作業を完結させ、接続の失敗を理由に作業を止めない

### Requirement 8: 設定とパス

**Objective:** As a 運用者, I want MCP の登録と Codex の設定が再現できる, so that 別の環境でも同じ動きになる

#### Acceptance Criteria

1. The `.mcp.json` shall サーバー `codex` を stdio の `node` として登録し、サーバーのスクリプトのパスを、リポジトリのどこから開いても解決できる形で書く
2. The `.mcp.json` のパスの書き方 shall 実機の確認で動くことを確かめてから確定する。確認できない書き方は使わない
3. The `.codex/config.toml` shall 次の値を持つ: `model = "gpt-6-luna"`、`model_reasoning_effort = "medium"`、`approval_policy = "never"`、`sandbox_mode = "workspace-write"`、`[sandbox_workspace_write] network_access = false`
4. The `.codex/config.toml` shall `approvals_reviewer` を含まない（skyshare の現在の設定にあったが、承認 `never` のもとで効果が観測されなかったため外す。確認の記録は research.md の第 11 節）

### Requirement 9: 規約の所在

**Objective:** As a 運用者, I want 委譲の規約が cc-sdd の上書きで消えない, so that 規約が常に読まれる

#### Acceptance Criteria

1. The 委譲の規約 shall `CLAUDE.md` の「Codex as a Child Agent (MCP)」節に置く。kiro-* スキルには書かない（cc-sdd が毎回上書きするため）
2. The `CLAUDE.md` shall cc-sdd の導入で上書きされない（導入スクリプトが `CLAUDE.md` を対象から外す。`ops-agent-setup` の要件 2.1）
3. The 規約の節 shall vpngateway-gui の版と同じ項目を持つ: 思考を要する作業の委譲（レビューに限らない）、積極的な委譲、自己レビューの禁止、並列の呼び出し、委譲の報告、直接対応の例外、MCP 失敗時の代替、依頼文の書き方、検証。sandbox の値は依頼の内容に応じて選び、読み取り専用に固定しない
4. The 規約の節 shall 英語で書く。本 spec が CLAUDE.md に追加する文は、すべて英語で書く
5. The CLAUDE.md shall 日本語の文を含まない（HEAD の版は既に英語であり、既存の節の訳は済んでいる。本 spec が追加する文も英語で書く）

### Requirement 10: リポジトリの信頼の確認

**Objective:** As a 運用者, I want Codex が信頼していないリポジトリでは、作業を始める前に止まる, so that リポジトリの設定（`.codex/config.toml`）が読まれない状態のまま委譲が行われない

#### Acceptance Criteria

1. While `codex` の実行ファイルが使えるとき, the 設定 shall リポジトリが Codex で信頼されているかを、利用者の最初の入力の前に確かめる（信頼の確認）
2. The 信頼の確認 shall 利用者の Codex の設定（`CODEX_HOME` の `config.toml`、既定は `~/.codex/config.toml`）の `[projects."<パス>"]` に `trust_level = "trusted"` があるかで判断する。パスは、現在の作業ツリーのパス、または git worktree の場合は親のリポジトリ（メインの作業ツリー）のパスとする。親のリポジトリが信頼されていれば、その worktree も信頼されているとみなす（利用者の決定）
3. If リポジトリが信頼されていないとき, then the 設定 shall 利用者の入力の受け付けを止め、信頼の手順（Codex で開いて信頼する。または設定に書く）と、確認後の再試行の方法を示す。セッションそのものは開いたままにする（Claude Code の仕様上、セッションの開始は止められないため）
4. When リポジトリが信頼されたことを確認できたとき, the 設定 shall 次の入力から受け付ける。止めた状態を記録しない（毎回判定する）
5. The 設定 shall 信頼を自動で書き込まない。信頼は利用者が Codex 側で行う
6. If `codex` の実行ファイルが無いとき, then the 設定 shall 信頼の確認で作業を止めない（Requirement 7.1 に従う）
7. If 信頼の確認の判定に失敗したとき（設定ファイルの読み取りや解析の失敗など）, then the 設定 shall 作業を止めず、理由を標準エラーに出す
