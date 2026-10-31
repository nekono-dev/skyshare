# Requirements Document

## Introduction

`scripts/` を領域ごとのフォルダに分け、ファイル名を kebab-case にそろえる。参照（import・spawn・CI・hooks・コメント・文書）を新しいパスへ一括で直す。運用系の npm スクリプトの誤記と重複をなくす。

## Boundary Context (Optional)

- **In scope**: `scripts/` の配置と命名、参照の更新、`package.json` の運用系スクリプトの名前と重複、tsconfig・vitest の include。
- **Out of scope**: 中身のロジック、CI のジョブ名、DEVELOP.md の本文、アプリの振る舞い。
- **Adjacent expectations**: `ops-agent-setup`・`ops-config-secrets` の確定した入口とファイル名を使う。`test-foundation` のテストは import の更新だけを受ける。

## Requirements

### Requirement 1: scripts/ の配置

**Objective:** As a 開発者, I want 領域ごとのフォルダで運用ツールを探せる, so that どのスクリプトがどの処理の持ち主かが分かる

#### Acceptance Criteria

1. The `scripts/` shall 自動化に使う資材を、次の領域のフォルダに分けて持つ（2026-10-31 の改訂: 手作業の便利ツールは `hack/` に置く。現在は `hack/survey-cli/` のみ）: `agent/`（導入・BRW）、`config/`（wrangler・deploy の生成）、`secrets/`（秘密の準備と登録）、`survey/`（アンケートの CLI と設定の生成）、`e2e/`（E2E の実行と供給）、`dev/`（開発サーバーの中継）、`build/`（OpenAPI・lexicon の検査）、`git/`（hooksPath）、`lib/`（共通の解析）
2. The `scripts/` 直下 shall 領域のフォルダ以外のファイルを持たない
3. The ファイル名 shall kebab-case にそろう（例: `survey-harness.mjs`・`oauth-loopback-forwarder.ts`）
4. The `render-survey-config.ts` shall `scripts/survey/` の中へ移る

### Requirement 2: 参照の更新

**Objective:** As a 開発者, I want 移動の後も参照が切れていない, so that CI・hooks・ビルドが移動の前と同じに動く

#### Acceptance Criteria

1. The リポジトリ shall 移動の前のパス（`scripts/<旧名>`）を、コード・設定・CI・hooks・文書のどこにも残さない
2. When `npm run build`・`npm run dev`・`npm run test:all` が実行されたとき, the 各スクリプト shall 移動の前と同じ結果を出す
3. The `.github/workflows/`（`deploy.yaml`・`preview.yaml`・`e2e.yaml`）shall 新しいパスを指す（ジョブ名と引数は変えない）
4. The `.githooks/pre-push` と `.claude/hooks/session-start.sh` shall 新しいパスを指す
5. The コメント（`src/lib/oauth/*.ts`・`src/lib/api/schema/*.ts`・`openapi/README.md`・`lexicons/README.md`）shall 新しいパスを指す

### Requirement 3: npm スクリプトの整理

**Objective:** As a 運用者, I want 運用系のスクリプト名が正しく 1 つずつ, so that 同じ処理を別の名前で二度実行しない

#### Acceptance Criteria

1. The `package.json` shall `build:pripare` を `build:prepare` に直し、参照（`run-e2e.mjs`・`build` の定義）を同時に更新する
2. The `package.json` shall `test` と `test:all` の重複を、片方だけに整理する（`npm test` と `npm run test:all` の結果は変えない）
3. The `package.json` shall `dev:build` と `build` の重なる手順（`setup:local`・`build`）を、同じ名前の入口から呼ぶ形にする
4. The `package.json` shall 参照されていないスクリプトを残さない（`prev`・`dev:build` の用途を確認し、残すものは文書の手順に対応させる）

### Requirement 4: 宣言されていない依存の解消

**Objective:** As a 開発者, I want コードが参照する依存を `package.json` に宣言する, so that 依存の変更で壊れない

#### Acceptance Criteria

1. The リポジトリ shall `scripts/` のコードが import する外部パッケージを、`package.json` の `dependencies` か `devDependencies` に宣言されている状態にする
2. The `jsonc-parser` shall コードから参照されない状態にする（`scripts/lib/jsonc.mjs` へ置き換える。`ops-config-secrets` の要件に従う）

### Requirement 5: 型検査と設定の範囲

**Objective:** As a 開発者, I want 移動後の `scripts/` が型検査とテストの対象になる, so that 参照の切れを早く見つけられる

#### Acceptance Criteria

1. The `tsconfig.json` shall `scripts/**/*` を型検査の対象に含める（既存の設定を保つ）
2. When `npm run test:type` が実行されたとき, the 型検査 shall 移動後のすべての `scripts/` のファイルに対して通る
3. The `tests/unit/scripts/` shall 移動後の `scripts/` のパスで import し、期待値を変えずに通る

### Requirement 6: 重複する資材の統合

**Objective:** As a 運用者, I want 同じ内容の雛形と生成の入口が 1 つだけある, so that 変更を 1 箇所に加えれば済む

#### Acceptance Criteria

1. The `config/` shall E2E の設定を `config/develop.example.json` からだけ作り、E2E 専用の雛形（`config/e2e.example.json`）を持たない
2. When E2E の設定が作られたとき, the E2E の実行 shall 接続先の 3 項目だけを偽の Bluesky に向け、それ以外の値は `config/develop.example.json` と同じにする
3. The `scripts/secrets/` shall シークレットの生成関数を `scripts/secrets/generators.mjs` の 1 箇所だけで定義し、`generate-oauth-key.mjs` を持たない
4. When 運用者が手作業でシークレットの値を出すとき, the `scripts/secrets/generators.mjs` shall シークレット名を引数に取り、その値を標準出力へ出す
