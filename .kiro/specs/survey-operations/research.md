# Research & Design Decisions

## Summary

- **Feature**: `survey-operations`
- **Discovery Scope**: Extension（既存の `hack/survey-cli` の作り直し。新しい外部ライブラリは使わない）
- **Key Findings**:
  - 現行の CLI は `cli.ts`（引数と流れ）・`config.ts`（設定の変換）・`lifecycle.ts`（段階の判定と除去の判定）・`remote.ts`（`gh` と `wrangler` の呼び出し）に分かれ、依存を差し込める（`SurveyRemote`・時刻・ファイル読み込み）。この構造を保てば、外部ツールなしで流れをテストできる。
  - 現行の `lifecycle.ts` は `@/lib/survey/period` の `retentionExpired` に依存し、`remote.ts` は `wrangler d1 execute` で回答の行を読む。どちらも `survey-results-aggregation` が廃止するため、段階の判定と除去の判定を作り直す必要がある。`survey-results-aggregation` の tasks 3.5 は、この CLI から `retentionExpired` の参照が消えるまで待ち状態になる。
  - ブリーフが言う「CLI のテスト」と「下書きの固定データ `tests/fixtures/survey-operation/drafts/`」は、いまのリポジトリに無い（git の履歴にだけある。test-foundation で `tests/` を作り直したときに消えた）。`survey-run` skill は存在しない `tests/fixtures/survey-operation/drafts/without-id.json` を参照している。更新するのではなく、新しく作る。
  - `.kiro/steering/testing.md` は `scripts/`（運用ツール）をテストの対象外とし、`tests/unit/` の配置も `src/` に対応する形しか書いていない。`hack/` は未言及。`tsconfig.json` の `include` にも `hack/` が無く、`npm run test:type` は `hack/` を直接は見ない。
  - `wrangler r2 object get|put|delete` がある（`--remote` で実際のバケット、`--file` でファイル、`--content-type`）。`list` は無いが、目録 `index.json` を読めばよい。wrangler 4.147.0 で確認。
  - `gh workflow run <ファイル> --ref <ブランチ> -f dry_run=false -R <repo>` で `workflow_dispatch` を起動できる。`deploy.yaml` の入力は `dry_run`（真偽。既定は真）だけで、`release/**` と `develop` 以外の参照では `deploy` ジョブが動かない。同時実行の制御は環境ごと（`develop` と本番）で直列化され、`cancel-in-progress: false`。
  - リリースブランチの名前に決まった方式は無い（`release/XXX`。DEVELOP.md は「新しい名前でリリースを切る」とだけ書く）。ブランチ名の並べ替えでは最新を決められない。
  - 設定 `SURVEY_CONFIG` は 1 つで、本番・develop・プレビューのビルドがすべて読む（DEVELOP.md 3.2）。結果の保管先は環境ごとに別で、設定から外したアンケートは、集計前なら Worker に集計されず回答が D1 に孤立する（`survey-results-aggregation` の research.md に記録済み）。
    > 2026-11-18 追補: survey-env-config が置き換え。現在の設定は GitHub Environments の `production`・`develop` の環境ごとの変数で、六つのコマンドすべてに `--env` が必須。共有設定（リポジトリ変数）は門番が拒否する。現在の規則は `.kiro/specs/survey-env-config/requirements.md`・`design.md` に従う。

## Research Log

### 現行の CLI の構造と依存

- **Context**: 作り直しの範囲を決める。
- **Sources Consulted**: `hack/survey-cli/{cli,config,lifecycle,remote}.ts`、`package.json`（`survey` スクリプトは `tsx ./hack/survey-cli/cli.ts`）、`scripts/lib/{github,jsonc}.mjs`。
- **Findings**:
  - `cli.ts` は、引数の解析 → 設定の取得 → 変換 → 反映 → 固定の 1 行の流れで、失敗は `RemoteError` の種類（`auth`・`unavailable`・`parse`）を固定の文言に変える。
  - `config.ts` の `canonicalSurvey` は `title`・`description` を列挙している。設定の形式の変更（`surveys`）で型エラーになるため、同時に直す。
  - `remote.ts` は D1 のデータベース名をテンプレートから読む（`parseDatabaseNames`）。同じ手で R2 のバケット名を読める。
- **Implications**: 構造は保ち、`lifecycle.ts` と `remote.ts` の D1 の部分を置き換える。引数の解析が増えるため `args.ts` に分ける。

### 結果の保管先の読み書きの手段

