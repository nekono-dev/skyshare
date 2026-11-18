# Research & Design Decisions

## Summary

- **Feature**: `survey-env-config`
- **Discovery Scope**: Extension（既存の運用 CLI とワークフローの拡張。軽い調査）
- **Key Findings**:
  - 両環境の突き合わせは `cli.ts` の `readIndexes` と `lifecycle.ts` の `AggregatedByEnv` などにだけある。`config.ts` は環境を知らず、環境の分離による変更は不要である。ただし、実測した上限に合わせて `VARIABLE_LIMIT_BYTES` の 1 行だけを `48000` に直す。
  - `SURVEY_CONFIG` を読むのは `deploy.yaml`・`preview.yaml` の `Run build` のステップの `env:` だけで、ワークフロー直下の `env:` に無い。環境の変数はジョブの `environment:` を付ければ、参照式を変えずに読める。`verify.yaml`・`e2e.yaml` は参照しない。
  - `render-survey-config.ts`・`sync-github-variables.mjs`（`MANAGED_ELSEWHERE` に `SURVEY_CONFIG`）・ローカルの `npm run dev`・E2E のハーネスは、変更が要らない。
  - 2026-11-17 に、未作成の環境への読み書き・削除の 404、`dev/**` の実ブランチとの一致、環境の自動作成、飛ばされたジョブの非作成、制限に一致しないジョブ全体の失敗、48,000 バイトの上限を実機で確認した。既存の環境への変数の上書きも成功を確認済みである。
  - 環境なしのジョブからは環境の変数が見えず、リポジトリ・組織の変数だけが見えることを実機で確認済みである。これを使い、両ワークフローに環境なしの門番を追加して共有の設定への逆戻りを止める。

## Research Log

### 環境の変数の読み書きの方法

- **Context**: `remote.ts` の設定の読み書きを、リポジトリ変数から環境の変数へ変える。
- **Sources Consulted**: `hack/survey-cli/remote.ts`、`tests/unit/hack/survey-cli/remote.test.ts`、GitHub REST API の環境の変数（`repos/{repo}/environments/{env}/variables/{name}`。公式の文書は、この作業では参照していない）。
- **Findings**:
  - 現行は、読みが `gh api repos/<repo>/actions/variables/SURVEY_CONFIG`、書き・削除が `gh variable set|delete SURVEY_CONFIG -R <repo>`（値は標準入力）。404 は標準エラーの `HTTP 404` の照合で分類している。
  - 環境の変数のパスは `repos/<repo>/environments/<env>/variables/SURVEY_CONFIG`。`gh variable set|delete` は `--env <環境>` でこれを指す。
- **Implications**: パスと `--env` の追加だけで、既存の分類・テストの形を保てる。

### 404 の解釈

- **確認結果**: 環境なし・変数なしの読みは 404 である。未作成の環境への `gh variable set/delete --env` も終了コード 1 と標準エラーの `HTTP 404: Not Found` を返す（2026-11-17）。既存の環境への変数の新規登録と既存値の上書きは成功を確認済みである。
- **判断**:
  - 読みの 404 は空の設定として扱う（要件 3.3・3.5）。
  - 削除の 404 は既に無いものとして成功扱いにする。
  - 書き込みの 404 は `no-environment` に分類する。外部の標準エラーや値を出力へ含めず、design.md の固定文へ変換する。
- **設計への反映**: 環境の有無を調べる事前確認は追加しない。権限不足が 403 になるか 404 で隠れるかだけは未確認で、design.md の項目 3 の積み残しと緩和を保つ。

### ワークフローの環境の選択

