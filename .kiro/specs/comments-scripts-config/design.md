# 設計書

## Overview

**Purpose**: 運用の資材（スクリプト・設定・フック・ワークフロー）のコメントを、`.kiro/steering/comments.md` の基準に従って書き直す。書き直しの後、コメントは今の責務・使い方・非自明な理由だけを述べる。

**Users**: 運用者と、このリポジトリのコードを読むエージェント・開発者。

**Impact**: 変更はコメントの行だけ。許容リストから、この spec が所有する項目を消す（残すと決めた項目を除く）。スクリプトの振る舞い、終了コード、生成物、CI の挙動は変えない。

**実装の前提（注記）**: 前提の comment-policy は実装が未完了である（comment-policy の tasks.md 4.1、tech.md の「Code Quality」の節の参照を揃える作業が未適用）。そのため、`spec.json` の `ready_for_implementation` は `false` のままにする。前提が満たされたら見直す。承認の状態（approved）は変えない。

### Goals

- 所有パス（許容リストの所有 spec が `comments-scripts-config` の項目）の違反を 0 にする。残す判断をしたものは、理由を付けて許容リストに残し、報告に挙げる。
- 検査の対象外（シェル・ワークフロー YAML）のコメントを、同じ基準でレビューする。
- 振る舞いが変わっていないことを、領域ごとに機械的に確かめる。

### Non-Goals

- 検査の規則（`scripts/architecture/comment-rules.ts`）、基準（`.kiro/steering/comments.md`）、検査のテストの変更。
- `src/`・`tests/`・`config/test/` のコメント（他の comments-* spec）。
- 許容リストの作り直し（`--emit-allowlist` の出力で置き換えない）。
- ファイルの移動・改名・分割、責務の変更、コードや YAML の値の変更。

## Boundary Commitments

### This Spec Owns

- 運用の資材のコメント: `scripts/`（`scripts/architecture/comment-rules.ts` を除く。`.ts`・`.mjs` は自動検査、`.sh` はレビュー）、`hack/survey-cli/`（`.ts` は自動検査）、`config/` 直下（`config/test/` を除く）の `.ts`・`.mjs`（自動検査）と `.jsonc`（レビュー）、`.githooks/pre-push`（レビュー）、`.github/workflows/*.yaml`（レビュー）。
- 許容リストのうち、所有 spec が `comments-scripts-config` の項目の削除（残す判断をした項目は除く）。
- 残す判断をしたコメントの一覧（報告）。

### Out of Boundary

- `src/`・`tests/`・`config/test/`（他の comments-* spec が所有）。
- 生成物（`src/client/`）、`*.d.ts`、テストの fixture、文字列リテラル（UI 文言・エラー文言・検査の規則の `reason` の文字列）。
- 基準（comment-policy）と検査の規則・検査のテスト。
- `scripts/architecture/comment-rules.ts` のコメント。comment-policy が所有し、違反を 0 件に保つ。`ownerOf` が `scripts/architecture/` を comments-scripts-config に割り当てるのは既知の例外で、`ownerOf` は変えない。
- スクリプトの振る舞い、CI の設定、ワークフローのトリガー・ジョブ・ステップ、環境変数の値。
- 配置と責務（ops-tooling-layout・ops-config-secrets が所有）。

### Allowed Dependencies

- 検査の規則（`scripts/architecture/comment-rules.ts`）を、判定の正本として読むだけ（変更しない）。
- 基準（`.kiro/steering/comments.md`）の判断を参照する。判別の語の一覧の正本も同じ文書（「書くもの・書かないもの」の節）。この spec は一覧を参照するだけで、語を追加しない。
- comment-policy（前提の依存先）: 基準と検査の規則が完成していること。未完了の間は、この spec の作業を始めない。
- 許容リスト（`config/comments/allowlist.json`）を、項目の削除だけで更新する。許容リストは全 comments-* spec が共有するため、編集は領域の順に直列で行う。全 comments-* spec は直列に実行し、並列にしない。

