# 設計書

## 概要

`src/` の import の表記を、steering の「Import Organization」どおりにそろえる。領域をまたぐ相対 import を `@/` に直し、3 段以上の `../` をなくし、`.js` の拡張子を除く。あわせて、`lib/api/schema/` の 6 フォルダを `pages/` と同じ `[param]` の形に改名する。表記だけを変え、API の経路・入出力・状態コードは変えない。

完了の時点で、許容リストの 70 件（この spec の担当）を 0 件にする。検査の規則（`src-import-rules`）は変えない。

### 目標

- 領域をまたぐ import をすべて `@/` で書く。
- 3 段以上の `../` を 0 件にする。
- `src/` 内のモジュールへの import から拡張子を除く。
- `lib/api/schema/` の 6 フォルダを `[param]` の形にする。
- 許容リストを 0 件にする。

### 非目標

- API の経路・入出力・状態コード、生成物（`src/client/openapi/`）の内容の変更。
- 検査の規則（`scripts/architecture/`）の変更。
- ファイルの移動（`src-folder-layout` で完了済み）。
- `tests/`・`scripts/`・`config/` の import の表記（検査の対象は `src/` のみ）。

## 境界の約束

### この spec が所有するもの

- `src/` の `.ts`・`.tsx`・`.astro` の import の指定子（相対 → `@/`、`.js` の除去、改名後のフォルダ名への書き換え）。
- `lib/api/schema/` の 6 フォルダの名前。
- `config/architecture/import-allowlist.json` の項目（完了時に 0 件）。

### この spec が所有しないもの

- import が指すファイルの中身と、その振る舞い。
- 検査の規則と、検査のスクリプト（`scripts/architecture/`）。
- 生成物（`src/client/openapi/`）と、`apigen` の規則。
- `tests/`・`scripts/`・`config/` の相対 import（`src/` の検査の対象外）。

### 許容する依存

- 同じ領域の中の相対 import（`./`、および `../` の 1〜2 段）は残す（要件 1.2・1.3）。
- 領域をまたぐ import は `@/` だけを使う。

### 再検証の契機

- `lib/api/schema/index.ts` の import の並び（経路と operation の対応）の変更。
- `apigen` の出力（`src/client/openapi/`）と、OpenAPI のドキュメント（`buildOpenApiDocument()`）の差分の発生。
- 検査の規則（`crossRegionRelative`・`relativeDepth`・`jsExtension`）の変更。
- `apigen:client` の起動方法（orval を `@/` の解決できる tsx 経由で実行する。2026-11-03 の利用者の承認 (a)）。

## 変換の規則

| 対象                    | 変換前                                                                                                                                             | 変換後                                                    | 要件 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---- |
| 領域をまたぐ相対 import | `../../env`（`lib/session/cookies.ts`）、`../video/postVideoLimits`（`lib/atproto/videoAuth.ts`）、`../../image/...`（`lib/api/schema/common.ts`） | `@/env`・`@/lib/video/postVideoLimits`・`@/lib/image/...` | 1.1  |
| 3 段以上の `../`        | `../../../../../atproto/threadLimit` など（`lib/api/schema/` の 39 行）                                                                            | `@/lib/atproto/threadLimit` など                          | 1.3  |
| 同じ領域の 1〜2 段      | `../../common`（`lib/api/schema/` の中）                                                                                                           | 変更しない                                                | 1.2  |
| 拡張子                  | `@/lib/api/response.js`                                                                                                                            | `@/lib/api/response`                                      | 2.1  |
| 改名されたフォルダ      | `./v2/schedules/_id/get`                                                                                                                           | `./v2/schedules/[id]/get`（`@/` の形でも同じ）            | 3.1  |

- 改名は、`git mv` で行う（履歴を残す）。
- 変換の後の指定子は、`tsconfig` の `paths`（`@/*` → `src/*`）で解決される。
- `tests/fixtures/import-rules/` は検査の負例のため変更しない（`.js` を含むのが意図）。
- `hls.js`（npm パッケージ）は対象外。

## ファイル構成計画

### 改名（`git mv`）

| 移動前                                               | 移動後                                                 |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `src/lib/api/schema/v1/page/_dbIndex/`               | `src/lib/api/schema/v1/page/[dbIndex]/`                |
| `src/lib/api/schema/v1/page/_dbIndex/_dbKey/`        | `src/lib/api/schema/v1/page/[dbIndex]/[dbKey]/`        |
| `src/lib/api/schema/v2/schedules/_id/`               | `src/lib/api/schema/v2/schedules/[id]/`                |
| `src/lib/api/schema/v2/schedules/_id/images/_index/` | `src/lib/api/schema/v2/schedules/[id]/images/[index]/` |
| `src/lib/api/schema/v2/surveys/_surveyId/`           | `src/lib/api/schema/v2/surveys/[surveyId]/`            |
| `src/lib/api/schema/v2/bsky/session/_did/`           | `src/lib/api/schema/v2/bsky/session/[did]/`            |

### 書き換え（import の指定子のみ）

対象は 45 ファイル（`.cache/import-style-files.txt` に一覧を保存。Implementation Notes に残す）。