- **Context**: CLI から R2 を読み書きする方法。
- **Findings**:
  - 候補は (1) `wrangler r2 object`、(2) Cloudflare の API を直接呼ぶ、(3) S3 互換の API。(2)(3) は新しい認証情報（トークン・アクセスキー）を CLI に渡す必要があり、運用者の手元の `wrangler` のログインで済む (1) のほうが追加の秘密が無い。
  - `--file` を使えば標準出力に出る案内文と本文が混ざらない。一時ディレクトリへ書いて読み、すぐ消す。
  - 存在しないキーは終了コードが非ゼロで、標準エラーに「存在しない」旨が出る。ここだけは「無い」として扱い、それ以外の失敗は利用できないとして扱う。
- **Implications**: `wrangler r2 object get|put` を採用。標準エラーの内容は結果に出さない（既存の規則）。「無い」の判定は標準エラーの語句で行うが、判定にだけ使い、出力しない。

### 最新のリリースブランチの決め方

- **Context**: `--env production` で、どのブランチの配備を起動するか。
- **Options**:
  1. ブランチ名を並べ替える。決まった方式が無く、`release/10` と `release/9` のような名前で誤る。却下。
  2. 最後に更新されたもの（先頭のコミットの日時が最新）。本番へ出した最後のブランチを指し、DEVELOP.md の「古いリリースへの再 push で巻き戻さないよう、新しい名前でリリースを切る」とも合う。採用。
  3. 本番の配備履歴から取る。配備が成功した履歴に依存し、初回の本番前や失敗が続くときに決められない。却下。
- **Findings**: `gh api repos/<repo>/git/matching-refs/heads/release/` でブランチと先頭のコミットを得て、`gh api repos/<repo>/commits/<sha>` の `commit.committer.date` を比べる。同時刻は名前の降順で決める。ブランチの数は少ない前提（本番へ出すたびに 1 本増える程度）。
- **Implications**: 「最新」を決める関数は純粋にし（ブランチ名と日時の配列を受ける）、テストで同時刻・1 本・0 本を押さえる。

### 反映待ちを `status` に出せるか

- **Context**: ブリーフが設計に委ねた項目。
- **Findings**: 可視フラグの形式（`survey-results-aggregation` が所有）は版と真偽だけで、書き換えの時刻を持たない。R2 のオブジェクトの更新時刻は `wrangler r2 object get` では得られない。配備の履歴（`gh run list`）から最後の成功時刻は取れるが、「公開を書いた時刻」が無いので比べられない。
- **Implications**: 反映待ちの表示は作らない。形式を変えて時刻を足す案は、`survey-results-aggregation` の承認済みの形式を動かすことになり、この spec では扱わない。代わりに、`publish`・`unpublish` の結果に「配備を起動した（またはしなかった）」を必ず示し、手順書で配備の完了と画面の確認を運用者に案内する。再実行で配備だけを起動し直せる（要件 5.5, 5.6）。

### 識別子と同時実施数の決定（2026-11-13）

- 新規登録は ID の無い下書きだけで、UUID v4 を自動発行する。ID のある下書きは設定済みのアンケートの更新だけに使い、未知の ID は `not-found` として追加しない。月ごとの連番、運用者が決める新規 ID、内容一致による既存 ID の探索は採用しない。
- 同時に 1 件だけを実施する。新規登録の前に、設定内の各 ID が本番・develop 両方の目録にあることを確かめる。開始前のアンケートも登録を止める。設定に残る集計済みの過去分は止めない。D1 には問い合わせない。取得失敗・形式不正なら dry-run でも失敗し、存在しない目録キーだけは空として扱う。
  > 2026-11-18 追補: survey-env-config が置き換え。現在の新規登録可否は指定環境の設定と目録だけで判断する。六つのコマンドすべてに `--env` を必須とし、共有設定は門番が拒否する。現在の規則は `.kiro/specs/survey-env-config/requirements.md`・`design.md` に従う。
- 目録を使った ID 再利用の拒否、両環境の目録をまとめた使用済み ID 集合、自動採番、`entryMatchesSurvey` による ID・開始・終了日時の一致判定は廃止した。開始前に取り下げた ID は目録に残らないが、ID がランダムなので再利用の追跡は不要である。`survey-results-aggregation` にも ID 再利用に備える専用規則を求めない。
- 締切は実在する日付だけを受け付け、日本時間 0 時に変換する。開催中に取り下げる場合、前倒し先は開始日時より後の最も早い日本時間 0 時。当日開始なら翌日 0 時まで待つ。

### `prune` と `remove` の環境の扱い