### Revalidation Triggers

- 基準（`comments.md`）または検査の規則が変わったとき: この spec の判断をやり直す。
- 運用の資材に新しいファイルが増えたとき: 検査の対象なら、所有 spec の割り当てで自動的にこの spec に入る。検査の対象外（シェル・YAML）なら、レビュー対象の一覧に加える。
- 許容リストの所有の割り当て（`ownerOf`）が変わったとき: 対象の範囲を見直す。

## Architecture

### Existing Architecture Analysis

- 検査の規則は、ファイルのパスで所有 spec を決める（`ownerOf`）。「`src/`・`tests/`・`config/test/`」以外のすべてが `comments-scripts-config` に入る。このため、`scripts/architecture/`（brief の境界候補には無い）も割り当ての上ではこの spec に入る。ただし `scripts/architecture/comment-rules.ts` は comment-policy が所有する（既知の例外。`ownerOf` は変えず、comment-policy が違反を 0 件に保つ）。
- 検査は `.ts`・`.tsx`・`.astro`・`.mjs` だけを読む。`.sh`・`.jsonc`・`.yaml`・拡張子の無い `.githooks/pre-push` は読まない（自動検査の対象外で、レビューで見る）。
- 検査の CLI は、`--emit-allowlist` を付けたときだけ違反を出力する。違反の残りは、その出力を所有パスで絞って確かめる。

### Architecture Pattern & Boundary Map

コードの構造は変えない。作業は領域ごとの直列の書き換えと確認の繰り返しであり、図は要らない。

### comments-* の全体の実行順序（直列）

許容リストを全 comments-* spec が共有するため、comments-* の作業は次の順に、1 つずつ行う（並列にしない）。

1. comment-policy（基準と検査の規則）
2. comments-lib
3. comments-api-schema の 1（変更前の基準の保存: OpenAPI の JSON と生成物）
4. comments-components-pages → comments-tests → comments-scripts-config（この順に 1 つずつ。roadmap の記載の順）
5. comments-api-schema の残りの作業（生成と最終の e2e）

この spec は段階 4 に入る。`config/orval.config.ts` と `scripts/build/build-openapi-document.ts` は、段階 3（基準の保存）が済んでから変える。段階 3 は段階 4 より前にあるため、この spec の作業の開始時に、段階 3 が完了していることを確かめる（下の「生成の入口」）。

作業の順番（領域の順。許容リストを直列に編集するため、並列にしない）:

1. `scripts/architecture`（検査の規則の周辺）
2. `scripts/agent`
3. `config`
4. `scripts/survey`・`hack/survey-cli`
5. `scripts/e2e`
6. `scripts/secrets`
7. `scripts/dev`・`scripts/build`
8. `scripts/git`・`scripts/lib`・`.githooks`
9. `.github/workflows`
10. 全体の確認

**Architecture Integration**:

- Selected pattern: 領域ごとの書き換え → 所有パスの確認 → 許容リストの項目の削除。
- Domain boundaries: 領域は、ディレクトリの責務（architecture・agent・config・survey・e2e・secrets・dev/build・git/lib/hooks・workflows）で分ける。
- Existing patterns preserved: 先頭ヘッダの形（`/** … */`・目的 1〜2 行）、インラインの理由コメント。
- New components rationale: 新しい部品は作らない。
- Steering compliance: `comments.md` の基準に従う。

### Technology Stack

新しい依存は増やさない。確認に使う既存の道具だけを使う。

