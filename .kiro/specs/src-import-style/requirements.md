# 要件書

## 概要

`src/` の import の書き方を、steering の規約（`structure.md`「Import Organization」）どおりにそろえる。領域をまたぐ import は `@/` に統一し、相対 import は同じ領域の中だけに限る。拡張子 `.js` の付いた import をなくし、`lib/api/schema/` の深い相対 import（`../` 3 段以上）をなくす。あわせて、`lib/api/schema/` のフォルダ名を `pages/` と同じ `[param]` の形にそろえる。

利用者に見える API の経路・入出力・状態コードは変えない。表記の変更だけを行う。

2026-11-03 の確認（現在のコードの実測）:

- 許容リスト（`config/architecture/import-allowlist.json`）の 70 件は、すべてこの spec が担当する（`relativeDepth` 39 件・`crossRegionRelative` 18 件・`jsExtension` 13 件）。
- 相対 import は `src/` 全体で 330 件、`.js` で終わる import は 13 件（`src-import-rules` の検査の対象である `src/` 内のモジュールに限る）。

## 境界の文脈

- **対象内**: `src/` の import の表記（相対 import の `@/` への書き換え、`.js` の除去、`../` 3 段以上の解消）、`lib/api/schema/` のフォルダ名の改名（`_id`・`_did`・`_surveyId`・`_index`・`_dbIndex`・`_dbKey` を、`[id]`・`[did]`・`[surveyId]`・`[index]`・`[dbIndex]`・`[dbKey]` へ）、それに伴う許容リストの項目の削除。
- **対象外**: API の経路・入出力・状態コードの変更、依存の向きの変更（`src-import-rules` の規則そのものを変えること）、ファイルの移動（`src-folder-layout` で完了済み）、生成物（`src/client/openapi/model/`）の表記、新しい依存の追加。
- **隣接する期待**: 改名の前後で `npm run apigen` の生成物（`src/client/openapi/` と OpenAPI のドキュメント）に差分が出ないこと。API の経路は `lib/api/schema/index.ts` の文字列で決まり、フォルダ名には依存しない。

## 要件

### 1. 領域をまたぐ import の表記

**目的:** 開発者として、どの import が領域をまたぐかを、表記だけで判断したい。

#### 受入基準

1. The 実装 shall `src/` の領域（`lib`・`components`・`pages`・`util`・`layout`・`i18n` を含む）をまたぐ import を、`@/` で書く。
2. The 実装 shall 同じ領域の内側の import だけを相対（`./` または `../`）で書く。
3. The 実装 shall `../` を 3 段以上つなぐ相対 import を含まない。
4. If 領域をまたぐ相対 import が書かれたとき, the 構造の検査（`npm run test:imports`）shall その違反を報告する。

### 2. 拡張子の表記

**目的:** 開発者として、import の書き方を 1 通りにしたい。

#### 受入基準

1. The 実装 shall `src/` 内のモジュールへの import に、拡張子（`.js` を含む）を付けない。
2. If 拡張子の付いた `src/` 内のモジュールの import が書かれたとき, the 構造の検査 shall その違反を報告する。

### 3. `lib/api/schema/` のフォルダ名

**目的:** 開発者として、API の経路のパラメータに対応するフォルダ名を、`pages/` と同じ形で読みたい。

#### 受入基準

1. The `src/lib/api/schema/` shall パラメータに当たるフォルダを、`pages/` と同じ `[param]` の形で名付ける（`[id]`・`[did]`・`[surveyId]`・`[index]`・`[dbIndex]`・`[dbKey]`）。
2. When `npm run apigen` を改名の前後で実行したとき, the 生成物（`src/client/openapi/`）と OpenAPI のドキュメント shall 差分を生じない。
3. The API shall 改名の前後で、同じ経路・同じ入力・同じ出力・同じ状態コードで応答する。

### 4. 許容リストと検査

**目的:** 開発者として、表記の規則が機械で守られ、例外が増えないことを確かめたい。

#### 受入基準

1. When 本 spec の作業が完了したとき, the 許容リスト shall この spec の担当の項目（`relativeDepth`・`crossRegionRelative`・`jsExtension`）を 1 件も含まない。
2. The 作業 shall 許容リストに新しい項目を追加しない（許容リストの件数は 70 件から増えない）。
3. While 作業の途中である間, the 許容リスト shall 残る項目の数だけを減らす方向に変わる。

### 5. 既存の検証と振る舞いの不変

**目的:** 開発者として、表記の変更で振る舞いが変わっていないと確かめたい。

#### 受入基準

1. The 変更 shall `npm run test:all` が終了コード 0 で通過し、件数が `src-folder-layout` の完了時の基準（unit 302・component 13・route 212・render 2・e2e 7）を下回らない。
2. The 変更 shall 既存のテストの期待値を変えず、変更は import のパスと、改名したフォルダのパスだけにする。
3. The e2e（7 件）shall 表記の変更の前と同じ結果で通過する。
