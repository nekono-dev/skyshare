# Implementation Plan

- [x] 1. 設定の分配
- [x] 1.1 雛形を用意する
  - `config/live.example.json`（`identifier`・`service`）と `.dev.vars.template` の `SKYSHARE_E2E_APP_PASSWORD` の項目を追加する
  - 完了の確かめ方: 雛形が追跡され、実際の `config/live.json` が gitignore の対象であること
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 1.2 `.env.e2e`・`.env.e2e.template` と参照を廃止する
  - `.env.e2e.template` を削除し、`.gitignore` の `.env.e2e` の行を削除する。`E2E_ENV` の参照は DEVELOP.md（develop-docs の 4.2）で消す
  - 完了の確かめ方: `grep -rn "E2E_ENV\|\.env\.e2e" --exclude-dir=node_modules --exclude-dir=.kiro` が 0 件
  - _Requirements: 2.4_

- [x] 2. 設定の読み取り（純粋な関数）
- [x] 2.1 `scripts/lib/liveConfig.mjs` を作る
  - `readLiveConfig`・`liveSkipReason`・`expectSessionContract` を作る。`process.env` は読まない
  - 完了の確かめ方: 単体テスト（3.1）が通る
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1_

- [x] 2.2 単体テストを追加する
  - `tests/unit/scripts/liveConfig.test.ts`: 設定の無い・パスワードの空・形式の不正・正常の各ケース、秘密を例外に含めないこと
  - 完了の確かめ方: `npm run test:unit` が通る
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. live テストの本体
- [x] 3.1 `vitest.live.config.ts` と `npm run test:live` を作る
  - `include` は `tests/live/**/*.test.ts` だけ。`test:all` には入れない
  - 完了の確かめ方: `npm run test:live` が、設定が無い環境で終了コード 0 で、全て skip と表示して終わる
  - _Requirements: 1.1, 1.3, 5.2_

- [x] 3.2 `tests/live/atprotoContract.test.ts` を作る
  - 正しいパスワードでセッションを作り DID・ハンドルを確かめる。誤ったパスワードで 401 と `AuthenticationRequired` を確かめる。`resolveHandle`・`getProfile` の応答のハンドルを確かめる。書き込みは行わない
  - 設定が無いときは `describe.skipIf` で全て skip する
  - 完了の確かめ方: 設定の無い環境で skip になること（実通信は利用者の環境で確かめる）
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 3.1_

- [x] 4. 既存の設定との分離と文書
- [x] 4.1 unit・E2E などの設定が `tests/live/` を含まないことを確かめる
  - 各 `vitest.*.config.ts` と `playwright.config.ts` の対象を確かめる
  - _Requirements: 5.1_

- [x] 4.2 steering の live 層の行を更新する
  - `.kiro/steering/testing.md` の live の行を「任意・ローカルのみ・CI 対象外」に改める
  - _Requirements: 1.2_

## Implementation Notes

### feature 検証（kiro-validate-impl, 2026-11-10）

- 判定は `GO`。全試験（`npm run test:all`）は終了コード 0（unit 700 件通過・2 件スキップ、component 13、route 212、render 2、e2e 10）。タスクは全て `[x]`、`_Blocked:_` は無い。受入基準は全てタスクの `_Requirements` から参照されている（突き合わせで未参照 0 件）。TODO・秘密情報の検出に該当は無い。判断の項目（タスク間の結線・設計との一致・境界）は Codex（`codex_exec`、読み取り専用）の独立した検証を入力にし、指摘は Claude が実物で確かめて採否を決めた。
- 指摘と処置: (1) 要件 4.1〜4.3: 実アカウントの認証情報が要るため未確認だった。利用者の承認を得て `npm run test:live` を実行し、3 件が通過した（2026-11-10、終了コード 0。値は表示していない）。(2) 要件 2.4（`.env.e2e` とそれを参照する記述を持たない）: `.gitignore` に `.env.e2e` の行と説明が残っていたため削除した（手元に `.env.e2e` が無いことを確かめた）。(3) design.md に「現況との対応（2026-11-10 追補）」を加えた（`scripts/lib/live-config.mjs` への改名を含む）。
- 要件 1.2: `test:all`・`.githooks/pre-push`・`.github/workflows/` は live を実行しない（`package.json` と workflow の定義で確かめた）。