| Layer       | Choice / Version                                                 | Role in Feature                          | Notes                                                  |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| 検査        | `npx tsx scripts/architecture/comment-rules.ts --emit-allowlist` | 残っている違反の一覧（所有パスで絞る）   | 出力は標準出力の JSON                                  |
| 単体テスト  | vitest（`config/test/vitest.unit.config.ts`）                    | commentRules のテストと unit 層          | 1 ファイルの実行は `--coverage.enabled=false` を付ける |
| 型・imports | `npm run test:type`・`npm run test:imports`                      | `.ts` と `.mjs` の変更で壊していないこと | 既存の npm スクリプト                                  |
| 構文        | `node --check`・`bash -n`                                        | `.mjs` と `.sh` の構文                   | 既存の道具                                             |
| YAML        | Node の `yaml` パッケージ（`node_modules` にある）               | 書き換え前後の解析結果の比較             | Python の yaml は入っていない                          |
| 差分        | `git diff -U0`                                                   | 変更行がコメントだけであること           | 既存の道具                                             |

## File Structure Plan

### Directory Structure

```
scripts/
├── architecture/   # 検査の規則の周辺（領域 1）
├── agent/          # 作業エージェントの補助（領域 2）
├── survey/         # アンケート設定の生成（領域 4）
├── e2e/            # E2E の実行（領域 5）
├── secrets/        # 秘密情報と変数の登録（領域 6）
├── dev/            # 開発用の中継（領域 7）
├── build/          # ビルドの補助（領域 7）
├── git/            # Git フックの設定（領域 8）
├── lib/            # 運用スクリプトの共通部品（領域 8）
└── config/         # デプロイ・Wrangler の設定の生成（領域 3）
hack/survey-cli/    # アンケートの CLI（領域 4）
config/             # 設定（config/test/ を除く）（領域 3）
.githooks/          # pre-push（領域 8）
.github/workflows/  # CI の定義（領域 9）
```

### Modified Files

各ファイルの変更は、コメントの行だけ。「確認」は、そのファイルの違反を所有パスで絞った検査の結果（0 件）と、領域の差分の確認を指す。

**領域 1: scripts/architecture**（許容リスト 16 件・9 ファイル）

- `scripts/architecture/allowlist.ts` — 先頭ヘッダを 6 行・箇条書き 3 件以内に直す（許容 2 件）。
- `scripts/architecture/check-imports.ts` — 先頭ヘッダを直す。「従来どおり」の経緯の記述を、現在の表示の仕様として書き直す（許容 2 件）。
- `scripts/architecture/cycles.ts` — 要件番号を除き、循環の判定の理由を述べる（許容 1 件）。
- `scripts/architecture/import-graph.ts` — 先頭ヘッダを直す（許容 2 件）。
- `scripts/architecture/lib-layers.ts` — 先頭ヘッダを直す（許容 2 件）。
- `scripts/architecture/regions.ts` — 先頭ヘッダを 6 行以内に直す（許容 1 件）。
- `scripts/architecture/rules.ts` — 要件番号を除き、規則の根拠（steering の節）を述べる（許容 1 件）。
- `scripts/architecture/types-only.ts` — 先頭ヘッダを直す（許容 2 件）。
- `scripts/architecture/util-sharing.ts` — 要件番号を除き、先頭ヘッダを直す（許容 3 件）。
- `scripts/architecture/allowlist.ts` の「設計の表と一致させる」は、設計書への参照なので、規則ごとの既定の所有 spec を決めている理由として書き直す（同じ領域 1 の作業で行う）。

**領域 2: scripts/agent**（許容リスト 3 件）

- `scripts/agent/kiro-gate.mjs` — 先頭ヘッダと関数のコメントの `kiro`・`/kiro-*` の記述を、役割（手順書・セッションの状態・フック）で言い換える。`.kiro/` のパスは書かない。言い換えで責務が伝わらない語は残し、理由を付けて許容リストに残す（許容 3 件のうち、残すのは `forbidden:kiro` の 1 件だけ。他の 2 件は消す）。残す場合は、その項目の理由の文言を、残す理由（許容する例外であること）を明示する文に書き換える。これが、この spec で理由の文言を変える唯一の場合である（要件 5.4）。
- `scripts/agent/setup-brw.mjs` — 違反は無い。レビューのみ（導入の順序・理由の記述を確かめる）。
- `scripts/agent/install-cc-sdd.sh` — 検査の対象外。レビューで、cc-sdd と `.kiro/` の記述を言い換える。ツール名を残す判断をした場合は報告に挙げる。このファイルは検査の対象外で許容リストに項目が無いため、理由の文言は変えない。版の固定の理由（`@latest` にしない）は残す。

