# Research & Design Decisions

## Summary

- **Feature**: `survey-env-config`
- **Discovery Scope**: Extension（既存の運用 CLI とワークフローの拡張。軽い調査）
- **Key Findings**:
  - 両環境の突き合わせは `cli.ts` の `readIndexes` と `lifecycle.ts` の `AggregatedByEnv` などにだけある。`config.ts` は環境を知らず、変更は要らない。
  - `SURVEY_CONFIG` を読むのは `deploy.yaml`・`preview.yaml` の `Run build` のステップの `env:` だけで、ワークフロー直下の `env:` に無い。環境の変数はジョブの `environment:` を付ければ、参照式を変えずに読める。`verify.yaml`・`e2e.yaml` は参照しない。
  - `render-survey-config.ts`・`sync-github-variables.mjs`（`MANAGED_ELSEWHERE` に `SURVEY_CONFIG`）・ローカルの `npm run dev`・E2E のハーネスは、変更が要らない。
  - GitHub 側の挙動（404 の応答、デプロイブランチの `dev/**` の一致、環境の自動作成）は、この環境では確かめられていない。リスクと代替を設計に残した。

## Research Log

### 環境の変数の読み書きの方法

- **Context**: `remote.ts` の設定の読み書きを、リポジトリ変数から環境の変数へ変える。
- **Sources Consulted**: `hack/survey-cli/remote.ts`、`tests/unit/hack/survey-cli/remote.test.ts`、GitHub REST API の環境の変数（`repos/{repo}/environments/{env}/variables/{name}`。公式の文書は、この作業では参照していない）。
- **Findings**:
  - 現行は、読みが `gh api repos/<repo>/actions/variables/SURVEY_CONFIG`、書き・削除が `gh variable set|delete SURVEY_CONFIG -R <repo>`（値は標準入力）。404 は標準エラーの `HTTP 404` の照合で分類している。
  - 環境の変数のパスは `repos/<repo>/environments/<env>/variables/SURVEY_CONFIG`。`gh variable set|delete` は `--env <環境>` でこれを指す。
- **Implications**: パスと `--env` の追加だけで、既存の分類・テストの形を保てる。

### 404 の解釈

- **Context**: 環境が無い、変数が無い、のどちらも 404 になると考えられる。
- **Findings**:
  - 読み: どちらも空の設定でよい（要件 3.3・3.5）。区別は不要。
  - 削除: どちらも「既に無い」でよい。
  - 書き込み: 環境が無いと書けない（要件 3.4）。環境が有って変数が無い場合の新規作成は 404 にならない想定のため、書き込みの 404 は環境の未作成と解釈する。
  - 外部の文言は出力しない規則があるため、標準エラーの `HTTP 404` の照合だけで種類を決め、固定の文言で返す。
- **Implications**: `RemoteErrorKind` に `no-environment` を足し、書き込みの 404 だけを割り当てる。`gh variable set` の失敗時の標準エラーに `HTTP 404` が含まれるかは未確認。含まれなければ `unavailable` になり、書き込みは行われないが固定の文言が変わる。その場合は、書き込みの前に `gh api repos/<repo>/environments/<env>`（200 か 404）で環境の有無を確かめる方式に切り替える。実装の最初のステップ（受け入れの前提）で、未作成の環境に対して確かめる（design.md の Open Questions / Risks の項目 1・2）。

### ワークフローの環境の選択

- **Context**: `deploy.yaml` は `release/**` と `develop` の両方で動く。`preview.yaml` は `dev/**`。
- **Sources Consulted**: `.github/workflows/{deploy,preview,verify,e2e}.yaml`。
- **Findings**:
  - `environment:` は `jobs.<id>.environment` に式で書ける（`github.ref_name` など）。既存の `concurrency.group`・`TARGET_FLAG` が同じ式を使っている。
  - `deploy` ジョブの `if:` は `release/**` と `develop` だけを通す。`environment:` を付けても `if:` は変わらない。
  - `verify`・`e2e` は `uses:` による再利用ワークフローの呼び出しで、`environment:` を付けない。
  - 環境の変数は、ワークフロー直下の `env:` では読めず、`environment:` を付けたジョブの中で読める。`SURVEY_CONFIG` はステップの `env:` で渡しているため、参照式はそのまま使える。
  - 環境に変数が無いと、同名のリポジトリ変数に代わる（ユーザーの決定の前提）。
- **Implications**: 変更は `environment:` の 1 行ずつ。ワークフローの構造は、YAML の構文解析の依存が無いため、文字列で照合する静的な検査にする（既存の `privacyDates.test.ts` と同じ方式）。

### 環境のデプロイブランチの制限

