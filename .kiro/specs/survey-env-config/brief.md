# Brief: survey-env-config

## Problem

運用者。アンケートの設定（リポジトリ変数 `SURVEY_CONFIG`）が 1 つで、本番と develop のビルドが同じ値を読む。そのため、develop だけで試験用のアンケートを使って確かめる（公開・非公開・集計）ことができず、試験用の設定が本番のビルドにも載ってしまう。`survey-operations` の 4.2（実機の確認）も、集計済みの結果を持つ試験用のアンケートが develop だけに作れないため止まっている。

## Current State

- `SURVEY_CONFIG` はリポジトリ変数 1 つ。`deploy.yaml`（本番・develop）と `preview.yaml`（プレビュー）が同じ値をビルドに渡す。
- CLI（`hack/survey-cli/`）は `status`・`publish`・`unpublish` だけ `--env` を取る。`add` は環境を指定せず、`prune`・`remove` は両環境の目録（R2）を見て共有の設定から除去する。
- GitHub の Environments は未使用（ワークフローに `environment:` の指定が無い）。

## Desired Outcome

- 本番と develop で、アンケートの設定を別々に持てる。develop に試験用のアンケートを置いても、本番のビルドには載らない。
- アンケート設定の作り方（設定の JSON を作って `add --file` で登録する）は変えない。違いは、登録・除去の対象の環境を `--env` で指定することだけ。
- 現在作成済みのアンケートは退避し、本番へ適用する前に作り直せる（作り直しは `survey-operations` 4.2 の担当を引き継ぐ）。

## Approach

GitHub Environments（`production`・`develop`）を作り、同じ名前 `SURVEY_CONFIG` を環境ごとの変数として持つ（利用者の決定 2026-11-16）。

- `deploy.yaml` の配備ジョブに、ブランチに応じた `environment:`（develop ブランチ → `develop`、それ以外 → `production`）を付ける。`preview.yaml` は `develop` を使う。
- CLI の `add`・`prune`・`remove` も `--env` を必須にする（利用者の決定 2026-11-16）。設定が環境ごとに独立するため、除去は自分の環境の目録だけを見て判断し、両環境の目録を突き合わせる処理をなくす。
- 変数の読み書きは `gh variable ... --env <環境>`（API は `repos/<repo>/environments/<環境>/variables/SURVEY_CONFIG`）に変える。

## Scope

- **In**:
  - `deploy.yaml`・`preview.yaml` の `environment:` と、`SURVEY_CONFIG` の参照先。
  - CLI の `add`・`prune`・`remove` の `--env` 必須化と、変数の読み書きの環境指定（`remote.ts`・`cli.ts`・`args.ts`・`lifecycle.ts` の除去の判断）。
  - `survey-run` skill と `docs/DEVELOP.md` の手順（環境の作成、設定の分け方、除去の手順）。
  - `roadmap.md`・`survey-operations` の記述のうち、共有の変数を前提にしているものの追補。
- **Out**:
  - 設定の JSON の形式（`SurveyConfigSchema`）と作り方。
  - 結果の保管先（R2）・集計・公開の仕様（`survey-results-aggregation`・`survey-results-public`）。
  - GitHub Environments の作成・変数の移行の実行そのもの（運用者の作業。手順だけを書く）。

## Boundary Candidates

- ワークフロー側の環境の選択（`deploy.yaml`・`preview.yaml`）。
- CLI 側の環境の指定と変数の読み書き（`hack/survey-cli/`）。
- 運用の手順書（`survey-run` skill・`DEVELOP.md`）。

## Out of Boundary

- 設定の形式・質問の内容の変更。
- 本番のバケットの作成、本番の実機の確認そのもの（`survey-operations` 4.2 と運用者の作業）。
- CI に変数の書き込み権限を与えること（従来どおり、書き込みは運営者のローカルの認証済み CLI だけ）。

## Upstream / Downstream

- **Upstream**: `survey-operations`（CLI の体系・手順書。本 spec が `add`・`prune`・`remove` の契約と、共有の変数を前提にした記述を改める）、`survey-results-aggregation`（目録の読み取り。形式は変えない）。
- **Downstream**: `survey-operations` 4.2（試験用のアンケートを develop だけに作って公開・非公開・配備の起動を確かめる）。本番へ適用する前の設定の作り直し。

## Existing Spec Touchpoints

- **Extends**: `survey-operations`（要件の「prune・remove は設定の変数が両環境で共有されるため `--env` を取らない」「CI の設定・`deploy.yaml` の変更は対象外」を改める。`roadmap.md` の同じ記述も追補）。
- **Adjacent**: `survey-results-aggregation`（目録・可視フラグ）、`survey-results-public`（ビルド時の R2 の取得）、`ops-config-secrets`（変数の同期。`scripts/secrets/sync-github-variables.mjs` が `SURVEY_CONFIG` を扱っていないかを確かめる）。

## Constraints

- 環境は `production` と `develop` の 2 つ。`develop` ブランチと `dev/**` のプレビューは `develop` の環境、`release/**` は `production` の環境を使う（今の本番・develop・プレビューの動作を保つ。利用者の決定 2026-11-16）。環境のデプロイブランチの制限は、`develop` の環境に `develop` と `dev/**`、`production` の環境に `release/**` を許す形にする。パターンが `dev/foo` に一致するかは、環境の作成後にプレビューを 1 回動かして確かめる（一致しないなら制限を外す）。
- 環境の変数が無いと、同名のリポジトリ変数に代わる（develop に本番の設定が漏れる）。現在の設定を `production` の環境へ移したあと、リポジトリ変数 `SURVEY_CONFIG` を削除する。
- 環境変数は、ワークフロー直下の `env:` では読めない（ジョブの `environment:` を付けた後のステップでだけ読める）。`SURVEY_CONFIG` はステップの `env:` で渡しているため、そのまま使える。`sync-github-variables.mjs` は `SURVEY_CONFIG` を管理対象外にしており、環境の変数は見ないため変更は要らない。
- GitHub の環境の作成・変数の移行は、`gh`（`repo`・`workflow` の権限、リポジトリの管理者）で Claude が実施できる。実施は利用者の許可を得て行う（実装時に、実行の許可を `.claude/settings` に足すか、その場で許可する）。移行の手順（作成 → 変数 → リポジトリ変数の削除）は、`DEVELOP.md` にも運用者向けに残す。
- `deploy.yaml` は `release/**` と `develop` の両方で動く。環境の選択はブランチ名で決める。
- 本番の変数が無い環境では、アンケートの設定が無い状態（機能なし）として動く（現状の「変数が無ければ無効」の挙動を保つ）。
- 作業の順序: 先に退避（済: 運用者の手元に現在の設定の JSON を保存した。値は repo に置かない）→ 環境を作る → 現在の設定を `production` の環境へ移す（利用者の決定 2026-11-16）→ リポジトリ変数を削除 → develop に試験用のアンケートを登録して 4.2 を確かめる。