**領域 3: config**（許容リスト 3 件）

- `config/orval.config.ts` — 先頭ヘッダを追加する（許容 1 件）。生成の入口のため、comments-api-schema の基準の保存の後に行う（下の「生成の入口」）。
- `scripts/config/render-deploy-config.mjs` — 先頭ヘッダを追加する（許容 1 件）。
- `scripts/config/render-wrangler.mjs` — 先頭ヘッダを追加する（許容 1 件）。
- `config/wrangler.template.jsonc` — 検査の対象外。レビューのみ（「Set this to today's date」の説明を、値の決め方として書き直す）。

**領域 4: scripts/survey・hack/survey-cli**（許容リスト 3 件）

- `scripts/survey/render-survey-config.ts` — 先頭ヘッダを 6 行以内・箇条書き 3 件以内に直す。「以前の生成物」は、現在の振る舞い（前回の生成物を取り除く）として残す（許容 2 件）。
- `hack/survey-cli/config.ts` — 先頭ヘッダを追加する。日付の入力例（「2026年11月の下書き」）は、バッククォートの入力例に書き直す（許容 1 件）。
- `hack/survey-cli/cli.ts`・`hack/survey-cli/lifecycle.ts`・`hack/survey-cli/remote.ts` — 違反は無い。レビューのみ。

**領域 5: scripts/e2e**（許容リスト 3 件）

- `scripts/e2e/run-e2e.mjs` — 先頭ヘッダを追加し、要件番号を除く（許容 2 件）。「後で開発の設定から…生成し直す」は、順序の理由として書き直す。
- `scripts/e2e/survey-e2e-harness.mjs` — 先頭ヘッダを追加する（許容 1 件）。

**領域 6: scripts/secrets**（許容リスト 4 件）

- `scripts/secrets/ensure-worker-secrets.mjs` — 先頭ヘッダを追加する（許容 1 件）。
- `scripts/secrets/generators.mjs` — 先頭ヘッダを追加する（許容 1 件）。
- `scripts/secrets/prepare-local-env.mjs` — 先頭ヘッダを追加する（許容 1 件）。
- `scripts/secrets/sync-github-variables.mjs` — 先頭ヘッダを追加する（許容 1 件）。

**領域 7: scripts/dev・scripts/build**（許容リスト 3 件）

- `scripts/dev/oauth-loopback-forwarder.ts` — 先頭ヘッダを 6 行以内・箇条書き 3 件以内に直す（許容 2 件）。
- `scripts/build/build-openapi-document.ts` — 先頭ヘッダを 6 行以内に直す（許容 1 件）。生成の入口のため、comments-api-schema の基準の保存の後に行う（下の「生成の入口」）。
- `scripts/build/lint-lexicon.sh` — 検査の対象外。レビューのみ。

**領域 8: scripts/git・scripts/lib・.githooks**（許容リスト 8 件）

- `scripts/git/setup-git-hooks.mjs` — 先頭ヘッダを追加し、要件番号（8.1・8.2）を除く（許容 2 件）。
- `scripts/lib/claudeMarketplace.mjs`・`scripts/lib/dotenv.mjs`・`scripts/lib/github.mjs`・`scripts/lib/jsonc.mjs`・`scripts/lib/live-config.mjs`・`scripts/lib/wrangler.mjs` — 先頭ヘッダを追加する（各 1 件、計 6 件）。
- `.githooks/pre-push` — 検査の対象外。レビューのみ。要件番号（8.3・8.4）を除く。実行内容（`npm run test:all`）と、GitHub の登録は行わないという説明は残す。

**領域 9: .github/workflows**（検査の対象外、許容リストに無い）

