# Implementation Plan

## 状態の記録（2026-11-08 に設計から組み直し）

- `[x]` は、実装し確かめたもの。`[ ]` は未了のもの。現時点で未了のタスクは無い。利用者の操作を含む確認と後片付けは、末尾の「利用者の確認と後片付け」に記す（タスクには含めない）。
- `(P)` は、ファイルを共有せず、依存も無いものだけに付けた。`.claude/settings.json` を触るタスク（4.1・4.2・4.7・5.3）は同じファイルを触るため、並列にしない。

- [x] 1. BRW の取得元（CI 用）と検査
- [x] 1.1 (P) 取得元の検査を、単独で確かめられる形にする
  - HTTPS の GitHub の URL と、ブランチ名の規則を検査する
  - 完了の条件: 規則に外れた URL・ブランチ名が、原因の分かる文言で止まる（単体の試験で確認済み）
  - _Boundary: BrwSourceCheck_
  - _Requirements: 3.3_

- [x] 1.2 CI 用の取得（引数なし）だけを残す
  - 引数なしで実行すると、取得元を読み、指定ブランチを clone して、その絶対パスを標準出力に出す
  - 引数が渡されたら、使い方を出して失敗する。ユーザー設定の書き換えと Codex への導入の処理は持たない
  - 完了の条件: 引数なしで clone のパスが出る。取得元の欠落・不正は、ファイル名と項目を含む文言で非ゼロ終了する
  - _Depends: 1.1_
  - _Boundary: CiBrwSource_
  - _Requirements: 3.2, 3.3_

- [x] 1.3 deploy と preview が取得結果を後続へ渡す
  - 両ワークフローの取得ステップの出力を `BRW_PLUGIN_DIR` として後続のステップへ渡す（既存の動作を保つ）
  - 完了の条件: 両ワークフローで、取得ステップの出力が後続の `BRW_PLUGIN_DIR` として参照されている
  - _Depends: 1.2_
  - _Boundary: CiWorkflows_
  - _Requirements: 3.4_

- [x] 1.4 (P) ブランチ運用の正本と取得元を、1 つずつに保つ
  - ルートの `.branch-release-workflow.json` を正本として追跡し、`.claude/branch-release-workflow.json` はそれへのリンクにする
  - CI 用の取得元（`.branch-release-workflow-source.json`）を追跡する
  - 完了の条件: 正本は 1 つだけで、`.claude/` 側は正本を指すリンクになっている
  - _Boundary: BrwDeclarations_
  - _Requirements: 3.1, 4.5_

- [x] 2. Codex 向けの導入物の取り消し
- [x] 2.1 (P) Codex 向けの hook・AGENTS.md・子エージェント定義を取り除く
  - `.codex/hooks.json`・`AGENTS.md`・`.codex/agents/` を削除する。`.codex/config.toml` は変更しない（`codex-mcp-subagent` の対象）
  - 完了の条件: 3 つが無く、`.codex/config.toml` の差分が無い
  - _Boundary: CodexArtifacts_
  - _Requirements: 5.1, 5.2, 5.5_

- [x] 2.2 (P) Codex 向けの生成物と gitignore の行を取り除く
  - `.agents/skills/kiro-*` と BRW の symlink を削除し、gitignore の 2 行を外す。`.agents/skills/survey-run/` は対象外として残す
  - 完了の条件: `.gitignore` に `.agents/skills/kiro-*/` と `.agents/skills/branch-release-workflow` が無い
  - _Boundary: GitIgnore_
  - _Requirements: 5.4_

- [x] 3. cc-sdd の導入（Claude 向け）
- [x] 3.1 導入スクリプトを、Claude 向けの 1 つの入口にする
  - `--claude` だけを受け付ける。引数なし・他の引数（`--codex` を含む）は、使い方を標準エラーに出して非ゼロで終わる
  - SessionStart で cc-sdd の導入を呼ぶ行は、この 1 回だけ
  - 完了の条件: `--claude` 以外の引数で非ゼロ終了し、SessionStart の cc-sdd の行が 1 つだけある
  - _Boundary: CcSddInstall_
  - _Requirements: 1.1, 1.4, 5.3_

- [x] 3.2 cc-sdd を固定版で導入する
  - 版 3.1.0 を指定し、言語は `--lang ja` を固定して渡す
  - CLAUDE.md は導入の対象の一覧から外す
  - 完了の条件: 導入の後も CLAUDE.md が変わらない（一覧に含まれない）
  - _Depends: 3.1_
  - _Boundary: CcSddInstall_
  - _Requirements: 1.2, 1.3, 2.1_

