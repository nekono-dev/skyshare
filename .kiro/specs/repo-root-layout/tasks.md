# Implementation Plan

- [x] 1. 基準の記録と、実施済みの変更の確認
- [x] 1.1 移動の前の基準値を控える
  - `npm run codegen` を実行し、`src/client/` の内容のハッシュを控える
  - `wrangler.jsonc` の生成結果のハッシュと、テスト各層（unit・component・route・render）の件数を控える
  - 控えた値を後の検証で比べられる形で実装ログに残す
  - 観察できる完了条件: 基準値（ハッシュと件数）が記録されている
  - _Requirements: 2.1, 2.2, 3.1, 3.2_

- [x] 1.2 議論中に実施済みの変更を確認する
  - LICENSE-jp の削除、`patches/` と `postinstall`・`patch-package` の削除、`openapi/generated.json` の書き出しの停止と削除、`openapi/README.md` から `docs/openapi.md` への移動が作業ツリーに反映されている
  - 観察できる完了条件: `git status` にこれらが出ており、`npm run test:unit` が通る
  - _Requirements: 1.1, 1.2, 6.1_

- [x] 2. 設定ファイルの移動（生成の入力とテスト設定）
- [x] 2.1 (P) OpenAPI クライアントの生成設定を config/ へ移す
  - `orval.config.ts` を `config/orval.config.ts` へ移し、スキーマを組み立てる import を新しい位置から解決させる
  - 生成は `npx orval --config config/orval.config.ts` で確かめる（`package.json` の変更は 5.1 で行う）
  - 観察できる完了条件: 生成結果のハッシュが 1.1 で控えた値と一致する
  - _Boundary: OpenAPI クライアント生成_
  - _Requirements: 3.1_

- [x] 2.2 (P) wrangler テンプレートを config/ へ移し、生成と読み込みを直す
  - `wrangler.template.jsonc` を `config/` へ移し、生成スクリプト・シークレットの同期スクリプト・hack の CLI・生成の単体テストの参照を新しい位置に直す
  - 観察できる完了条件: `render-wrangler` の生成結果（`wrangler.jsonc`）のハッシュが 1.1 と一致し、生成の単体テストが通る
  - _Boundary: wrangler 生成_
  - _Requirements: 3.2_

- [x] 2.3 (P) .dev.vars の雛形を config/ へ移し、準備の参照を直す
  - `.dev.vars.template` を `config/.dev.vars.template` へ移し、ローカルの準備スクリプトと開発セッション開始時のフックの参照を直す
  - `.dev.vars`（秘密情報）は根に残す
  - 観察できる完了条件: `npm run setup:local` が既存の `.dev.vars` を壊さずに終わり、`.dev.vars` が根にある
  - _Boundary: ローカル秘密情報の準備_
  - _Requirements: 3.3, 3.4, 5.4_

- [x] 2.4 (P) vitest の unit・component・astro・live の設定を config/test/ へ移す
  - 4 件の設定を `config/test/` へ移し、プロジェクトの根を設定の場所から求める。`root`（vitest のトップレベル） を明示する
  - coverage の出力先を `.cache/coverage` にする
  - 観察できる完了条件: 各設定を `npx vitest run -c config/test/...` で実行し、件数が 1.1 の基準と同じになる
  - _Boundary: テスト設定（vitest の層）_
  - _Requirements: 2.1, 2.2, 4.1_

- [x] 3. テスト設定の移動（経路・E2E・変異）
- [x] 3.1 ルートのテスト設定を config/test/ へ移す
  - `vitest.route.config.ts` を `config/test/` へ移し、プロジェクトの根・マイグレーション・`fakeOutbound`・互換日付の読み込み（`wrangler.template.jsonc` は 2.2 の新しい位置）を直す
  - 観察できる完了条件: `npx vitest run -c config/test/vitest.route.config.ts` が 1.1 の件数と同じで通り、互換日付の警告が移動の前と同じ条件で出る
  - _Depends: 2.2, 2.4_
  - _Boundary: テスト設定（route 層）_
  - _Requirements: 2.1, 2.2, 4.1_

- [x] 3.2 Playwright と Stryker の設定を config/test/ へ移す
  - `playwright.config.ts` と `stryker.config.mjs` を `config/test/` へ移し、`testDir`・`outputDir`（`.cache/test-results`）・`vitest.configFile`・`tempDirName`（`.cache/stryker-tmp`）を設定の場所からの相対で直す
  - 観察できる完了条件: `npx playwright test -c config/test/playwright.config.ts --list` が 7 本の流れを列挙し、`stryker` が設定の読み込みで止まらず起動する
  - _Boundary: テスト設定（E2E・変異）_
  - _Requirements: 2.1, 2.3, 4.2_