- `.github/workflows/deploy.yaml`・`.github/workflows/e2e.yaml`・`.github/workflows/preview.yaml` — レビューのみ。要件番号（`e2e.yaml` の 1〜3 行目など）を除き、呼び出しの関係と理由を述べる。`dev/XXXX` の XXXX は命名の形の例として残す。

**変更しないファイル**: `config/comments/allowlist.json` は、項目の削除だけで更新する（上の各領域の作業で行う）。`scripts/architecture/comment-rules.ts` の検査の規則、`.kiro/steering/comments.md`。

### 生成の入口（comments-api-schema との順序）

`config/orval.config.ts` と `scripts/build/build-openapi-document.ts` は、この spec ではコメントの行だけを変える。comments-api-schema が比べる基準（変更前の `src/client/openapi` と OpenAPI の JSON）は、この spec の変更の前の状態から保存したものを使う。そのため、この 2 ファイルは、comments-api-schema の基準の保存（その spec の 1.1）が済んでから変える。開始時に基準の保存が済んでいれば、この spec の作業の中で変えてよい。未完了なら、この 2 ファイルを後回しにして残りの領域を先に進め、後回しにした項目は報告に残す。この spec では生成（`npm run codegen`・`apigen`）を実行しない。

## Components and Interfaces

ここでの「部品」は、領域ごとの作業の単位。コードのインターフェースは持たない。

| Work Unit                   | 入力                                           | 出力                                                             | 完了の確認                                                                          |
| --------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 領域の書き換え（領域 1〜9） | 領域の対象ファイル、基準、検査の所有パスの違反 | 書き換えたコメント、許容リストの所有項目の削除、残した判断の一覧 | 所有パスの違反が 0 件（残す判断を除く）、変更行がコメントのみ、振る舞いの確認が通る |
| 全体の確認（領域 10）       | 全領域の結果                                   | 検査の結果、型・imports・単体テストの結果、報告                  | 所有の項目が残っていない（残す判断を除く）、全体の検査の結果の説明                  |

### 作業の手順（各領域で共通）

1. 作業の前に、許容リストの所有項目を確かめる（所有 spec が `comments-scripts-config` の項目）。
2. 領域の対象ファイルのコメントを、基準に従って書き直す。違反の行は、`--emit-allowlist` の出力の該当行（行番号は出力に無いため、ファイルの中で探す）を参照する。
3. 経緯・参照の候補は、grep で拾ってレビューする（下の確認の節）。
4. 変更行がコメントだけであることを、`git diff -U0` で確かめる。
5. 所有パスの違反を、`--emit-allowlist` の出力で絞って確かめる。0 件なら、そのファイルの許容項目を消す。
6. 領域の確認（`.ts`・`.mjs` の型・imports・単体テスト、`.sh` の構文、YAML の解析結果）を行う。

## Requirements Traceability