- **Context**: ブリーフの決定は R2 を扱うコマンドに `--env` を必須とするが、除去は 1 つの設定の変数を触る。
- **Findings**: 設定は両環境が読む。集計は環境ごとの Worker が設定を見て行うので、一方の環境で集計済みでも、もう一方で未集計のまま設定から外すと、その環境の回答は孤立し、二度と集計されない。`--env` を 1 つ取ると、もう一方の確認が運用者の手順に残り、取りこぼせる。
- **Implications**: `prune`・`remove` は `--env` を取らず、常に両方の目録を読んで判断する。書き込みは設定の変数だけで、R2 は読むだけである。「本番を意図せず操作しない」というこの規則の目的は、R2 を書き換える `publish`・`unpublish` の `--env` 必須で守られる。ユーザーの決定（R2 を扱うコマンドは `--env` 必須）からの調整であり、理由を design.md の Decision 6 に書いた。この調整は 2026-11-13 にユーザーが確認し、決定済みである。
  > 2026-11-18 追補: survey-env-config が置き換え。現在は六つのコマンドすべてで `--env` を必須とし、`prune`・`remove` の除去判断と設定更新は指定環境だけで完結する。環境指定なしで両環境を照合する決定は置き換わった。現在の規則は `.kiro/specs/survey-env-config/requirements.md`・`design.md` に従う。

## Architecture Pattern Evaluation

| Option                                       | Description                                                            | Strengths                                                        | Risks / Limitations                                                                                      | Notes                               |
| -------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| A. 現行の 4 ファイルを保って作り直す（採用） | `cli.ts`・`config.ts`・`lifecycle.ts`・`remote.ts` に `args.ts` を足す | 差分が読みやすい。依存を差し込めて、外部ツールなしでテストできる | `cli.ts` が長くなる                                                                                      | 引数の解析を `args.ts` に出して緩和 |
| B. `scripts/survey/` へ移す                  | 自動化の資材として置く                                                 | 場所の規則が単純                                                 | `ops-tooling-layout` の改訂（2026-10-31）で、手作業のツールは `hack/` と決めた。配備の起動もすべて手作業 | 却下                                |
| C. コマンドごとにファイルを分ける            | `commands/publish.ts` など                                             | コマンドの追加が楽                                               | 6 つの小さなコマンドに対して過剰。共通の前処理（設定の読み込み・失敗の変換）が散る                       | 却下                                |

## Design Decisions

詳細は design.md の「Design Decisions」。ここでは、実装の前に確かめた事実と、実装後に確かめる未検証の項目を分けて記録する。

### 実装後に確かめる項目（未検証）

- 存在しないキーを `wrangler r2 object get` したときの標準エラーの実際の語句（4.147.0 では未確認）。誤判定すると、未集計と誤って扱い、除去を誤って拒否または状態を誤表示する。実バケットで確認し、判定に使う固定の語句をここに記録する。
- 実際のバケットでの `wrangler r2 object get|put --remote` の動作（存在しないキーの終了コードと標準エラーの語句、`--file` の挙動）。バケットは `survey-results-aggregation` の実装後にできるため、この spec の検証では偽の外部ツール（差し込んだ実行関数）で振る舞いを確かめ、実機は tasks の最後の確認で行う。
- `gh workflow run` の起動（`develop`）。`dry_run=false` で実際に配備が走るため、実機の確認は develop の環境だけで行う。
- 本番側の `--ref` に使う `release/*` の選択は、実在のブランチが現れてから確かめる（いまは本番のブランチが無い）。

## Risks & Mitigations

- 設定の形式の変更（`surveys`）より先に CLI の設定の変換を直すと型エラーになる — tasks で `surveys` の完了を前提に置く。段階の判定と R2 の部品は先に作れる（形式に依存しない）。
- `survey-results-aggregation` の tasks 3.5 が、この CLI の `retentionExpired` の参照の除去を待つ — 段階の判定の作り直しを早い段階に置く。
- 一方の環境の R2 が使えない状況（バケット未作成など）では、`prune`・`remove` が進まない — 使える環境がそろうまで進まないのは安全側の動作で、結果を失わないことを優先する。
  > 2026-11-18 追補: survey-env-config が置き換え。現在は `prune`・`remove` が指定環境の目録だけを読むため、他方の環境の R2 の利用可否は除去を妨げない。指定環境の目録の取得失敗・形式不正では何も除去せず拒否または失敗する。現在の規則は `.kiro/specs/survey-env-config/requirements.md`（2.3・5.x）に従う。
- 本番の最新のリリースブランチの取り違え — 純粋関数でテストし、`--dry-run` で起動先のブランチを確認できる。

## 2026-11-28: トークンによる再配備とアカウントの決定

### 参照した資料

