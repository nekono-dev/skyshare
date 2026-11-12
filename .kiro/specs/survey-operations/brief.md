# Brief: survey-operations

## Problem

アンケートの運用（登録・状態確認・期限切れの除去）は、現行の CLI（`hack/survey-cli`、`npm run survey`）と `survey-run` skill に分かれている。結果の公表が加わると、公開の切り替えが要り、さらに「回答の削除は Worker が行う」ため、現行の除去の判定（D1 の行の有無）が意味を失う。運用者が状態を一目で把握し、安全に操作できる体系に見直す必要がある。

## Current State

- CLI: `hack/survey-cli/{cli,config,lifecycle,remote}.ts`。コマンドは `add --file <パス> [--dry-run]`・`status`・`prune [--dry-run]`。`--repo owner/repo` を取る。出力は固定の 1 行。
- 設定の置き場: GitHub のリポジトリ変数 `SURVEY_CONFIG`（`gh variable`）。CI が配備の前に静的ファイル `public/surveys/index.json` を生成する（`npm run survey:render`）。CI に変数の書き込み権限は与えない。
- 段階: `upcoming`・`active`・`retained`・`expired`（`lifecycle.ts`）。除去は `expired` かつ D1 の本番・develop の 2 表に行が無いものだけ（`remote.ts` が wrangler で SELECT）。
- 手順: `.claude/skills/survey-run/SKILL.md`（聞き取り・翻訳・確認・登録・状態・除去）。`docs/DEVELOP.md` の 3.2 と main への取り込み前の `prune` の手順（243 行付近）。

## Desired Outcome

- コマンドは平坦にそろえる（ユーザーの決定 2026-11-12）: `add`・`status`・`publish <id>`・`unpublish <id>`・`prune`・`remove <id>`。
- `status` は設定の状態と R2 の状態を 1 つの表にし、アンケートごとに 1 つの段階を示す: `upcoming`（開始前）→ `active`（開催中）→ `closed`（終了・集計待ち）→ `hidden`（集計済み・非公開）→ `published`（公開中）。回答 0 件で削除済みのものの段階名は設計で決める。
- `publish`・`unpublish` は R2 の統計ファイルの可視フラグを書き換え、続けて対象環境の配備を起動する（`gh workflow run`。結果ページが静的生成のため、反映に再配備が要る。ユーザーの決定 2026-11-12）。集計前（`closed` 以前）のものは拒否する。
- 配備の起動: `--env develop` は `deploy.yaml` を `develop` ブランチで、`--env production` は最新の `release/*` ブランチで起動し、`dry_run` を偽にして渡す。起動は運用者のローカル認証の `gh` で行い、CI に追加の権限を与えない。対象の `release/*` の決め方（最新の判定）と、配備を起動しない指定（`--no-deploy`）の要否は設計で決める。
- `status` は、可視フラグの状態に加えて、公開の反映が配備待ちかを示せるか設計で決める。
- `prune` は、「終了済みで、R2 に集計済み（または回答 0 件で削除済み）」のアンケートだけを `SURVEY_CONFIG` から除去する（ユーザーの決定 2026-11-12）。D1 の行の確認はやめる。
- `remove <id>` は、運用者が明示的に設定から消す（開始前の取り下げなど）。集計前の開催中・終了済みのものは、結果を失うため警告して拒否する（強制の指定の要否は設計で決める）。
- R2 を扱うコマンド（`status` の R2 の部分・`publish`・`unpublish`・`prune`）は、`--env production|develop` を必須にする（ユーザーの決定 2026-11-12。プレビューは develop と共用）。`add`・`remove` は設定の変数を扱い、環境を分けない。
- `survey-run` skill と `docs/DEVELOP.md` の手順を新しい体系に合わせる。

## Approach

現行の CLI の構造（引数の検証 → 設定の取得 → 変換 → 比較 → 反映、固定の 1 行の出力、秘密や設定本文を出さない）を保ち、R2 の読み書き（`wrangler r2 object` など）の部品を `remote.ts` に足す。段階の判定は純粋関数（時刻と R2 の状態を引数に取る）にする。`prune` の判定を D1 の行から R2 の集計の有無に置き換える。

## Scope

- **In**: コマンド体系（add・status・publish・unpublish・prune・remove）、`status` の段階の定義と表示、R2 の読み書きの部品、`--env` の扱い、`survey-run` skill の更新、`docs/DEVELOP.md` の手順の更新、CLI の置き場の判断（現在の `hack/survey-cli` のままか）、出力の固定と秘密の非表示の規則の維持。
- **Out**: 集計・統計ファイルの形式・Worker の削除（`survey-results-aggregation`）、API・画面（`survey-results-public`）、アンケートの定義の形式（`surveys`）、`survey:render`（設定の静的ファイルの生成）。

## Boundary Candidates

- コマンドの解析と出力（`cli.ts`）
- 設定の操作（`config.ts`: add・remove・prune の変換）
- 段階の判定（`lifecycle.ts`: 設定の期間と R2 の状態から決める純粋関数）
- 外部の操作（`remote.ts`: gh による変数、wrangler による R2）
- 運用の手順書（skill・DEVELOP.md）

## Out of Boundary

- 統計ファイルの形式・集計・削除
- 結果の閲覧の画面

## Upstream / Downstream

- **Upstream**: `survey-results-aggregation`（統計ファイルの形式・R2 のオブジェクトの構成・可視フラグ）、`surveys`（設定の形式 `SurveyConfigSchema`）。
- **Downstream**: なし（運用者と `survey-run` skill が使う）。

## Existing Spec Touchpoints

- **Extends**: `ops-tooling-layout`（`hack/` と `scripts/` の置き方）、`develop-docs`（DEVELOP.md の手順）。
- **Adjacent**: `ops-config-secrets`（設定と秘密の扱い）、`ops-agent-setup`（skill の導入）。

## Constraints

- 出力は固定の 1 行。設定本文・回答・認証情報・外部コマンドの標準エラーを出さない。
- CI に変数の書き込み権限を与えない。変更はすべて運用者のローカルの認証済みの CLI で行う。
- 公開の切り替えは本番を意図せず操作しないよう、`--env` を省略させない。
- 設定から除去する前に、本番と develop の両方で集計済みであることを確かめるか（`--env` が 1 つなので、除去は両環境を確認するかを含めて）設計で決める。
- 既存の `survey-run` の運用の規則（日本語のみの入力・確認前に登録しない・一時ファイルの削除）を保つ。ただし、アンケート全体の題・説明は設定の形式から廃止される（`surveys` の更新）ため、聞き取りと確認表から「タイトル・説明」を外し、質問ごとの題だけにする。
- `status` の表示は、題が無くなるため ID を主にする（必要なら最初の質問の題を補う。設計で決める）。
- アンケート機能は本番へ未公開のため、破壊的変更を許す（利用者の決定 2026-11-12）。運用中の `SURVEY_CONFIG` と D1 は初期状態として扱い、移行の手順は作らない。下書きの形式（`tests/fixtures/survey-operation/drafts/`）を新しい形式に直し、運用中の設定は作り直す（現在の設定の題「Skyshare v1 と v2 どちらの UI が好みか」は、質問の題「UIデザインはどちらが好みですか？」に置き換える。設定の更新は、設定の形式の変更の実装後に CLI で行う）。
- 既存のテスト（`tests/` の CLI のテスト）を、新しい体系に合わせて更新する。