| Requirement | Summary                                          | Components                                           | Interfaces                                           | Flows        |
| ----------- | ------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------- | ------------ |
| 1.1         | 先頭に目的のブロックコメントを持つ               | 領域 1〜9 の書き換え                                 | 基準（先頭ヘッダの節）                               | 手順 2       |
| 1.2         | 目的を 1〜2 行で、現在の責務を述べる             | 領域 1〜9 の書き換え                                 | 基準（先頭ヘッダの節）                               | 手順 2       |
| 1.3         | 内容 6 行以内・箇条書き 3 件以内                 | 領域 1・4・7 の行数超過の書き換え                    | 検査の `header-too-long`・`header-too-many-bullets`  | 手順 2・5    |
| 1.4         | 起動の形式・主な引数の使い方を書く               | 領域 2・5・9 の使い方の記述                          | レビュー                                             | 手順 3       |
| 1.5         | 責務の逐条の説明・コードの言い換えを含まない     | 領域の書き換え                                       | レビュー                                             | 手順 3       |
| 1.6         | import より前に先頭ヘッダを置く                  | 領域 1〜8 の import の後の記述の是正                 | 検査の `header-missing`                              | 手順 5       |
| 2.1         | spec・要件番号・AC タグを残さない                | 領域の書き換え                                       | 検査の禁止パターン（所有パス）                       | 手順 2・5    |
| 2.2         | cc-sdd・kiro の言及を取り除く                    | 領域 2（kiro-gate・install-cc-sdd）ほか              | 検査の `forbidden:cc-sdd`・`forbidden:kiro`          | 手順 2・3    |
| 2.3         | 経緯を述べる記述を取り除く（検査の対象外も含む） | 領域の書き換え                                       | grep の候補とレビュー                                | 手順 3       |
| 2.4         | 日付入りの決定を残さない                         | 領域 4（hack/survey-cli/config.ts）ほか              | 検査の `date`                                        | 手順 3       |
| 2.5         | 担当者のない TODO を残さない                     | 領域の書き換え                                       | grep の候補                                          | 手順 3       |
| 2.6         | コードの言い換えを残さない                       | 領域の書き換え                                       | レビュー                                             | 手順 3       |
| 2.7         | シェル・YAML に同じ基準を当てる                  | 領域 2・3・7・8・9                                   | レビュー                                             | 手順 3       |
| 3.1         | 非自明な理由を残す                               | 領域の書き換え                                       | レビュー                                             | 手順 2       |
| 3.2         | 外部仕様の参照を残す                             | 領域の書き換え（GitHub Actions・Wrangler・RFC など） | レビュー                                             | 手順 2       |
| 3.3         | 残した禁止語を報告する                           | 全体の確認                                           | 残した判断の一覧                                     | 手順 6・全体 |
| 4.1         | 変更をコメントの行に限る                         | 手順 4                                               | `git diff -U0`                                       | 手順 4       |
| 4.2         | 終了コード・出力・生成物が同じ                   | 領域の確認                                           | 既存の npm スクリプト・型・imports・単体テスト       | 手順 6       |
| 4.3         | ワークフローのトリガー・ジョブ・値が同じ         | 領域 9                                               | YAML の解析結果の比較                                | 手順 6       |
| 4.4         | 実行権限・場所・名前が同じ                       | 手順 4                                               | `git diff --summary`・`git ls-files -s`              | 手順 4       |
| 5.1         | 直した所有項目を許容リストから消す               | 手順 5                                               | 許容リスト（項目の削除）                             | 手順 5       |
| 5.2         | 残す判断の項目は理由と所有を付けて残す           | 手順 5                                               | 許容リスト                                           | 手順 5       |
| 5.3         | 他の所有の項目を変えない                         | 手順 5                                               | 許容リスト                                           | 手順 5       |
| 5.4         | 許容リストを作り直さない                         | 手順 5                                               | 許容リスト（削除のみ。残す項目の理由の文言だけ例外） | 手順 5       |
| 5.5         | 検査の規則と基準を変えない                       | Boundary（Out）                                      | `git diff`（対象外のファイルに変更が無い）           | 全体         |
| 6.1         | 迷ったコメントの一覧（残した理由）               | 全体の確認                                           | 報告                                                 | 全体         |
| 6.2         | 件数（書き換え・削除・残し・許容の増減）         | 全体の確認                                           | 報告                                                 | 全体         |
| 6.3         | 検査の結果（所有パスの 0 件、残す項目）          | 全体の確認                                           | 報告                                                 | 全体         |

## Verification Approach

作業の確認は、テストを新しく書かず、既存の道具で行う（テストを別の作業にしない）。