- **Context**: `deploy.yaml` は `release/**` と `develop` の両方で動く。`preview.yaml` は `dev/**`。
- **Sources Consulted**: `.github/workflows/{deploy,preview,verify,e2e}.yaml`。
- **Findings**:
  - `environment:` は `jobs.<id>.environment` に式で書ける（`github.ref_name` など）。既存の `concurrency.group`・`TARGET_FLAG` が同じ式を使っている。
  - `deploy` ジョブの `if:` は `release/**` と `develop` だけを通す。`environment:` を付けても `if:` は変わらない。
  - `verify`・`e2e` は `uses:` による再利用ワークフローの呼び出しで、`environment:` を付けない。
  - 環境の変数は、ワークフロー直下の `env:` では読めず、`environment:` を付けたジョブの中で読める。`SURVEY_CONFIG` はステップの `env:` で渡しているため、参照式はそのまま使える。
  - 環境に変数が無いと、同名のリポジトリ変数に代わる（ユーザーの決定の前提）。
- **設計への反映**: 環境の指定に加えて、両ワークフローに環境なしの `survey-config-guard` を追加する。門番のジョブ条件はビルドするジョブと同じにし、`permissions: {}` とする。拒否ステップの `if:` で `vars.SURVEY_CONFIG != ''` を判定し、design.md の固定の `shared-config` 文言だけを出して `exit 1` とする。値をシェルやログへ渡さない。`deploy`・`preview` は `needs:` で門番の成功を待つ。
- **検査**: `tests/unit/scripts/surveyWorkflowEnvironment.test.ts` で、環境の選択、門番の存在と環境指定の不在、待ち合わせ、条件、空の権限、固定文、変数の参照位置を文字列で検査する。参照を許す場所は門番のステップの `if:` と `Run build` の `env:` とする。

### 環境のデプロイブランチの制限

- **Context**: `develop` の環境に `develop` と `dev/**`、`production` の環境に `release/**` を許す。
- **確認結果（2026-11-17）**: `dev/**` は実ブランチ `dev/probe-envcheck` に一致した。制限に一致しないブランチではジョブ全体が失敗し、ステップは実行されず、配備の記録が残った。
- **残る確認**: `release/**` は同じ形の代用パターンで確認したが、実際の本番ブランチでは未確認である。初回リリースの手動起動（`dry_run`）で確かめる。代替と制限を外す場合の扱いは design.md の項目 5 に従う。
- **設計への反映**: `develop` に `develop`・`dev/**`、`production` に `release/**` の制限を付ける。production の作成と制限の登録は 2026-11-18 に実施済みである。

### 移行（共有の設定から環境の設定へ）

- **Context**: 既存の設定は、識別子・開始日時が決まった完成した JSON で、`add --file` の下書き（1 件ずつ・識別子は自動採番）では移せない。
- **判断**: 完成した設定の移行では、本文をそのまま環境の変数へ登録する直接操作が必要である。移行時の production 登録、develop の設定・目録・結果・可視フラグの削除、共有の設定の削除を、専用 CLI 以外で直接書き換えない原則の例外とする。CLI の機能は増やさない。
- **実施済み（2026-11-18）**: (a) 設定の退避、(b) production の作成と `release/**` の制限、(c) 現在の設定の登録とリポジトリ変数とのハッシュによる一致確認を済ませた。production の設定は最初のリリースから使う。本番にはアンケート機能をまだ配備していない。本番の結果バケット `skyshare-survey-results` も同日に作成済みで、空である。
- **残る手順**: develop 環境を作成して `develop`・`dev/**` に制限する。運用者が `gh`・`wrangler` で develop の設定と `skyshare-survey-results-develop` の目録・結果・可視フラグを削除する。開発用の保管先は本番と重ならない。続けて (d) リポジトリの共有の設定を削除し、組織の同名変数も無いことを確認してから、門番付きワークフローと CLI を develop に取り込む。
- **確認**: (e) production の `status` に移した設定があり、develop は `no surveys` となることを確認し、develop を再配備して表示を確かめる。共有の設定の削除から取り込みまでの間、develop にアンケート機能が載らないことは許容する。
- **設計への反映**: 同じ手順と実施済みの記録を DEVELOP.md 6.2.1 と skill に書く。実装時は `.claude/settings` に環境の変数操作と環境 API の実行許可も足す。brief.md と対象範囲が異なる点は design.md を正とする。

### 影響しない仕組み