- [x] 3.3 導入の失敗を記録し、成功で記録を消す
  - 導入の前に記録（`.cache/cc-sdd-install.failed`）を書く。途中で中断されても記録が残る
  - 失敗のとき、非ゼロで終わり、失敗の内容を標準エラーに出す。成功のとき、記録を消す
  - クラウドでも同じように動く（環境による分岐は作らない）
  - 完了の条件: 偽の npx で、失敗時は記録が残り非ゼロで終わり、成功時は記録が消える（試験で確認済み）
  - _Depends: 3.2_
  - _Boundary: CcSddInstall_
  - _Requirements: 1.5, 1.8, 1.9_

- [x] 3.4 導入を 2 回行っても、追跡ファイルの差分が増えない
  - 導入物（`.claude/skills/kiro-*`・`.kiro/settings/`）は gitignore の対象のまま扱う
  - 完了の条件: 2 回の実行の前後で `git status` の出力が同じ（2026-11-08 に手元で確認）
  - _Depends: 3.2_
  - _Boundary: CcSddInstall_
  - _Requirements: 2.2, 2.3_

- [x] 4. BRW の有効化（プロジェクトの設定と SessionStart の冪等な導入）
- [x] 4.1 プロジェクトの設定に、marketplace とプラグインの宣言を置く
  - `extraKnownMarketplaces` の `nekono-dev` を、GitHub の `nekono-dev/claude-plugins` として宣言する
  - `enabledPlugins` に `branch-release-workflow@nekono-dev` を置く
  - 完了の条件: 設定がこの 2 つを満たす（単体の試験で確認済み）
  - _Boundary: ClaudeSettings_
  - _Requirements: 4.1_

- [x] 4.2 SessionStart から旧い BRW の導入を外し、端末とユーザー設定に触れない形にする
  - `setup-brw` の `--install` の呼び出しを削除する。Codex への導入の処理は持たない
  - 端末に BRW の clone を置かず、ユーザーの marketplace の登録を書き換えない
  - 完了の条件: SessionStart に `setup-brw` の行が無く、導入の処理に marketplace の削除と Codex 向けの導入が無い（試験で確認済み）
  - _Depends: 4.1_
  - _Boundary: ClaudeSettings, EnsureBrw_
  - _Requirements: 4.2, 4.3, 4.4_

- [x] 4.3 無いものだけを CLI で導入する（冪等）
  - marketplace の一覧と、このプロジェクトの scope project のプラグインの有無を確かめる
  - 無いものだけを CLI（`marketplace add --scope project`・`install --scope project --yes`）で行う。両方あれば、導入の操作はしない
  - `claude` が無ければ、飛ばして標準エラーに出し、正常終了する
  - 削除（`marketplace remove`・`uninstall`）は呼ばない
  - 完了の条件: 偽の claude で、無いときだけ導入し、あるときは導入の操作が無い。`claude` が無いときは飛ばす（試験で確認済み）
  - _Depends: 4.2_
  - _Boundary: EnsureBrw_
  - _Requirements: 4.6, 4.7_

- [x] 4.4 導入の失敗を記録し、成功で記録を消す
  - 導入の前に「導入中（完了していない）」の記録を書く。一覧の取得が失敗したら、導入せずに記録を書く
  - 導入の CLI が失敗したら、失敗の内容と再試行の方法を標準エラーに出し、記録を残して正常終了する
  - 導入が成功したら、記録を消す
  - 完了の条件: 失敗時は記録が残って終了コード 0、成功時は記録が消える（試験で確認済み）
  - _Depends: 4.3_
  - _Boundary: EnsureBrw_
  - _Requirements: 4.8, 4.12_

- [x] 4.5 プラグインの更新を毎回試し、導入の案内を出す
  - 1 から 4 の後に `plugin update` を試す。失敗は標準エラーに出して続行する
  - 導入を行ったときは、スキルが使えない場合があることと、セッションを開き直すことを標準エラーに出す
  - 完了の条件: 更新だけを失敗させても記録が残らず正常終了する。導入時には案内が出る（試験で確認済み）
  - _Depends: 4.4_
  - _Boundary: EnsureBrw_
  - _Requirements: 4.9, 4.10_

