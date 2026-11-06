# Requirements Document

## Introduction

リポジトリのルート直下に並ぶ設定・文書・生成物を、役割ごとのフォルダへ移す。根に残すのは、ツールの規約で根に必要なものだけにする。移動の後も、開発・ビルド・テスト・CI・hooks・エージェントの導入が移動の前と同じに動くことを求める。

## Boundary Context

- **In scope**: テスト設定（`vitest.*.config.ts`・`playwright.config.ts`・`stryker.config.mjs`）の配置、文書（`DEVELOP.md`・`README-jp.md`・`promotion/`・`openapi/README.md`）の移動、`openapi/generated.json` の書き出しの停止と削除、`orval.config.ts`・`wrangler.template.jsonc`・`.dev.vars.template` の配置、生成物（`coverage/`・`test-results/`）の出力先、`playwright/` の一時ファイルの配置、移動に伴う参照の更新。
- **Out of scope**: `_legacy/`・`lexicons/`・`atproto/`（submodule）・`migrations/` の移動。`patches/` は削除済み（`@atproto/api` のパッチは不要と確認した）。`scripts/` の内部の配置と命名（`ops-tooling-layout` の範囲）。`.memo`（現在の位置のまま残す）。アプリの振る舞いと CI のジョブ名・引数。
- **Adjacent expectations**: `ops-tooling-layout` が vitest 設定の include や `scripts/` のパスを変える場合、この feature はその変更を戻さない。両者の変更の順序は design で決める。`wrangler.jsonc` は `scripts/config/render-wrangler.mjs` が生成するため、その生成結果の位置は変えない。

## Requirements

### Requirement 1: ルート直下の構成

**Objective:** As a 開発者, I want ルート直下に必要なファイルだけが並ぶ, so that 設定・文書・生成物を探す手間が減る

#### Acceptance Criteria

1. The リポジトリのルート shall 次のファイルとディレクトリだけを直下に持つ: `package.json`・`package-lock.json`・`tsconfig.json`・`astro.config.mjs`・`.gitignore`・`.gitmodules`・`.prettierrc`・`.prettierignore`・`README.md`・`LICENSE`・`CLAUDE.md`・`AGENTS.md`・`.branch-release-workflow.json`・`.branch-release-workflow-source.json`・`wrangler.jsonc`・`.dev.vars`・`src/`・`public/`・`tests/`・`scripts/`・`config/`・`docs/`・`lexicons/`・`migrations/`・`atproto/`・`_legacy/`・`hack/`・`.memo`、および隠しディレクトリとツールが決めた生成物（`node_modules/`・`.astro/`・`dist/`・`.wrangler/`）
2. When 文書（`DEVELOP.md`・`README-jp.md`・`promotion/`・`openapi/README.md`）が移動したとき, the リポジトリ shall それらを `docs/` の直下に持つ（`README.md` と `LICENSE*` は根に残す）
3. The リポジトリのルート shall `coverage/`・`test-results/`・`playwright/` を直下に持たない

### Requirement 2: テスト設定の配置

**Objective:** As a 開発者, I want テスト設定を 1 つのフォルダで探せる, so that テストの構成を把握しやすくなる

#### Acceptance Criteria

1. When `vitest.*.config.ts`・`playwright.config.ts`・`stryker.config.mjs` が移動したとき, the テスト設定 shall 移動の前と同じ対象（`tests/` と `src/` のパス）を検査する
2. When `npm run test:unit`・`test:component`・`test:route`・`test:render`・`test:live`・`test:mutation` のいずれかを実行したとき, the テストの実行 shall 移動の前と同じ結果（成功・失敗と coverage の閾値の判定）を返す
3. When `npm run test:e2e` を実行したとき, the E2E の実行 shall 移動の前と同じ Playwright の設定で動く
4. While `vitest.*.config.ts` が移動した状態にある, the エディタの設定（`.vscode/`）shall 新しい位置を参照する

### Requirement 3: 設定ファイルの配置

**Objective:** As a 運用者, I want 設定の雛形と生成の入力が 1 つのフォルダにある, so that 運用の手順で迷わない

#### Acceptance Criteria

1. When `orval.config.ts` が移動したとき, the コードの生成 shall 移動の前と同じクライアントを `src/client/openapi/` に出す
2. When `wrangler.template.jsonc` が移動したとき, the `wrangler.jsonc` の生成 shall 移動の前と同じ内容を根に出す
3. When `.dev.vars.template` が移動したとき, the 運用の手順 shall その新しい位置を指す
4. The `wrangler.jsonc` と `.dev.vars` shall 根に残る（wrangler の読み込みの規約）

### Requirement 4: 生成物の出力先

**Objective:** As a 開発者, I want テストと計測の生成物が 1 つのフォルダにまとまる, so that 根が散らからない

#### Acceptance Criteria

1. When テストの coverage を計測したとき, the テストの実行 shall 計測の出力を単一のキャッシュ用フォルダへ書く
2. When 変異テストを実行したとき, the テストの実行 shall 一時領域をそのキャッシュ用フォルダの中に作る
3. The キャッシュ用フォルダ shall `.gitignore` の対象で、コミットされない
4. The `playwright/` の認証と一時ファイル shall `tests/` の配下に置かれ、`.gitignore` の対象である

### Requirement 5: 参照の整合

**Objective:** As a 開発者, I want 移動の後も参照が切れていない, so that CI・hooks・ビルドが移動の前と同じに動く

#### Acceptance Criteria

1. The リポジトリ shall 移動の前のパス（`vitest.*.config.ts`・`playwright.config.ts`・`stryker.config.mjs`・`orval.config.ts`・`wrangler.template.jsonc`・`.dev.vars.template`・`DEVELOP.md`・`README-jp.md`・`promotion/`・`coverage/`・`test-results/`・`playwright/`）を、コード・設定・CI・hooks・エージェントの設定・文書のどこにも残さない（履歴を除く）
2. When `npm run dev`・`npm run build`・`npm run test:all` を実行したとき, the 各コマンド shall 移動の前と同じ順序の段を実行し、同じ結果を返す
3. The `.github/workflows/`（`deploy.yaml`・`preview.yaml`・`e2e.yaml`）shall 新しいパスを指す（ジョブ名と引数は変えない）
4. The `.githooks/pre-push` と `.claude/hooks/session-start.sh` shall 新しいパスを指す
5. The 文書の相互リンク shall 移動の後も開ける

### Requirement 6: 移動の履歴と除外

**Objective:** As a 開発者, I want 移動の経緯を履歴から追える, so that 誰がいつ何を動かしたか分かる

#### Acceptance Criteria

1. When ファイルを移動したとき, the 変更 shall 履歴をたどれる形（`git mv` による移動）で行われる
2. The `_legacy/`・`lexicons/`・`atproto/`・`migrations/`・`scripts/` の内部・`.memo` shall 移動の前と同じ位置に残る
3. The `CLAUDE.md`・`AGENTS.md`・`.branch-release-workflow.json` shall 根に残る（cc-sdd と BRW の導入の規約）