- `scripts/survey/render-survey-config.ts`: 環境変数 `SURVEY_CONFIG` の値だけを読む。変更なし。
- `scripts/secrets/sync-github-variables.mjs`: `SURVEY_CONFIG` を `MANAGED_ELSEWHERE` に持ち、リポジトリ変数の一覧だけを見る。環境の変数は見ない。変更なし。
- `scripts/e2e/survey-e2e-harness.mjs` とローカルの `npm run dev`: 環境変数を直接渡す。変更なし。

### survey-run skill の 2 つの複製（`.claude` と `.agents`）

- **Context**: `survey-run` skill は `.claude/skills/survey-run/SKILL.md` と `.agents/skills/survey-run/SKILL.md` の 2 つにある。アンケートは Codex でも作られ、Codex は `.agents` の複製を読む。
- **Sources Consulted**: 両ファイルの内容（2026-11-16 時点）。`docs/DEVELOP.md` 3.2（`.agents/skills/survey-run/` を Codex 用に挙げる記述）。
- **Findings**:
  - `.agents` の複製は既に `--env` を持たない古い版で、古いステージ名・タイトルと説明のまま残っている。
  - このまま残すと、Codex で作ったアンケートが、この spec の規則（6 コマンドの `--env` 必須、環境ごとの独立、1 環境の目録だけで決まる登録・除去）に沿わない手順で操作される。CLI の `--env` 必須（args.ts）は使い方の失敗として止めるため、取り違えの書き込みは起きないが、手順が古いままになる。
- **Decision（2026-11-16、利用者の決定）**: `.agents/skills/survey-run/SKILL.md` をこの spec の対象に含める。古い内容を個別に直さず、`.claude` の複製を更新した後、そのファイル全体で `.agents` の複製を置き換え、2 つを byte 単位で同一にする。
  - 同一性は、新規のテスト `tests/unit/scripts/surveyRunSkillCopies.test.ts`（両ファイルを読み、内容が一致することを検査）で守る。複製が再び食い違わないようにするため。
  - `docs/DEVELOP.md` 3.2 の `.agents/skills/survey-run/` の記述（Codex 用）は、この複製が同じ内容になるため、そのまま正しい。
- **Rejected alternative**: 「`.agents` の複製は `ops-agent-setup` の brief が決めるため、この spec では変えず後続作業にする」。却下の理由: `ops-agent-setup` の扱いが未定のまま、Codex が古い手順でアンケートを作る状態が続く。また、この spec の完了後も 2 つの複製が食い違ったままになり、環境の規則が Codex の操作に届かない。`.agents` だけを後で直す案も、同じ食い違いを生むため採らない。
- **Implications**: Boundary Commitments の This Spec Owns に複製の同一性を入れ、Out of Boundary から `.agents` を外す。Open Questions / Risks で複製の扱いを後に回していた項目は削除する（その項目は最後だったため、残りの項目の番号は変わらない）。

## Architecture Pattern Evaluation

| Option                                           | Description                                             | Strengths                                                              | Risks / Limitations                                                      | Notes        |
| ------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------ |
| GitHub Environments（採用。利用者の決定）        | 環境ごとの変数 `SURVEY_CONFIG`、ジョブの `environment:` | 変数名が同じでワークフローの参照式が変わらない。ブランチの制限が使える | 環境の変数が無いとリポジトリ変数に代わる。移行の順序が必要               | 要件 1・3・6 |
| リポジトリ変数を 2 つ（`SURVEY_CONFIG_DEVELOP`） | 名前で分ける                                            | 環境の作成が不要                                                       | ワークフローの参照式の分岐が要る。ブランチの制限がない（利用者が不採用） | 不採用       |
| CLI を両環境の突き合わせのまま残す               | 設定を共有のままにし、環境を指定しない                  | 変更が小さい                                                           | develop の試験が本番のビルドに載る問題が解けない                         | 不採用       |

## Design Decisions

### Decision: 設定の読みは `gh api`、書き・削除は `gh variable --env`

