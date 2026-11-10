# Implementation Plan

- [x] 1. wrangler.jsonc の生成を 1 つの関数にする
- [x] 1.1 生成の関数を切り出す
  - `scripts/render-wrangler.mjs` に `renderWranglerFile({ name, develop })` を export する。`process.exit` を使わず、失敗は例外で投げる
  - D1 の ID を引く処理を `resolveD1Ids` として切り出す
  - CLI の `main` は、関数の結果を出し、例外を終了コードに変えるだけにする
  - 完了の確かめ方: `renderWranglerFile` の出力が現行の CLI と同じ `wrangler.jsonc` になること
  - _Requirements: 1.1, 1.3, 1.4, 5.1, 5.2, 5.3_

- [x] 1.2 子プロセスの呼び出しを関数の呼び出しに置き換える
  - `prepare-local-env.mjs`・`run-e2e.mjs`（2 箇所）・`render-deploy-config.mjs` の `execFileSync`・`spawnSync` を `renderWranglerFile` の呼び出しにする
  - `run-e2e.mjs` は、生成の失敗時の後始末の経路を崩さない（既存の終了処理の順序を保つ）
  - 完了の確かめ方: `grep -rn "render-wrangler" scripts/` が CLI の使い方の表示以外に子プロセスの呼び出しを持たないこと
  - _Requirements: 1.2_

- [x] 2. 共通の解析を `scripts/lib/` の 1 通りにする
- [x] 2.1 wrangler の `name` の読み取りを追加する
  - `scripts/lib/wrangler.mjs` に `workerNameFrom(source)` を作る（`parseJsonc` で読み、トップレベルの `name` を返す）
  - `ensure-worker-secrets.mjs` と `sync-github-variables.mjs` の正規表現を、この関数に置き換える
  - _Requirements: 2.4_

- [x] 2.2 `.dev.vars` の書き換えを `parseDotenv` に寄せる
  - `prepare-local-env.mjs` の `RegExp` による判定を `parseDotenv` で得た値の空判定に替え、行の書き換えは該当行だけにする
  - 完了の確かめ方: 既設定の値が変わらず、空の項目だけが埋まること（テストで確かめる）
  - _Requirements: 2.1, 2.2_

- [x] 2.3 survey の JSONC 解析を `scripts/lib/jsonc.mjs` に替える
  - `hack/survey-cli/remote.ts` の `jsonc-parser` を `parseJsonc` へ置き換え、パース失敗は `RemoteError("parse")` として扱う（既存の挙動を保つ）
  - `package.json` に `jsonc-parser` が無いことと、コードから参照されないことを確かめる
  - _Requirements: 2.3, 2.5_

- [x] 3. 秘密の生成と登録の責務を分ける
- [x] 3.1 GENERATORS を `scripts/secrets/generators.mjs` に移す
  - `GENERATORS` を `prepare-local-env.mjs` から切り出し、`ensure-worker-secrets.mjs` と `prepare-local-env.mjs` の両方がそれを import する
  - 完了の確かめ方: `GENERATORS` の定義が 1 箇所であること
  - _Requirements: 3.4_

- [x] 3.2 各スクリプトの責務を確かめる
  - `prepare-local-env` が GitHub と Worker へ登録しないこと、`sync-github-variables` が秘密を生成しないこと、`ensure-worker-secrets` が未登録の名前だけを登録することを、コードで確かめる
  - 生成した値を標準出力・ログに出していないことを確かめる
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 4. 既存の挙動と検査
- [x] 4.1 既存の単体テストを更新して通す
  - `tests/unit/scripts/renderWrangler.test.ts`・`syncGithubVariables.test.ts` の import を新しい関数に合わせ、期待値は変えない
  - 完了の確かめ方: `npm run test:unit`（`tests/unit/scripts/`）が通る
  - _Requirements: 4.3_

- [x] 4.2 新規の単体テストを追加する
  - `workerNameFrom` が入れ子の `"name"` を取らないこと、`renderWranglerFile` の失敗が例外になることを確かめる
  - _Requirements: 2.4, 5.1, 5.2, 5.3_

- [x] 4.3 手元の確認（作業ツリー）
  - `npm run setup:local` の前後で `.dev.vars` の項目名が同じであることを確かめる（値は表示しない）
  - `sync:github` の登録対象の名前の一覧が変わらないことを確かめる（値は表示しない）
  - _Requirements: 4.1, 4.2_

- [x] 4.4 pre-push の挙動は変えない
  - `.githooks/pre-push` の内容を変えないことを確かめる（既知の論点は brief と develop-docs に記録する）
  - _Requirements: 4.4_

## 改訂タスク（2026-10-31: pre-push を手動方式に戻す）

- [x] 5. pre-push から GitHub の登録を外す
- [x] 5.1 `.githooks/pre-push` をテストだけにする
  - `scripts/secrets/sync-github-variables.mjs --if-configured` の行と説明コメントを削除する
  - 完了の確かめ方: hook の内容が `npm run test:all` だけであること。`sync:github` は引き続き `npm run sync:github` で動く
  - _Requirements: 4.4_

## Implementation Notes

### feature 検証（kiro-validate-impl, 2026-11-10）

- 判定は `GO`。全試験（`npm run test:all`）は終了コード 0（unit 700 件通過・2 件スキップ、component 13、route 212、render 2、e2e 10）。タスクは全て `[x]`、`_Blocked:_` は無い。受入基準は全てタスクの `_Requirements` から参照されている（突き合わせで未参照 0 件）。TODO・秘密情報の検出に該当は無い。判断の項目（タスク間の結線・設計との一致・境界）は Codex（`codex_exec`、読み取り専用）の独立した検証を入力にし、指摘は Claude が実物で確かめて採否を決めた。
- 指摘と処置: (1) 要件 2.3（JSONC の解析は `parseJsonc` だけ）: `config/test/vitest.route.config.ts` が `compatibility_date` を正規表現で読んでいたため、`parseJsonc` に替えた（route の試験は通過）。(2) 要件 3.5: `scripts/secrets/generators.mjs` を直接実行したときだけ値を標準出力へ出す（`ops-tooling-layout` の要件 6.4）。利用者の決定に従い、requirements.md に例外として追補した。(3) 要件 4.2: `npm run sync:github -- --dry-run` を実行し、終了コード 0、Variables は「変更なし 12 件・登録 0 件」で、登録する名前の導出は `tests/unit/scripts/syncGithubVariables.test.ts`（期待値は不変）が固定している。値は表示していない。
- design.md に「現況との対応（2026-11-10 追補）」を加えた（`scripts/` の移動後のパス）。