- [x] 4.6 CLI の時間の予算を守る
  - CLI 1 回の上限は 60 秒。CLI は最大 5 回（一覧の取得 2 回・add・install・update）呼ぶため、スクリプト全体の予算を 170 秒とし、各 CLI の上限を「60 秒と予算の残りの小さい方」にして、フックの時間制限 180 秒に収める
  - 予算が尽きたとき、導入に要る CLI は失敗として扱い、更新は飛ばして標準エラーに出す（記録は書かない）
  - 上限で打ち切られたら失敗として記録を残す。導入の前の記録があるため、次の入力まで止まる
  - 完了の条件: すべての CLI が遅い偽の claude で、全体の予算の時間内に終わり、記録が残って終了コード 0。予算が尽きたとき、更新は飛ばされ記録は書かれない
  - _Depends: 4.4_
  - _Boundary: EnsureBrw_
  - _Requirements: 4.8_

- [x] 4.7 SessionStart に導入スクリプトを 1 行加える
  - `ensure-brw-plugin.mjs` の行を、cc-sdd の導入の行の後ろに置く（時間制限 180 秒）
  - 完了の条件: SessionStart に導入スクリプトの行が 1 つだけあり、クラウドの初期化と kiro-gate の行は変わらない
  - _Depends: 4.3, 4.4, 4.5, 4.6_
  - _Boundary: ClaudeSettings_
  - _Requirements: 4.6_

- [x] 5. 失敗の状態による停止（UserPromptSubmit）
- [x] 5.1 (P) 導入の失敗の記録があるとき、プロンプトを止める（`install-gate.mjs`）
  - cc-sdd と BRW のどちらかの記録があれば、`decision: "block"` の JSON を返す。理由に、新しいセッションを開くこと（第一の手段）と、Claude の外のターミナルで再試行すること（補助）を示す
  - 本文はブロックの表示から外す（`suppressOriginalPrompt`）
  - 記録が無ければ何も返さずに終わる。判定できない例外は、標準エラーに出して通す
  - 完了の条件: 記録を置くと block が返り、記録を消すと何も返らない（試験で確認済み）
  - _Depends: 3.3, 4.4_
  - _Boundary: InstallGate_
  - _Requirements: 1.6, 4.11_

- [x] 5.2 (P) cc-sdd が無いとき、`/kiro-*` のスラッシュコマンドを止める（`kiro-gate.mjs`）
  - スキルの SKILL.md が無ければ `decision: "block"` を返し、`scripts/agent/install-cc-sdd.sh --claude` の実行を促す
  - 完了の条件: SKILL.md が無いとき block が返り、理由に導入のコマンドが含まれる（試験で確認済み）
  - _Depends: 3.2_
  - _Boundary: KiroGate_
  - _Requirements: 1.7_

- [x] 5.3 UserPromptSubmit に両方のフックを登録する
  - `install-gate.mjs` を `kiro-gate.mjs` より前に並べる
  - 完了の条件: UserPromptSubmit に 2 つのフックがこの順で登録されている（試験で確認済み）
  - _Depends: 5.1, 5.2_
  - _Boundary: ClaudeSettings_
  - _Requirements: 1.6, 1.7, 4.11_

- [x] 6. クラウドの初期化の範囲（変更なし）
- [x] 6.1 クラウドの初期化の範囲を確かめる
  - `CLAUDE_CODE_REMOTE` が `true` のときだけ、submodule・`npm install`・`npm run codegen`・`.dev.vars` の雛形コピーを行う。ローカルでは git の hooksPath の設定だけを行う
  - `setup-git-hooks.mjs` は冪等なので、`prepare` と両方から呼ばれても結果が同じ
  - 完了の条件: 初期化スクリプトの分岐が上記のとおり（2026-10-31 に確認済み）
  - _Boundary: CloudInit_
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 7. 自動の試験
- [x] 7.1 設定と Codex の削除を試験で確かめる（`tests/unit/scripts/agentSettings.test.ts`）
  - 宣言（marketplace・plugin）、SessionStart に `setup-brw` が無いこと、`--claude` 以外を受け付けないこと、Codex 向けのファイルと gitignore の行が無いこと
  - 完了の条件: 6 件が通過（2026-11-08）
  - _Requirements: 1.4, 4.1, 4.2, 5.1, 5.2, 5.4_

- [x] 7.2 導入の判断と偽の claude の試験（`tests/unit/scripts/ensureBrwPlugin.test.ts`）
  - 判断の関数、導入の本体（偽の runner）、失敗の記録、偽の claude での一続きの確認、時間の予算（偽の時計と偽の runner）、更新だけの失敗、導入の案内
  - 完了の条件: 21 件が通過（2026-11-10）
  - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10, 4.12_

