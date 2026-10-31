# Requirements Document

## Introduction

設定とシークレットの処理の重複をなくす。wrangler.jsonc の生成は 1 つの関数を呼ぶ形にし、子プロセスでの呼び出しをやめる。dotenv・JSONC・wrangler の `name` の読み取りは `scripts/lib/` の 1 つずつだけを使う。秘密の生成と登録の責務を分ける。

## Boundary Context (Optional)

- **In scope**: wrangler.jsonc の生成の入口、共通の解析、秘密の準備と登録の責務、`render-deploy-config.mjs` の呼び出し方。
- **Out of scope**: pre-push の挙動（既知の論点として残す）、CI の処理内容、ファイルの配置、文書。
- **Adjacent expectations**: `ops-agent-setup`（`setup-git-hooks.mjs`）、`ops-tooling-layout`（配置）、`test-foundation`（`tests/unit/scripts/` の既存テスト）。

## Requirements

### Requirement 1: wrangler.jsonc の生成の入口

**Objective:** As a 運用者, I want wrangler.jsonc の生成を 1 つの関数で行う, so that 開発・E2E・本番・develop の生成結果が同じ規則で作られる

#### Acceptance Criteria

1. The 生成モジュール shall 設定の名前と `develop` の指定を受け取り、`wrangler.jsonc` を書く関数を export する
2. When 他のスクリプト（`prepare-local-env`・`run-e2e`・`render-deploy-config`）が生成を必要とするとき, the スクリプト shall その関数を同じプロセスで呼び、子プロセスを起動しない
3. The 生成モジュール shall 直接実行されたときだけ CLI として動く（import では副作用を起こさない）
4. The 生成の結果 shall 現行の `wrangler.jsonc` と同じ内容になる（同じ設定から同じ出力）

### Requirement 2: 共通の解析

**Objective:** As a 開発者, I want dotenv・JSONC・wrangler の名前の読み取りが 1 通りだけ, so that 同じファイルを読んでも結果が食い違わない

#### Acceptance Criteria

1. The リポジトリ shall dotenv の解析を `scripts/lib/dotenv.mjs` の `parseDotenv` だけで行う
2. The `prepare-local-env` shall `.dev.vars` の値の書き換えに、`parseDotenv` で得た値を使う（正規表現の個別の実装を持たない）
3. The リポジトリ shall JSONC の解析を `scripts/lib/jsonc.mjs` の `parseJsonc` だけで行う（`jsonc-parser` を使わない）
4. The リポジトリ shall wrangler の設定の `name` の読み取りを 1 つの関数で行い、`sync-github-variables` と `ensure-worker-secrets` の両方がそれを使う
5. The `package.json` shall 宣言されていない依存（`jsonc-parser`）を、コードから参照しない状態にする

### Requirement 3: 秘密の準備と登録の責務

**Objective:** As a 運用者, I want 秘密の生成・ローカルへの書き込み・GitHub と Worker への登録が、それぞれ 1 つのスクリプトの責務になる, so that どこで値が作られ、どこへ渡るかが追える

#### Acceptance Criteria

1. The `prepare-local-env` shall 秘密の生成と `.dev.vars` への書き込みだけを行い、GitHub と Worker へは登録しない
2. The `sync-github-variables` shall GitHub の Variables・Secrets と Worker への登録だけを行い、秘密を生成しない
3. The `ensure-worker-secrets` shall 未登録の Worker のシークレットを生成し、`wrangler secret put` で登録する責務だけを持つ
4. The 生成関数（`GENERATORS`・`generateOauthKey`）shall 1 箇所に定義され、他のスクリプトはそれを import する
5. The スクリプト shall 生成した値を標準出力・ログ・ファイル（`.dev.vars` 以外）に出さない（既存の規則を保つ）

### Requirement 4: 既存の挙動の維持

**Objective:** As a 運用者, I want 整理の前後で配備・ローカル・E2E の結果が変わらない, so that 手順の変更なしに運用を続けられる

#### Acceptance Criteria

1. When 整理の後に `npm run setup:local` が実行されたとき, the スクリプト shall 整理の前と同じ `.dev.vars` の項目を作る（既設定の値は上書きしない）
2. When 整理の後に `npm run sync:github -- --dry-run` 相当の検査が行われたとき, the スクリプト shall 登録する名前の一覧を整理の前と同じにする（値は出さない）
3. The `tests/unit/scripts/` の既存テスト shall 通る（入口の変更に合わせて import だけを直し、期待値は変えない）
4. The `.githooks/pre-push` shall テスト（`npm run test:all`）だけを実行する。GitHub の Variables・Secrets への登録は push では行わず、運用者が `npm run sync:github` を手動で実行する（2026-10-31 の利用者の決定）

### Requirement 5: 設定の不足の扱い

**Objective:** As a 運用者, I want 設定が足りないときに早く分かる, so that 誤った値で配備されない

#### Acceptance Criteria

1. If `config/<名前>.json` が無い、または必須の vars が無いとき, then the 生成モジュール shall 非ゼロで終了し、不足の項目名を標準エラーに出す
2. If 本番（`production`）の生成で siteHost が無いとき, then the 生成モジュール shall 生成を行わずに失敗する
3. If D1 の名前から ID が引けないとき, then the 生成モジュール shall 失敗し、先に作成する必要がある旨を出す