- `requirements.md` の 1.8・5.9・9.18・11.1–11.8・12.1–12.12、`brief.md` 末尾の discovery 追補、既存の `design.md`。
- `hack/survey-cli/{cli,remote,args,lifecycle}.ts`、既存の単体テストの配置、`docs/DEVELOP.md`、`survey-run` skill、`.github/workflows/deploy.yaml`、構造・コメントの steering。
- [GitHub workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event): workflow ファイル名で POST でき、ref と inputs を渡す。必要な fine-grained 権限は Actions の書き込み。今回の契約は実行詳細を要求しない 204 の応答とする。
- [GitHub matching refs](https://docs.github.com/en/rest/git/refs#list-matching-references) と [コミット取得](https://docs.github.com/en/rest/commits/commits#get-a-commit): 起動先取得に Contents の読み取りを使う。公開リソースの無認証取得が可能でも、その前提に依存しない。
- [Wrangler whoami](https://developers.cloudflare.com/workers/wrangler/commands/general/#whoami): 一覧取得の手段として参照した。`wrangler whoami --json` が `{loggedIn, authType, accounts:[{id,name,...}]}` を返すことは、設計時に実機（wrangler 4.147.0、OAuth ログイン）で確認した。

### ローカルで確認できたことと未検証のこと

- `deploy.yaml` は GitHub Actions のビルドで結果を静的生成し、対象ブランチと `dry_run` によって配備を制御している。Cloudflare API だけに置き換えるとこのビルドを経由しない。
- `remote.ts` の `RunCommand` は既に第 4 引数の `options.env` を持ち、`runLocal` はその環境で子プロセスを実行する。ID を含む環境全体を渡せば型の変更は不要である。
- 現在の `RemoteErrorKind` には `no-environment` もある。既存設計の「3 種」だけに合わせて削除せず、HTTP は既存の auth・unavailable・parse を使う。
- `cli.ts` の末尾は、成功の結果を stdout、失敗の結果を stderr に出す。この出力先は変えない。質問・一覧・記録通知は stderr に出し、結果の一行とは別にする（要件 12.10）。
- 認証の固定文（`gh または wrangler の認証が必要`）を直接検査する既存テストは無い（`cli.test.ts` は `^error: (auth|unavailable|invalid):` の正規表現と kind の網羅だけ）ため、新しい固定文の完全一致のテストを追加する。一方、配備失敗の旧文言（`error: deploy: 可視フラグは保存済み。同じコマンドの再実行で配備だけを起動できる`）を完全一致で検査する既存テスト（`tests/unit/hack/survey-cli/cli.test.ts` の 1083 行付近）は、新しい文言に更新する。文言を変えるのは、認証・利用不能・応答不正を区別し、トークン経路でも成り立たせるための実装上の決定で、要件 1.9 の『固定の文言』の範囲内とする。
- DEVELOP.md 1.1 は `.dev.vars` が新しい worktree・clone に含まれないことを示している。記録先は各作業ツリーに限定する。
- docs と workflow から GitHub リポジトリの公開設定は確定できなかった。非公開でも動く権限を文書化する。
- 今回の設計では実際の dispatch を実行していない。REST の対象リポジトリでの受理と、トークンの権限の十分性は実装後の実機確認（タスク 4.2 の延長）で確かめる。`.dev.vars` の中身と認証情報は読んでいない。

### 決定と残るリスク

- 専用変数は `SURVEY_DEPLOY_TOKEN`、HTTP は Node 22 の標準 fetch。gh が読む汎用変数との混同と、認証失敗後の暗黙の切り替えを防ぐ。
- ブリーフ末尾の「選んだ ID を保存しない」という候補は、要件 12.7 と今回の利用者の決定により置き換える。対話で選んだ ID だけを操作成功後に記録する。
- 指定 ID での読み取り成功は、その後の権限変更・通信障害・書き込み権限を保証しない。外部操作に失敗したらローカル記録は行わず、完了済みの変更がある場合は固定文で示す。
- 外部操作とローカル記録は不可分ではない。記録だけが失敗した場合を専用の固定文で示す。同じ作業ツリーの操作・設定編集は直列実行を前提とする。
- 参照取得後のブランチ変更、API の権限・版・応答、whoami の JSON、workflow の入力、設定ファイルの管理方法が変わった場合は設計を再確認する。自動テストは偽の run・fetch・prompt・TTY・ファイル操作だけを使う。

### レビューでの決定

- トークン経路の 404 は auth とする（fine-grained PAT は権限がない場合に 404 を返すため）。
- トークンは `remote.ts` と `runLocal` の二重で子プロセス環境から除去する。
- storage を read/write に分けた。
- 配備失敗の旧文言を完全一致で検査する既存テストを新しい文言へ更新する。