| 群                                           | 件数 | 内容                                                                                            |
| -------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `src/lib/api/schema/**`                      | 32   | 3 段以上の `../`・領域をまたぐ相対・改名後のフォルダ参照                                        |
| `src/lib/session/`・`src/lib/atproto/`       | 3    | `cookies.ts`（`../../env`）、`bskySessionRefresh.ts`（`.js`）、`videoAuth.ts`（`../video/...`） |
| `src/pages/**`                               | 8    | `.js` の除去（`v1/page.ts`・`v2/bsky/*.ts`・`v2/entries.ts`・`v2/entries/skyshare.ts`）         |
| `src/components/account/LoginForm/index.tsx` | 1    | `@/env.js` → `@/env`                                                                            |

### 更新（許容リスト）

| パス                                        | 変更                                   |
| ------------------------------------------- | -------------------------------------- |
| `config/architecture/import-allowlist.json` | `entries` を `[]` にする（完了の時点） |

## 構成要素と契約

### 変換の作業（一時的なスクリプト）

- 入力: `src/` の対象ファイル（45 件）、改名の対応表（6 件）。
- 処理: 各 import の指定子を、ファイルの位置から実パスに解決し、改名の対応表で新しい名前へ置き換え、`src/` からの `@/` の形に直す。`.js` は除去する。解決できない指定子は中断して報告する。
- 出力: 書き換えた指定子。対象外（同じ領域の 1〜2 段の相対）は触れない。
- 性質: 一度だけ使う。リポジトリにはコミットしない（検査が同じ規則を毎回見るため）。

### 検査（既存）

- `npm run test:imports`: 違反 0・許容 0・stale 0 を満たすこと。規則は既存の `crossRegionRelative`・`relativeDepth`・`jsExtension`。

## 要件のトレーサビリティ

| 要件 | 概要                                 | 構成要素・契約                                           | 検証                                      |
| ---- | ------------------------------------ | -------------------------------------------------------- | ----------------------------------------- |
| 1.1  | 領域をまたぐ import は `@/`          | 変換の規則（領域をまたぐ相対）                           | `test:imports`（`crossRegionRelative` 0） |
| 1.2  | 同じ領域の内側だけ相対               | 変換の規則（1〜2 段は残す）                              | `test:imports`・レビュー                  |
| 1.3  | `../` 3 段以上を含まない             | 変換の規則（3 段以上）                                   | `test:imports`（`relativeDepth` 0）       |
| 1.4  | 違反を報告する                       | 検査（既存）                                             | `test:imports`（既存の検査）              |
| 2.1  | 拡張子を付けない                     | 変換の規則（`.js` の除去）                               | `test:imports`（`jsExtension` 0）         |
| 2.2  | 違反を報告する                       | 検査（既存）                                             | `test:imports`                            |
| 3.1  | `[param]` の名前                     | 改名（6 フォルダ）                                       | `tsc`・`test:unit`・`test:route`          |
| 3.2  | `apigen` の出力に差分がない          | 検証（`git status src/client` と JSON の比較）           | `npm run apigen`・`git status`            |
| 3.3  | 経路・入出力・状態コードが変わらない | 検証（OpenAPI ドキュメントの JSON の比較・route テスト） | JSON の比較・`test:route`                 |
| 4.1  | 完了時に許容リストの担当 0 件        | 許容リスト（`entries: []`）                              | `test:imports`                            |
| 4.2  | 許容リストを増やさない               | 作業の規則（途中で追加しない）                           | `test:imports`（件数 70 以下）            |
| 4.3  | 途中で件数は減る方向                 | 作業の順序（変換ごとに減る）                             | `test:imports`（作業の記録）              |
| 5.1  | `test:all` 通過・件数の基準          | 検証                                                     | `npm run test:all`                        |
| 5.2  | テストの期待値を変えない             | 変換の規則（パスの変更のみ）                             | 差分の確認（`git diff tests/`）           |
| 5.3  | e2e 7 件が変わらない                 | 検証                                                     | `npm run test:e2e`                        |

## テスト戦略

- **検査（`test:imports`）**: 違反 0・許容 0・stale 0。規則の 3 種（領域をまたぐ相対・3 段以上・拡張子）が 0 件であることを、既存の検査で確かめる。
- **型（`test:type`）**: 改名と `@/` への書き換えで、解決できない指定子がないことを `tsc` で確かめる。
- **生成物（`npm run apigen`）**: 改名の後に、`src/client/openapi/` に差分がないことを `git status` で確かめる。
- **OpenAPI の同一性**: 改名の前に保存した `.cache/openapi-before.json` と、改名の後の `buildOpenApiDocument()` の JSON を比べ、差がないことを確かめる。
- **経路（route）**: 212 件が通過すること。schema を使う route テスト（`/v2/bsky/session`・`/v2/schedules/...`）が、経路と状態コードの期待値を変えずに通ること。
- **単体（unit）・コンポーネント（component）・描画（render）**: 基準の件数（302・13・2）を下回らないこと。
- **e2e**: 7 件が通過すること（表記の変更の前と同じ結果）。

## 移行とリスク

- 作業は、(1) 改名、(2) 変換、(3) 許容リストの削除、の順。各段階で `npm run test:type` と `npm run test:imports` を通す。
- 改名の前に、`.cache/openapi-before.json` を保存しておく（作業の 1 件目）。
- 変換の誤りは `tsc` で検出する（指す先の型が合わなければ失敗する）。
- 許容リストは、変換の後に 0 件になってから削除する（途中で stale の警告が出るのは許す。違反は出さない）。

## 未決の論点

- 解決済み（2026-11-03 の利用者の確認）: 同じ領域の 1〜2 段の相対 import（`lib/api/schema/` の中）は、要件 1.2 に従い残す。揃える場合は、別の spec で決める。