- **所有パスの違反**: `npx tsx scripts/architecture/comment-rules.ts --emit-allowlist` の出力（JSON の `entries`）から、`owner` が `comments-scripts-config` の項目を取り、対象のパスで絞る。その絞り込みから `scripts/architecture/comment-rules.ts` を除く（comment-policy の所有。そのパスの項目が出たら、この spec では扱わず報告する）。作業の前後で、残りの件数と項目を比べる。
- **許容リストの整合**: 削除した項目が、出力の中に無いことを確かめる。出力にあって許容リストに無い項目は、新しい違反なので直す。
- **単体テスト**: `npx vitest run -c config/test/vitest.unit.config.ts tests/unit/scripts/commentRules.test.ts --coverage.enabled=false`。他の comments-* の作業中は、リポジトリ全体の項目の一致で失敗することがある（別の所有の項目が残るため）。その場合、この spec の判定は所有パスの絞り込みで行い、全体の確認は全 comments-* の完了後に行う。
- **振る舞い**: `.ts`・`.mjs` を変えた領域では、`npm run test:type` と `npm run test:imports`。`.mjs`・`.sh` は `node --check`・`bash -n`。`npm run test:unit` は全体の確認で行う。`npm run test:e2e` は、この spec では実行しない（最後の e2e は comments-api-schema が行う）。`npm run test:lexicon` は、他の comments-* spec と同じく、この spec の検証に含めない（この環境では実行でき、追加の導入は要らない）。
- **YAML**: 書き換えの前の版（`git show HEAD:<path>`）と後の版を、Node の `yaml` で解析し、結果が一致することを確かめる。
- **コメントだけの変更**: `git diff -U0` の変更行（`+`・`-`）が、コメントの行（`//`・`/*`・`*`・`#`・`<!--`）か空行であること。コードの行の末尾に付いたコメントは、目視で確かめる。
- **経緯と参照の候補**: 領域の対象ファイルを grep で拾い、レビューで判断する。禁止パターンと語の一覧は .kiro/steering/comments.md の『書かない』の節を正本とする。この spec は語を追加しない。

## Error Handling

- 違反が残る（所有パスに未解消の項目がある）: その領域を完了にせず、残りを直す。
- 変更行にコードが含まれる: その変更を戻し、コメントだけにする。
- YAML の解析結果が変わる、型・imports・単体テストが落ちる: その領域の変更を戻して、原因を調べる。
- 許容リストの衝突（別の作業の編集と重なる）: 編集の前にファイルを読み直し、自分の所有の項目だけを消す。
- 自分の単位の外の差分（他の spec の変更や、検査の実行による整形差分）が見つかったとき: comments-* の単位の外の整形差分だけを戻す。戻した差分は報告に挙げる。

## Open Questions / Risks

- **ツール名を残す 2 ファイル**: `scripts/agent/kiro-gate.mjs`（kiro のコマンドを扱うフック）と `scripts/agent/install-cc-sdd.sh`（cc-sdd の導入）。既定は、役割で言い換える。言い換えで責務が伝わらないと判断した語は、残して報告する（`kiro-gate.mjs` は許容リストに残す）。要件の承認の時点で、この既定を確かめてもらう。
- **対象の範囲**: `scripts/architecture` は、brief の境界候補（運用スクリプトの領域）に無いが、許容リストの所有の割り当てで、この spec に入る。この設計では含める。brief の更新が必要かは、要件の承認の時点で確かめる。
- **シェル・YAML の判断**: 検査の対象外のため、判断はレビューによる。書き換えの前後で、振る舞いの変化が無いことを機械的に確かめるのは、YAML の解析結果とシェルの構文だけ。コメントの内容の判断は人の確認に頼る。
- **並列の作業**: 許容リストを他の comments-* spec と共有する。この spec の作業は直列で行う。リポジトリ全体の検査が通るのは、全 comments-* の完了後。
- **brief との差**: brief の Scope（`scripts/**` を含む）は `comment-rules.ts` を除く点で、Constraints の e2e は完了条件から外す点で、この設計と食い違う。brief は今回の修正の対象外のため未変更。承認の時点で brief を直すかを決める。
- **検査の CLI の出力**: 直接実行は `--emit-allowlist` の時だけ出力する。`comments.md` の「`npx tsx scripts/architecture/comment-rules.ts`」は、出力を伴わない。確認の手順は、この設計の「Verification Approach」に従う。