- [x] 3.3 E2E の起動経路を新しい Playwright 設定に合わせる
  - `scripts/e2e/run-e2e.mjs` の Playwright の起動に `-c config/test/playwright.config.ts` を加える
  - 観察できる完了条件: `npm run test:e2e` の経路が新しい設定で Playwright を実行する（完走の確認は 6.2）
  - _Depends: 3.2_
  - _Boundary: E2E 実行の経路_
  - _Requirements: 2.3_

- [x] 4. 文書・無視設定・生成物・CI（並行可）
- [x] 4.1 (P) 文書を docs/ へ移し、README-jp の画像パスを直す
  - `DEVELOP.md`・`README-jp.md`・`promotion/` を `git mv` で `docs/` へ移す
  - `docs/README-jp.md` の画像を `../public/...` に直す
  - 観察できる完了条件: `docs/README-jp.md` の画像パスが実在するファイルを指す
  - _Boundary: 文書の配置_
  - _Requirements: 1.2, 5.5_

- [x] 4.2 (P) 無視設定を `.cache/` と `tests/e2e/.auth/` にそろえる
  - `.gitignore` の旧い生成物の行（`/coverage/`・`/test-results`・`/playwright/.cache`・`/playwright/.auth`・`/.stryker-tmp/`）を `/.cache/` と `/tests/e2e/.auth/` に置き換える
  - 観察できる完了条件: `git check-ignore` で `.cache/` 配下と `tests/e2e/.auth/` 配下が無視されると確認できる
  - _Boundary: 無視設定_
  - _Requirements: 4.3, 4.4_

- [x] 4.3 (P) playwright/.auth を tests/e2e/.auth へ移す
  - `playwright/.auth/` を中身を読まずに `tests/e2e/.auth/` へ移し、空になった `playwright/` を消す
  - 移動するか削除するかは design の Open Items で利用者が決める（この task は移動を前提にする）
  - 観察できる完了条件: 根に `playwright/` が無く、`tests/e2e/.auth/` に 3 ファイルがあり、権限が移動の前と同じ
  - _Boundary: 認証の一時ファイル_
  - _Requirements: 1.3, 4.4_

- [x] 4.4 (P) 古い生成物を消し、新しい出力先を確かめる
  - 根の `coverage/` と `test-results/` を消す（生成物のため）
  - 観察できる完了条件: 2.4 の設定で unit を実行したとき `.cache/coverage/` ができ、根に `coverage/` が作られない
  - _Depends: 2.4_
  - _Boundary: 生成物_
  - _Requirements: 1.3, 4.1, 4.2_

- [x] 4.5 (P) CI の設定とコメントの参照を新しい位置へ直す
  - `.github/workflows/e2e.yaml` のアーティファクトの `path` を `.cache/test-results/` にする
  - `deploy.yaml`・`preview.yaml`・`e2e.yaml` のコメントの `DEVELOP.md` を `docs/DEVELOP.md` にする。ジョブ名と引数は変えない
  - 観察できる完了条件: 3 つのワークフローの差分がパスとコメントに限られ、ジョブ名と引数が変わらない
  - _Boundary: CI 設定_
  - _Requirements: 5.3_

- [x] 5. 参照の一掃（共有ファイルと文書）
- [x] 5.1 package.json と tsconfig.json の参照を直す
  - `package.json` の `test:unit`・`test:render`・`test:component`・`test:route`・`test:live` の `-c` の引数、`test:mutation`（設定の引数）、`apigen:client`（`orval --config config/orval.config.ts`）を新しい位置にする
  - `tsconfig.json` の include の一覧を `config/` の下の設定に直す
  - 観察できる完了条件: `npm run codegen`・`npm run test:type`・`npm run test:unit`・`npm run test:route` が通る
  - _Depends: 2.1, 2.4, 3.1, 3.2_
  - _Boundary: 共有の設定（package.json・tsconfig）_
  - _Requirements: 2.2, 5.2_

- [x] 5.2 コードのコメントと文書の旧パスを直す
  - `astro.config.mjs`・`.githooks/pre-push`・`src/components/README.md`・`src/lib/feedback/env.ts`・`scripts/` のコメント（`render-deploy-config`・`ensure-worker-secrets`・`lib/jsonc`・`lib/wrangler`・`build-openapi-document`）・`DEVELOP.md` の本文のパスを新しい位置にする
  - `.vscode/` に旧パスの参照が無いことを確かめる
  - 観察できる完了条件: 旧パスの検索（履歴と完了済み spec を除く）で、これらのファイルに旧パスが残らない
  - _Depends: 4.1_
  - _Boundary: コメントと文書_
  - _Requirements: 2.4, 5.1, 5.4_