- **Context**: 環境の変数の 3 操作の方法。
- **Alternatives Considered**:
  1. 全部 `gh api`（`POST`/`PATCH`/`DELETE` と `--input -`）— パスが一貫するが、新規は `POST`、既存は `PATCH` の使い分け（409 の処理）が要り、コードが増える。
  2. 読みも `gh variable get --env` — 標準出力の扱いが現行の応答の検証（`value` の取り出し）と変わり、既存のテストの形が崩れる。
  3. 現行の組み合わせにパスと `--env` だけを足す（採用）。
- **Selected Approach**: 3。
- **Rationale**: 値を標準入力で渡す現行の性質、`HTTP 404` による分類、既存のテストを保てる。
- **制約**: `gh variable set` の標準エラーの `HTTP 404` に依存するが、未作成の環境での応答は 2026-11-17 に実機で確認済みである。
- **確認後の判断**: 設計どおり標準エラーで分類し、事前確認は追加しない。既存の環境への新規登録と既存値の上書きも成功を確認済みである。

### Decision: 環境未作成の書き込みを専用の種類にする

- **Context**: 要件 3.4 は固定の文言を求める。
- **Alternatives Considered**:
  1. 既存の `unavailable` に混ぜる — 原因が分からず、運用者が環境を作る手がかりを失う。
  2. 専用の種類 `no-environment`（採用）。
- **Selected Approach**: 2。固定の 1 行に DEVELOP.md 6.2.1 への案内を添える。
- **Trade-offs**: `RemoteErrorKind` が増え、`failure` の分岐が 1 つ増える。

### Decision: 除去の判断を `ReadonlySet<string>` に単純化する

- **Context**: 両環境の突き合わせをやめる。
- **Alternatives Considered**: 環境つきの `Record` を残して 1 要素だけ使う — 不要な型が残り、取り違えの余地が残る。
- **Selected Approach**: 集合 1 つを渡す。`pending` を持つ型を削除する。
- **Trade-offs**: 結果の行の `not-aggregated: <env>` は、cli が指定した環境の名前を使って作る。

### Decision: DEVELOP.md の置き場所は 6.2 の小節 6.2.1

- **Context**: 環境の作成・移行の手順を、`docs/DEVELOP.md` のどこに書くか。
- **Alternatives Considered**:
  1. 節の末尾（6.9 の後ろ）に新しい節として足す — 6.9「push では登録しない（決定 2026-10-31）」が節の締めの決定の記録のため、その後ろに手順を置くと場違いになる。
  2. 6.2 の小節 6.2.1（採用）。6.2 は「運営者の値（GitHub の Variables）」で、`SURVEY_CONFIG` の行が既にあるため、環境の変数の説明が同じ場所に集まる。
- **Selected Approach**: 2。6.2 の表の `SURVEY_CONFIG` 行を環境の変数として書き、6.2.1 に環境の作成・管理・移行・警告を書く。固定の文言（`no-environment`）と design.md の参照はすべて 6.2.1 を指す。

### Decision: ワークフローの検査は文字列の照合にする

- **Context**: 構造の検査に YAML の解析の依存がない。
- **採用する方法**: 既存の `privacyDates.test.ts` と同じく、ファイルを文字列で読む。環境の選択、両ワークフローの門番と環境指定の不在、`needs:`、同じジョブ条件、門番の空の権限、拒否ステップの条件・固定文・失敗を検査する。値の参照は門番のステップの `if:` と `Run build` の `env:` だけに許し、検証・E2E への非参照、既存の `on:`・ビルドするジョブの `if:` の不変も確かめる。
- **Trade-offs**: GitHub 側の実在・制限は確かめられない（人が行う確認）。

## Risks & Mitigations

