# Implementation Plan

- [x] 1. `scripts/` を領域のフォルダに移す
- [x] 1.1 既存ファイルを `git mv` で移動する
  - design の移動の対応表に従い、`scripts/` の各ファイルを領域のフォルダへ移す（`scripts/lib/`・`scripts/survey/` は変えない）
  - ファイル名は kebab-case にする（`surveyE2eHarness.mjs` → `survey-e2e-harness.mjs`、`oauthLoopbackForwarder.ts` → `oauth-loopback-forwarder.ts`）
  - 完了の確かめ方: `scripts/` 直下に領域のフォルダ以外が無いこと
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 参照を新しいパスへ直す
- [x] 2.1 コードの参照を直す
  - `scripts/` 内の相対 import・`node scripts/...` の spawn・使い方のコメント、`astro.config.mjs`・`orval.config.ts`・`tests/unit/scripts/*.test.ts` の import を直す
  - 完了の確かめ方: `npm run test:type` と `npm run test:unit` が通る
  - _Requirements: 2.2, 5.2, 5.3_

- [x] 2.2 CI・hooks・コメントの参照を直す
  - `.github/workflows/`（`deploy.yaml`・`preview.yaml`・`e2e.yaml`）・`.githooks/pre-push`・`.claude/hooks/session-start.sh` の参照を直す（ジョブ名と引数は変えない）
  - `src/lib/oauth/*.ts`・`src/lib/api/schema/*.ts`・`openapi/README.md`・`lexicons/README.md`・`wrangler.template.jsonc` のコメントを直す
  - 完了の確かめ方: 下の検索が 0 件であること
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [x] 2.3 旧パスの残りを検索して 0 件にする
  - `grep -rn "scripts/\(setup-brw\|render-\|prepare-local-env\|ensure-worker\|sync-github\|generate-oauth\|run-e2e\|surveyE2e\|oauthLoopback\|build-openapi\|lint-lexicon\|setup-git-hooks\)" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=_legacy --exclude-dir=.kiro` が 0 件であること（`.kiro/` は spec の記述のため除く）
  - _Requirements: 2.1_

- [x] 3. npm スクリプトを整理する
- [x] 3.1 `build:pripare` を `build:prepare` に改める
  - `package.json` の定義と参照（`build`・`dev`・`scripts/run-e2e.mjs` の `spawn`）を同時に直す
  - 完了の確かめ方: `grep -rn "pripare"` が 0 件であること
  - _Requirements: 3.1_

- [x] 3.2 スクリプトの重複を確認して記録する
  - `test` と `test:all`、`dev:build` と `build`、`prev` の用途を確かめ、design の表のとおりに残す（変更が無いものは理由を develop-docs に書く）
  - _Requirements: 3.2, 3.3, 3.4_

- [x] 4. 依存と型検査
- [x] 4.1 宣言されていない依存を確かめる
  - `scripts/` が import する外部パッケージが `package.json` に宣言されていることを確かめる（`jsonc-parser` は ops-config-secrets で参照を消してある）
  - _Requirements: 4.1, 4.2_

- [x] 4.2 型検査とビルドを確かめる
  - `npm run test:type`・`npm run test:unit`・`npm run apigen`・`npm run build` が移動の前と同じに通ることを確かめる
  - `npm run dev` が起動する（astro.config.mjs の読み込みが通る）ことを確かめる
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. 重複する資材の統合（要件 6）
- [x] 5.1 E2E の設定を開発の雛形から作る
  - `config/e2e.example.json` を削除し、`scripts/e2e/run-e2e.mjs` が `config/develop.example.json` から接続先の 3 項目だけを偽の Bluesky に向けて上書きする
  - 完了の確かめ方: 生成された E2E 設定が、統合前の内容と値として一致し（キーの順序を除く）、`npm run test:e2e` が 7/7 で通る
  - _Requirements: 6.1, 6.2_
- [x] 5.2 生成関数を `generators.mjs` に統合する
  - `generate-oauth-key.mjs` を削除し、`generators.mjs` にシークレット名を引数に取る出力の入口を置く。`src/lib/oauth/client.ts` の参照を直す
  - 完了の確かめ方: `node scripts/secrets/generators.mjs OAUTH_CLIENT_KEY` が JWK を出し、未知の名前は終了コード 1 で終わる。`npm run test:unit` が通る
  - _Requirements: 6.3, 6.4_

## Implementation Notes

### feature 検証（kiro-validate-impl, 2026-11-10）

- 判定は `GO`。全試験（`npm run test:all`）は終了コード 0（unit 700 件通過・2 件スキップ、component 13、route 212、render 2、e2e 10）。タスクは全て `[x]`、`_Blocked:_` は無い。受入基準は全てタスクの `_Requirements` から参照されている（突き合わせで未参照 0 件）。TODO・秘密情報の検出に該当は無い。判断の項目（タスク間の結線・設計との一致・境界）は Codex（`codex_exec`、読み取り専用）の独立した検証を入力にし、指摘は Claude が実物で確かめて採否を決めた。
- 指摘と処置: (1) 要件 1.1・1.2: `scripts/architecture/` は本 spec の後に別の spec が作った領域。利用者の決定に従い、requirements.md の追補で領域の一覧に加えた。(2) 要件 1.3（kebab-case）: `scripts/` に camelCase のファイルが 7 件残っていたため、利用者の決定に従い改名し、参照（テスト・設定・steering・設計書）を更新した（`test:type`・`test:imports`・unit は通過）。(3) design.md の File Structure Plan が移動前のパスを残していたため、「現況との対応（2026-11-10 追補）」を加えた。
- 2026-11-10 追記: 次の未決は同日に決着した（`build:prepare` から `format` を外し、`.githooks/pre-commit` で整形する。roadmap.md の追補）。当時の記述: 残る未決（要件の外）: brief.md に書いた `build:prepare` の `prettier --write .`（E2E の実行でリポジトリ全体を整形する副作用）の見直しは、本 spec の受入基準に無く、未着手のまま残る（`testing.md` の「未決定・未検証」2）。