- [x] 5.3 (P) 現行の仕様を説明する steering の記述を直す
  - `.kiro/steering/tech.md` と `testing.md` のパス（テスト設定・生成物・`.dev.vars.template`・`DEVELOP.md`）を新しい位置にする
  - `CLAUDE.md`・`AGENTS.md` に旧パスが無いことを確かめる（導入物のため内容は変えない）。完了済みの spec は変えない
  - 観察できる完了条件: steering・`CLAUDE.md`・`AGENTS.md` に旧パスが残らない
  - _Boundary: 仕様の説明（steering）_
  - _Requirements: 5.1_

- [x] 6. 検証
- [x] 6.1 根の一覧と移動の範囲を確かめる
  - 根に残るものが要件 1.1 の一覧と一致し、要件 6.3 の規約のファイルが残っていることを確かめる
  - `_legacy/`・`lexicons/`・`atproto/`・`migrations/`・`scripts/` の内部・`.memo` が移動の前と同じ位置にあることを確かめる
  - 観察できる完了条件: 根の一覧が要件 1.1 と一致し、旧パスの検索（履歴と完了済み spec を除く）が 0 件になる
  - _Depends: 4.1, 4.3, 4.4, 5.2_
  - _Requirements: 1.1, 1.3, 5.1, 6.2, 6.3_

- [x] 6.2 テストの全体を移動の前と比べる
  - `test:type`・`test:lexicon`・`test:unit`・`test:component`・`test:route`・`test:render` を実行し、件数と結果が 1.1 の基準と同じことを確かめる
  - `test:e2e` を実行し、7 本の流れが通ることを確かめる（ローカルの `.dev.vars` と開発の設定が要る）
  - `test:live` は設定が無いときに移動の前と同じくスキップされることを確かめる
  - `test:mutation` は起動の引数が通ることを確かめる（完走はしない）
  - 観察できる完了条件: 各コマンドの結果が移動の前と同じで、E2E は 7 件すべて通る
  - _Depends: 3.3, 5.1, 5.2_
  - _Requirements: 2.2, 2.3, 4.2, 5.2_

- [x] 6.3 ビルドと開発サーバーを確かめる
  - `npm run build` を実行し、移動の前と同じ段が実行されて成功することを確かめる
  - `npm run dev` で起動し、`https://localhost:4321` が応答することを確かめる
  - 観察できる完了条件: build が成功し、dev サーバーが応答する
  - _Depends: 5.1, 5.2_
  - _Requirements: 5.2_

- [x] 6.4 生成物の一致と移動の履歴を確かめる
  - `npm run codegen` の出力のハッシュと `wrangler.jsonc` の生成結果が 1.1 の基準と一致することを確かめる
  - 移動したファイルを `git log --follow` でたどれることを確かめる
  - 観察できる完了条件: 基準との一致と、履歴の追跡が確認できる
  - _Depends: 6.2_
  - _Requirements: 3.1, 3.2, 6.1_

## Implementation Notes

- orval は `output.target`・`mutator.path` を設定ファイルの場所から解決する。`config/orval.config.ts` では `../src/...` に直す必要があった（2.1）。
- vitest の `include`・`setupFiles` は設定の場所ではなくプロジェクトの根が基準。設定ごとに `root` を明示し、`rootDir` は `config/test/` から 2 階層上で求める（2.4・3.1）。
- 層の一部だけを実行すると、coverage の閾値で終了コードが 1 になる（対象外のモジュールが 0%）。全体の `test:unit` で判定する（2.2）。
- `test:live` は実 Bluesky に接続するため、ネットワークの到達性で結果が変わる（ETIMEDOUT・ENETUNREACH）。移動の前の設定でも同じ失敗が出た。移動とは無関係（6.2）。
- `npm run build` は運用者の値（`siteHost`）を要求する。開発用の設定のままでは止まる（既存の条件）。本番の設定で wrangler.jsonc を生成して確かめ、その後に開発用へ戻した（6.3）。
- `npm run test:e2e` は `build:prepare` の `prettier --write .` を走らせ、編集したファイルを整形する。既知の副作用（testing.md の未決定 2）。
- Stryker は `stryker run <configFile>` で設定を受け取れる（6.2 の前に 3.2 で確認）。既定の探索（作業ディレクトリの直下）では移動後の設定を読まないため、`package.json` の `test:mutation` で引数に指定した（5.1）。
- 移動は `git mv` で行い、`git diff -M` で名前の変更（R）として検出されることを確かめた。最後に `git reset` でステージを外したため、コミット時に `git add` で改めてステージする必要がある。
- 完了後に行った `config/e2e.example.json` の削除と `generate-oauth-key.mjs` の `generators.mjs` への統合は、この spec の範囲の外（`scripts/` の内部）のため、`ops-tooling-layout` の要件 6・タスク 5 に記録した。