- [x] 7.3 導入の失敗の記録の試験（`tests/unit/scripts/cc-sddInstallRecord.test.ts`）
  - 偽の npx で、失敗時の記録・成功時の消去・導入の前の記録を確かめる（リポジトリの `.cache` には触れない）
  - 完了の条件: 3 件が通過（2026-11-08）
  - _Requirements: 1.5, 1.8_

- [x] 7.4 停止の試験（`tests/unit/scripts/installGate.test.ts`・`tests/unit/scripts/kiroGate.test.ts`）
  - install-gate の block と解除、kiro-gate の SKILL.md 欠落時の block
  - 完了の条件: install-gate の 4 件と、kiro-gate の該当の試験が通過（2026-11-08）
  - _Requirements: 1.6, 1.7, 4.11, 4.12_

- [x] 7.5 取得元の検査の試験（`tests/unit/scripts/brwSource.test.ts`）
  - 完了の条件: 検査と読み取りの試験が通過（2026-11-08）
  - _Requirements: 3.3_

## 利用者の確認と後片付け（タスクに含めない）

利用者の操作を含むため、タスクには入れない。完了の条件として、ここに記す。

- **対話のセッションでの確認**（Req 4.6・4.10・4.11）: 導入の無い状態からセッションを開き、導入と案内が出ること。同じセッションでスキルが使えるか（使えなければ、開き直して使えること）。導入済みの状態では、導入の操作が行われないこと（更新だけが試される）。失敗の記録があるとき、プロンプトがブロックされて理由が出ること。
  - 2026-11-08 の headless（`claude -p`）での確認（Claude 側で実施）: marketplace の一覧を偽の失敗にすると、SessionStart が失敗の記録を書き、次のプロンプトが `decision: "block"` でブロックされ、理由（再試行の方法）が出た（Req 4.8・4.11）。通常の PATH で開き直すと、記録が消え、プロンプトが通った（Req 4.12）。
  - 2026-11-10 の対話のセッションでの確認（利用者の承認を得て、Claude が tmux で対話の画面を操作した。Claude Code 2.1.321）:
    - 導入の無い状態（`claude plugin uninstall -s project` でプラグインを外し、`.claude/settings.json` の宣言は元のまま）からセッションを開くと、SessionStart が導入した（フックは終了コード 0、約 12 秒）。追跡ファイルの差分と失敗の記録は無い（Req 4.6）。
    - 案内（Req 4.10）: フックの標準エラーに「BRW を導入しました。スキルが使えない場合は、セッションを開き直してください。」が出て、セッションの記録（`hook_success` の `stderr`）に残る。対話の画面には表示されない（Claude Code は、終了コード 0 のフックの標準エラーを画面に出さない）。要件は標準エラーへの出力を定めているため、充足とする。
    - 導入した同じセッションでは、スキルは使えない（`/branch-rel` に一致するコマンドが無い）。開き直すと、`/branch-release-workflow` が候補に出る。案内の内容と一致する。
    - 導入済みの状態では、呼ばれる CLI は `plugin marketplace list --json`・`plugin list --json`・`plugin update` の 3 つだけ（下の不具合を直した後に、`TERM` が `linux` と `xterm-256color` の両方で確かめた）で、導入の操作は無い（`claude` を記録用の包みに差し替えて確かめた。Req 4.6）。
    - 失敗の記録（`.cache/brw-plugin-install.failed`）を置くと、対話の画面に「UserPromptSubmit operation blocked by hook」と理由（再試行のコマンドと記録のパス）が出て、入力が止まる。記録を消すと、同じセッションで次の入力が通る（Req 4.11）。
    - 補足: `claude plugin uninstall -s project` は、`.claude/settings.json` の `enabledPlugins` から項目を消す。プラグインを手で外した後は、宣言を元に戻す（`git diff` で確かめる）。
