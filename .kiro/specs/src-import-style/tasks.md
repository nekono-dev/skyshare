# Implementation Plan

- [x] 1. 変更の前の基準を記録する
- [x] 1.1 変更の前の基準（許容リスト・apigen・件数）を Implementation Notes に記録する
  - 許容リストが 70 件（`relativeDepth` 39・`crossRegionRelative` 18・`jsExtension` 13）であることを、`npm run test:imports` の出力で確かめ、記録している
  - 改名の前の `npm run apigen` が終了コード 0 で、`git status src/client` に差分がないことが記録されている
  - 件数の基準（unit 302・component 13・route 212・render 2・e2e 7）が Implementation Notes に記録されている
  - _Requirements: 3.2, 3.3, 4.2, 5.1_

- [x] 1.2 改名の前の OpenAPI ドキュメントの JSON を保存し、比較の手順を確かめる
  - `.cache/openapi-before.json` が存在し、`buildOpenApiDocument()` を `tsx` で呼んだ結果と、この JSON が同じ内容である
  - 比較の手順（`buildOpenApiDocument()` の JSON を書き出して、保存した JSON と比べる）が Implementation Notes に書かれている
  - _Requirements: 3.3_

- [x] 2. `lib/api/schema/` のフォルダ名を `[param]` の形にする
- [x] 2.1 6 フォルダを `git mv` で改名する
  - `v1/page/_dbIndex`・`v1/page/_dbIndex/_dbKey`・`v2/schedules/_id`・`v2/schedules/_id/images/_index`・`v2/surveys/_surveyId`・`v2/bsky/session/_did` が、それぞれ `[dbIndex]`・`[dbKey]`・`[id]`・`[index]`・`[surveyId]`・`[did]` になっている
  - `src/lib/api/schema/` の下に `_` で始まるフォルダがない
  - 改名は履歴に残る形（`git status` で rename と表示される）で行われている
  - _Requirements: 3.1_

- [x] 2.2 改名したフォルダを指す参照を更新する
  - `src/lib/api/schema/index.ts` の import の指定子が、改名後のフォルダを指している
  - `src/lib/survey/pathParams.ts` のコメントが、改名後の `[surveyId]` を指している
  - `npm run test:type` が終了コード 0 で通過する
  - _Depends: 2.1_
  - _Boundary: API スキーマの入口_
  - _Requirements: 3.1, 3.3_

- [x] 3. 領域をまたぐ相対 import と `.js` の表記を直す
- [x] 3.1 (P) `lib/api/schema/` の 32 ファイルで、3 段以上の `../` と領域をまたぐ相対 import を `@/` に直す
  - `lib/api/schema/` の中で、3 段以上の `../` を含む import が 0 件になる
  - 領域をまたぐ相対 import（`common.ts` の `../../image`・`../../video`）が `@/lib/image/...`・`@/lib/video/...` になっている
  - 同じ領域の 1〜2 段の相対 import（`../../common` など）は変わらない（要件 1.2 に従い残す）
  - 3 段以上の `../` の 39 行が、すべて `@/` で書かれている（改名後のパスで）
  - _Depends: 2.2_
  - _Boundary: API スキーマ_
  - _Requirements: 1.1, 1.2, 1.3, 2.1_

- [x] 3.2 (P) `lib/session/`・`lib/atproto/` の 3 ファイルの相対 import と `.js` を直す
  - `lib/session/cookies.ts` の `../../env` が `@/env` になっている
  - `lib/atproto/videoAuth.ts` の `../video/postVideoLimits` が `@/lib/video/postVideoLimits` になっている
  - `lib/session/bskySessionRefresh.ts` の `.js` の付いた 2 件が、拡張子なしの `@/` になっている
  - _Boundary: セッション, AT Protocol の処理_
  - _Requirements: 1.1, 2.1_

- [x] 3.3 (P) `pages/` と `components/account/LoginForm/` の `.js` の付いた import を直す
  - `pages/` の 8 ファイルと `components/account/LoginForm/index.tsx` で、`@/` の import から `.js` が消えている
  - `tests/fixtures/import-rules/` と `hls.js`（npm パッケージ）は変わらない
  - _Boundary: 入口（pages）, 設定の入力（components/account）_
  - _Requirements: 2.1_

- [x] 4. 許容リストを 0 件にする
- [x] 4.1 許容リストの 70 件をすべて削除し、検査の出力が 0 件になることを確かめる
  - `config/architecture/import-allowlist.json` の `entries` が空配列である（件数の数え方は既存の検査の出力に従う）
  - `npm run test:imports` の出力が「違反 0 件・許容 0 件・stale 0 件」になる
  - 検査の規則（`scripts/architecture/`）は変わっていない
  - 作業の途中で、許容リストに項目を追加していない（Implementation Notes に記録）
  - _Depends: 3.1, 3.2, 3.3_
  - _Boundary: 許容リスト_
  - _Requirements: 1.4, 2.2, 4.1, 4.2, 4.3_