- 共有の設定への逆戻り — 環境なしの門番がリポジトリ・組織の設定を検出し、固定文で失敗する。ビルドするジョブは門番の成功を待つ。門番の不在・環境指定・待ち合わせの欠落は静的な検査で検出する。
- 移行順序の取り違え — production の登録と一致確認、develop の環境作成と旧データの削除、共有の設定の削除を済ませてから、新しいワークフローと CLI を develop に取り込む。削除から取り込みまで develop にアンケート機能が載らないことは許容する。
- develop の削除対象の取り違え — 運用者が対象を `skyshare-survey-results-develop` と確認し、目録・結果・可視フラグだけを削除する。本番の設定と `skyshare-survey-results` は対象にしない。
- 権限不足が 404 で隠れる可能性 — 項目 3 の積み残しとする。認証の確認に `gh auth status` を含め、書き込みの固定文で環境の作成と権限の確認を案内する。
- 実際の `release/**` での制限の一致 — 項目 5 の積み残しとし、初回リリースの手動起動で確認する。`dev/**` の実ブランチとの一致は確認済みである。
- 環境の自動作成 — 環境を参照するジョブは未作成の環境を制限なしで作ることを確認済みである。両環境と制限を取り込み前に作る。ジョブの `if:` で飛ばされた場合は環境も配備の記録も作られない。
- 環境の制限に一致しないブランチ — ジョブ全体が失敗し、ステップは実行されず、配備の記録が残ることを確認済みである。ジョブ実行後にプレビュー名の判定でステップを飛ばす場合と区別する。
- 設定の大きさ — 上限は確認済みの 48,000 バイトとし、超過を登録前に拒否する。UTF-8 のバイト数で判定し、複数バイト文字も実際の大きさで扱う。KB 表示は 1 KB = 1000 バイトとする。
- 古い `dev/**` のプレビューの失敗・アンケートの欠けは許容し、古いブランチの再実行や停止位置ごとの再開手順は対応しない。
- 後続の `ops-agent-setup` が `.agents/skills/survey-run/` を削除するときは、複製の一致を検査する `surveyRunSkillCopies.test.ts` も同時に削除する。

## 実機の確認（2026-11-17）

使い捨ての環境・ブランチ（API で作成した履歴なしのブランチと確認用ワークフロー）で、`release/**`・`main`・`develop` に触れずに確かめた。確認後に環境・ブランチ・変数・実行履歴をすべて削除した。結果は design.md の Open Questions / Risks（項目 1〜9）に記録した。

- 未作成の環境への読み・書き・削除は、すべて `HTTP 404`（項目 1・2）。
- 環境の変数の上限は 48,000 バイト（項目 6。従来の `48 * 1024`、つまり 49,152 バイトではない。この spec の KB 表示は 1 KB = 1000 バイトとする）。
- 存在しない環境名のジョブは環境を自動で作る（制限なし）。`if:` で飛ばされたジョブは作らない（項目 4・7）。
- 制限に一致しないブランチのジョブは全体が失敗する。`dev/**` は一致する（項目 5・8）。
- 環境に変数があれば環境の値、無ければ同名のリポジトリ変数が使われる（フォールバックの実機確認）。

## 追加の確認と事前作業（2026-11-18 時点）

- 既存の環境の変数への上書きも成功を確認済みである。
- 環境なしのジョブには環境の変数が見えず、リポジトリ・組織の変数だけが見えることを確認済みである。門番はこの性質を使う。
- production 環境を作成し、配備ブランチを `release/**` に制限し、現在の設定を登録した。リポジトリ変数とのハッシュによる一致確認まで済んでいる。本文とハッシュの実値は記録しない。
- 本番の結果バケット `skyshare-survey-results` は 2026-11-18 に作成済みで、空である。本番にはアンケート機能をまだ配備していない。
- 存在しない R2 キーの標準エラーは、develop で 2026-11-16 に `R2_KEY_MISSING_PHRASE` と一致を確認済みである（`.kiro/specs/survey-operations/tasks.md` の実機の確認記録）。本番では実装の最初に `status --env production` が目録なしを空として扱うことを確認する。
- リリース時の積み残しは、design.md の項目 3（権限不足時の応答）と項目 5（実際の本番ブランチの制限）の 2 つだけである。

## References

- `.kiro/specs/survey-env-config/requirements.md`・`brief.md` — 要件と決定
- `.kiro/specs/survey-operations/design.md`（Decision 6 ほか）— 置き換える記述
- `hack/survey-cli/remote.ts` — 現行の設定の読み書きと失敗の分類
- GitHub Docs（環境、環境の変数、REST API の環境の変数）— この作業では参照していない。実装時に確認する。