- **クラウドでの確認**（Req 1.9・4.7）: クラウドで `claude` と `npx` が使え、ネットワークが通ること。利用者の決定 (a) の前提であり、崩れたら決定を見直す。
  - 2026-11-10 のクラウドセッション（環境「Cloud Skyshare」、ブランチ `dev/structure-docs-cleanup`、Claude Code 2.1.322）での確認: `CLAUDE_CODE_REMOTE=true`。`claude`・`npx`・`node`・`git`・`sh` があり、`codex` は無い。cc-sdd のスキル（`.claude/skills/kiro-*` が 17 個）と `.kiro/settings` が入り、失敗の記録は無い。marketplace `nekono-dev` とプラグイン（scope project、有効）が入り、スキルの一覧に kiro と BRW のスキルが載る。最初の入力はフックに止められない。追跡ファイルの差分は無い。クラウドの初期化（`node_modules`・`src/client`・`.dev.vars`・hooksPath）も済んでいる（Req 1.9・4.7・6.1）。
  - このとき見つかった不具合: 導入済みなのに、導入スクリプトが marketplace を登録し直し、案内を出した。原因は、端末の種類（`TERM=linux`）で Claude Code が一覧の記号を `❯` から `>` に変え、記号に頼る判定が外れたこと。一覧を `--json` で取得して名前で判定する形に直した（下の Implementation Notes）。
  - 修正の後（コミット ef72b6b8）に、新しいクラウドセッションで確かめ直した: `TERM=linux`。導入済みの状態で導入スクリプトを実行すると、何も出力せず終了コード 0 で、失敗の記録と追跡ファイルの差分は無い。
- **`~/.cache/skyshare/brw` の削除**（Req 4.2）: 2026-11-10 に、利用者の承認を得て削除した。どの設定からも参照されていないことを確かめた（`scripts/agent/setup-brw.mjs` の既定の取得先として名前が残るだけで、CI は `RUNNER_TEMP` を使う）。削除の後も、プラグインは導入済みのまま有効。
- **DEVELOP.md の記述**（Req 4.1・4.2）: 2026-11-10 に、`docs/DEVELOP.md` の冒頭・1 の 4・5.3 を、現在の導入（SessionStart の自動の導入、Codex は MCP の子エージェント）に合わせて直した（roadmap の `develop-docs-agents`）。
- **`.agents/skills/survey-run/`**: 本 spec の対象外。残すか消すかは別途決める。

## Implementation Notes

- 2026-11-10 に、全項目のチェックを外して再検査した。独立レビュー（Codex、読み取り専用）で、1.2（不正の文言に項目名が無い）、4.5・7.2（更新だけの失敗と導入の案内の試験が無い）、4.6（CLI の最大 5 回 × 60 秒が、フックの上限 180 秒を超えうる）が不足と分かり、直した。
- 4.6: CLI の回数を数えるときは、一覧の取得（2 回）も含める。時間の上限は、回数の掛け算に頼らず、全体の予算（170 秒）で守る。
- 時間の予算の試験は、偽の時計と偽の runner で行う。偽の runner は、渡された上限を超えて時計を進めない（超えると、予算内であることを証明できない）。実際のプロセスの打ち切りを確かめる試験では、偽の CLI を `exec sleep` にする（シェル経由だと、打ち切りの後に子のプロセスが残る）。
- 2026-11-10 の feature 検証（kiro-validate-impl）: `npm run test:all` は終了コード 0（単体・部品・経路・描画・e2e を含む）。結線・要件の網羅・境界に、実装の不足は無い。判定は `MANUAL_VERIFY_REQUIRED`。残りは、上の「利用者の確認と後片付け」（対話のセッションでの確認、クラウドでの確認、旧い clone の削除）。
- `docs/DEVELOP.md` に残っていた、取り消した入口（`npm run setup:brw`、`--codex`）の記述は、2026-11-10 に直した（冒頭の一覧・1 の 4・5.3）。
- 4.3: marketplace の登録の有無は、`claude plugin marketplace list --json` の `name` で判定する。人向けの出力は、端末の種類で記号が変わる（`TERM=linux` では `❯` が `>` になる）ため、判定に使わない。手元では `TERM=linux` を付けて実行すると、クラウドと同じ出力を再現できる。
- CLI の人向けの出力を解析する試験は、手元の端末の出力だけを見本にすると、別の環境の差を見落とす。機械向けの出力（`--json`）があれば、それを使う。
- 2026-11-10 の 2 回目の feature 検証（kiro-validate-impl）: 判定は `GO`。全試験（`npm run test:all`。push 前の検査として実行）は終了コード 0。起動の確認（導入の入口が `--claude` 以外を使い方と終了コード 2 で断ること、失敗の記録が無いとき install-gate が何も返さないこと）も通った。判断の項目（結線・要件の網羅 6/6・設計との一致・境界）は、Codex（`codex_exec`、読み取り専用）の独立した検証で、重大な指摘は無い。「利用者の確認と後片付け」の確認（対話のセッション・クラウド・旧い clone の削除・DEVELOP.md）は済んだ。残るのは、対象外とした `.agents/skills/survey-run/` の扱いだけ。