- [x] 5. 検証
- [x] 5.1 型・生成物・OpenAPI ドキュメントが変わっていないことを確かめる
  - `npm run test:type` が終了コード 0 で通過する
  - `npm run apigen` の後に `git status src/client` に差分がない
  - 改名と変換の後の `buildOpenApiDocument()` の JSON が、`.cache/openapi-before.json` と一致する
  - _Depends: 4.1_
  - _Requirements: 3.2, 3.3_

- [x] 5.2 `npm run test:all` と e2e が通ることを確かめる
  - `npm run test:all` が終了コード 0 で通過し、件数が基準（unit 302・component 13・route 212・render 2・e2e 7）を下回らない
  - e2e の 7 件が、表記の変更の前と同じ名前で通過する
  - 許容リストの件数が 70 件以下のまま（0 件）
  - _Depends: 5.1_
  - _Requirements: 5.1, 5.3_

- [x] 5.3 テストの期待値が変わっていないことを確かめる
  - `git diff` で `tests/` の変更を確認し、変わったのが import のパスだけである（期待値・アサーションに変更がない）
  - 変更がない場合は、その旨を Implementation Notes に記録する
  - _Depends: 5.2_
  - _Requirements: 5.2_

## Implementation Notes

- 1.1（基準）: 許容リスト 70 件（relativeDepth 39・crossRegionRelative 18・jsExtension 13、違反 0・stale 0）。改名の前の `npm run apigen` は終了コード 0、`src/client` に差分なし。件数の基準は unit 302・component 13・route 212・render 2・e2e 7。
- 1.2（OpenAPI）: `.cache/openapi-before.json` を、同じ手順で再生成して比べ、同一であることを確かめた（比較は `cmp`）。
- 2.1・2.2（改名）: 6 フォルダを git mv で改名し、参照（schema/index.ts・pages・許容リストの from・pathParams のコメント）を更新。`npm run test:type` 終了コード 0、`test:imports` は違反 0・許容 70（経路の記録を追随）。OpenAPI の JSON は改名の前と同一。
- 3.1: `lib/api/schema/` の 42 行（3 段以上 39 行・領域をまたぐ 3 行）を `@/` にした（34 ファイル）。残る相対 import は同じ領域の 1〜2 段（`../../common` など、要件 1.2）。`tsc`・unit 302・route 212 が通過。
- 3.2・3.3: lib/session（cookies・bskySessionRefresh）と lib/atproto/videoAuth の 3 ファイル、pages の 9 ファイルと LoginForm の `.js` を除いた。`src/` 内の `.js` の import は 0 件（hls.js は npm の指定子で対象外）。`tsc` 終了コード 0。`test:imports` は違反 0・許容 0・stale 70（4.1 で削除）。
- 4.1: 許容リストの entries を空にした（70 件 → 0 件）。`test:imports` は違反 0・許容 0・stale 0。検査の規則は変更していない。
- 5.1 でブロック: 3.1 の `@/` 化の後、`npm run apigen:client`（orval）が `Cannot find module '@/lib/image/postImageLimits'` で失敗する。orval は設定ファイルを Node の require で読み、tsconfig の `paths` を解決しない（`apigen:doc` は tsx で動くため通る）。
  - 確認: `npx tsx node_modules/orval/dist/bin/orval.mjs --config config/orval.config.ts` で生成すると、`src/client/` に差分はなく終了コード 0（出力は変わらない）。
  - 選択肢: (a) `apigen:client` の起動を tsx 経由に変える（生成規則の変更。api-contract の境界）、(b) 3.1 を取り消し、schema の領域をまたぐ相対 import を残す（要件 1.1 と衝突）。
  - 現状: `test:all` は codegen（apigen）で失敗する。5.2 も同じ理由でブロック。
- 5.1〜5.3 完了（利用者の承認 (a) に従い、`apigen:client` を `tsx ./node_modules/.bin/orval --config config/orval.config.ts` に変更）: `test:type` 0・`apigen` 差分なし・OpenAPI の JSON は改名の前と同一。`test:all` は終了コード 0（unit 302・component 13・route 212・render 2・e2e 7）、許容 0・stale 0。`tests/` の変更なし。
- 設計の未決の論点は解決済み（2026-11-03 の利用者の確認）: 同じ領域の 1〜2 段の相対 import は残す（要件 1.2）。
- 審査（sanity review）の方式: inline（独立のサブエージェントは起動せず、同じ観点を本文脈で確かめた）。

### feature 検証（kiro-validate-impl, 2026-11-10）

- 判定は `GO`。全試験（`npm run test:all`）は終了コード 0（unit 700 件通過・2 件スキップ、component 13、route 212、render 2、e2e 10）。タスクは全て `[x]`、`_Blocked:_` は無い。受入基準は全てタスクの `_Requirements` から参照されている（突き合わせで未参照 0 件）。TODO・秘密情報の検出に該当は無い。判断の項目（タスク間の結線・設計との一致・境界）は Codex（`codex_exec`、読み取り専用）の独立した検証を入力にし、指摘は Claude が実物で確かめて採否を決めた。
- 指摘と処置: 重大な指摘は無い。`npm run test:imports` は違反 0。