- **Context**: `develop` の環境に `develop` と `dev/**`、`production` の環境に `release/**` を許す。
- **Findings**:
  - GitHub の環境の制限の名前のパターンは、`/` の扱いに注意が要る（`*` は `/` に一致しない旨の記述を見た記憶があるが、確かめていない）。`dev/**` が `dev/foo` に一致するかは未確認。
  - プレビューのブランチ名は `dev/XXXX`（1 階層。`preview.yaml` の判定で保証）で、リリースのブランチも `release/<名前>` の 1 階層が現実的なため、`dev/*`・`release/*` でも足りる可能性がある。
- **Implications**: 利用者の決定（`dev/**`）を第一案にし、環境の作成後にプレビューを 1 回動かして確かめる。一致しなければ `dev/*` に変えて再確認し、それでも使えなければ `develop` の環境の制限を外す。

### 移行（共有の設定から環境の設定へ）

- **Context**: 既存の設定は、識別子・開始日時が決まった完成した JSON で、`add --file` の下書き（1 件ずつ・識別子は自動採番）では移せない。
- **Findings**: 退避した本文を環境の変数へそのまま書く直接の操作が要る。専用 CLI 以外で直接書き換えない原則（`survey-operations`）の例外にする（要件 7.6 が許す）。書いた後は `status --env production` が、環境の設定を CLI の検証で読むことで確認になる。
- **Implications**: 手順（退避・作成・登録・共有の削除・確認）を DEVELOP.md の 6.2 の小節 6.2.1 に置く（下の「DEVELOP.md の置き場所」）。共有の削除は登録の後。

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
- **Trade-offs**: `gh variable set` の失敗時の標準エラーの文言に依存する（未確認。代替は 404 の事前確認）。
- **Follow-up**: 実装の最初のステップ（受け入れの前提）で、未作成の環境に対して読み・書き・削除の標準エラーと終了コードを確かめる。書き込みの `HTTP 404` が無ければ、事前確認（`gh api` の環境の有無）に切り替える。

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
- **Selected Approach**: 既存の `privacyDates.test.ts` と同じく、ファイルを文字列で読む。環境の選択の式、`SURVEY_CONFIG` の参照位置（`#` で始まる行を除き、`Run build` の `env:` の中かどうかで判定する）、検証・E2E への非参照、`on:`・`if:` の不変を確かめる。
- **Trade-offs**: GitHub 側の実在・制限は確かめられない（人が行う確認）。

## Risks & Mitigations

- 環境の変数が無い環境でリポジトリ変数に代わる — 移行で共有の設定の削除を、環境の登録の後に置く。`remote.ts` はリポジトリ変数を読まない。手順書に警告を書く（要件 6.2・6.6）。1.4 と 1.5 は、ワークフローでは強制できず、この順序（(d) は、新しいワークフローが develop と最新の release/** に入った後、または本番が未配備のときに行う）と「リポジトリ変数を作り直さない」でだけ成り立つ（design.md の注 1）。
- `dev/**` が `dev/foo` に一致しない — プレビューを 1 回動かして確かめ、`dev/*`、次に制限なしへ下げる。
- `release/**` が `release/foo` に一致しない — `release/*`、次に制限なしへ下げる（運用者に確認してから外す。design.md の項目 5）。
- 読みの 404 と書きの 403 の扱い — 環境が無い 404 と権限不足 403 の応答は未確認（項目 2・3）。権限不足が 404 で隠れると、読みが空に見え「アンケートが無い」と誤認しうる。緩和として、手順書の認証の確認に `gh auth status` を含め、書き込みの失敗の文言に権限の確認を含める。
- 飛ばされたジョブ（`if:` で実行されない）が `environment:` を解決するかは未確認（項目 7）。解決しても配備の記録が残るだけで、ビルドには影響しない。
- `preview.yaml` の `environment: develop` はジョブ単位のため、ブランチ名が不正でステップが飛ばされても環境が解決されて記録が残る。ブランチの制限に合わないとジョブ全体が拒否されるかは未確認（項目 8）。
- 環境の変数の上限は同じ 48 KB と仮定する（項目 6）。
- `gh variable set` の 404 の標準エラーが想定と違う — 書き込みは行われず失敗するだけ。環境の事前確認に切り替える。
- 環境を作る前にワークフローが先に取り込まれる — 環境が自動で作られ制限が無い状態になりうる。環境の作成を先にする。
- 環境の変数の大きさの上限が 48 KB と同じか未確認 — 既存の 48 KB を保ち、超過は `too-large` で拒否する（保守側）。

## References

- `.kiro/specs/survey-env-config/requirements.md`・`brief.md` — 要件と決定
- `.kiro/specs/survey-operations/design.md`（Decision 6 ほか）— 置き換える記述
- `hack/survey-cli/remote.ts` — 現行の設定の読み書きと失敗の分類
- GitHub Docs（環境、環境の変数、REST API の環境の変数）— この作業では参照していない。実装時に確認する。
