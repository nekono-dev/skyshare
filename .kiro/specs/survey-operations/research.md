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

### `prune` と `remove` の環境の扱い

- **Context**: ブリーフの決定は R2 を扱うコマンドに `--env` を必須とするが、除去は 1 つの設定の変数を触る。
- **Findings**: 設定は両環境が読む。集計は環境ごとの Worker が設定を見て行うので、一方の環境で集計済みでも、もう一方で未集計のまま設定から外すと、その環境の回答は孤立し、二度と集計されない。`--env` を 1 つ取ると、もう一方の確認が運用者の手順に残り、取りこぼせる。
- **Implications**: `prune`・`remove` は `--env` を取らず、常に両方の目録を読んで判断する。書き込みは設定の変数だけで、R2 は読むだけである。「本番を意図せず操作しない」というこの規則の目的は、R2 を書き換える `publish`・`unpublish` の `--env` 必須で守られる。ユーザーの決定（R2 を扱うコマンドは `--env` 必須）からの調整であり、理由を design.md の Decision 6 に書いた。この調整は 2026-11-13 にユーザーが確認し、決定済みである。

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
- 本番の最新のリリースブランチの取り違え — 純粋関数でテストし、`--dry-run` で起動先のブランチを確認できる。
