# 調査ログ

## 概要

- **機能**: `src-import-style`
- **調査の範囲**: 拡張（既存の `src/` の import の表記と、`lib/api/schema/` のフォルダ名）。外部の依存は追加しない。
- **主な発見**:
  - 許容リストの 70 件は、すべてこの spec の担当（`relativeDepth` 39・`crossRegionRelative` 18・`jsExtension` 13）。
  - 3 段以上の `../` は 39 行・31 ファイル（すべて `lib/api/schema/`）。領域をまたぐ相対 import は 18 行で、そのうち 13 行は上の 3 段以上と重なる。残る 5 行は 3 段未満（`lib/api/schema/common.ts` の 3 行、`lib/session/cookies.ts` の `../../env`、`lib/atproto/videoAuth.ts` の `../video/...`）。
  - `lib/api/schema/index.ts` は各エンドポイントを文字列の経路に割り当て、ファイルを `import` で列挙している。フォルダ名は経路にも生成物にも現れない。
  - `npm run apigen` の出力は、改名の前でも差分がない（ベースライン）。
  - OpenAPI のドキュメントは `buildOpenApiDocument()` が返すオブジェクトで、ファイルに書き出さずに取得できる。改名の前後で JSON を比べられる。

## 調査ログ

### 許容リストの内容

- **文脈**: 要件 4 は、許容リストの担当の項目を 0 件にすることを求める。
- **確認したこと**: `config/architecture/import-allowlist.json` の 70 件を、規則・ファイル・指定子ごとに確認した。
- **結果**: 対象のファイルは 45 件（`src/` 内の、3 段以上の `../`・領域をまたぐ相対 import・`.js` の付いた import を含むファイル）。内訳は `lib/api/schema/` 配下 32 件（共通の `common.ts` を含む）と、`lib/session/`・`lib/atproto/`・`pages/`・`components/account/LoginForm/` の 13 件。
- **示唆**: 許容リストは、完了の時点で `entries: []` にする。途中では増やさない（要件 4.2）。

### `lib/api/schema/` のフォルダ名の改名

- **文脈**: 要件 3.1 は `pages/` と同じ `[param]` の形を求める。
- **確認したこと**:
  - `schema/index.ts` は `./v2/schedules/_id/get` のように、フォルダ名を文字列の import として直接書いている。経路は `"/v2/schedules/{id}/"` の文字列で決まる。
  - `scripts/build/build-openapi-document.ts` は `paths` を import するだけで、フォルダを走査しない。
  - テストは `@/lib/api/schema/v2/feedback/post` だけを import している（改名の対象外）。
- **改名の対象**: 6 フォルダ（`v1/page/_dbIndex` → `[dbIndex]`、`v1/page/_dbIndex/_dbKey` → `[dbKey]`、`v2/schedules/_id` → `[id]`、`v2/schedules/_id/images/_index` → `[index]`、`v2/surveys/_surveyId` → `[surveyId]`、`v2/bsky/session/_did` → `[did]`）。
- **示唆**: 改名は `git mv` で行い、参照（`schema/index.ts` と、改名後のフォルダの中の相対 import）を一括で書き換える。

### 相対 import の変換の規則

- **文脈**: 要件 1 は、領域をまたぐ import を `@/` に、3 段以上の `../` をなくすことを求める。
- **代替案**:
  1. 3 段以上と領域をまたぐものだけを `@/` にする（採用）。
  2. `lib/api/schema/` の中の `../` をすべて `@/` にする。
- **選択**: 1。理由は、要件 1.2 が同じ領域の中の相対 import を認めているため。変更の差分を最小にできる（2 段以内の参照は残る）。
- **トレードオフ**: `lib/api/schema/` の中で、`./` と `../`（1〜2 段）と `@/` が混ざる。機械的な検査（`relativeDepth`）は 3 段以上だけを見るため、この混在は検査では止まらない。

### `.js` 拡張子の扱い

- **文脈**: brief は「統一の向きは design で決める」としていた。
- **確認したこと**: `structure.md` の「Import Organization」は「拡張子は付けない（`.js` を付けない）」と定めている。`tsconfig.json` は `allowImportingTsExtensions` と astro の strict 設定を使い、拡張子なしの import を解決できる。
- **選択**: 拡張子を付けない（steering の規約どおり）。要件 2.1 と一致する。
- **除外**: `tests/fixtures/import-rules/`（検査の負例として `.js` を含むのが意図）と `hls.js`（npm パッケージ）。

### 検証の方法（OpenAPI ドキュメントの同一性）

- **文脈**: 要件 3.2・3.3 は、改名の前後で生成物と経路の振る舞いが変わらないことを求める。
- **選択**: 改名の前に `buildOpenApiDocument()` の JSON を `.cache/openapi-before.json` に保存（約 300 KB）し、改名の後に同じ方法で比べる。`npm run apigen` の差分（`src/client/openapi/`）を併せて確かめる。
- **確認済み**: 改名の前の `npm run apigen` は差分なし（ベースライン）。

## 設計の判断

### 判断: `lib/api/schema/` 内の 1〜2 段の相対 import を残す

- **文脈**: 要件 1.2 と 1.3 は、同じ領域内の相対 import を認め、3 段以上だけを禁じる。
- **選択**: 1〜2 段は残す。3 段以上と、領域をまたぐものだけを `@/` にする。
- **根拠**: 要件に従い、差分を必要な範囲にとどめる。

## リスクと対策

- 書き換えの取りこぼし — 変換の後に `npm run test:imports`（違反 0・許容 0・stale 0）と `npm run test:type` で確かめる。
- フォルダ名の改名による参照の切れ — `tsc` と `test:unit`・`test:route` で検出する。
- OpenAPI ドキュメントの変化 — 改名の前の JSON との比較で検出する。
- 変換の誤り（相対 → `@/` の対応）— 変換後も、同じ `from` の指す先が同じ実ファイルであることを、`tsc` が検出する（同名のファイルの取り違えはまれだが、型の一致で守られる）。

## 参考

- `.kiro/steering/structure.md` 「Import Organization」「依存規則の検査」。
- `.kiro/specs/src-import-rules/`・`src-pages-thin/`（直前の検査と入口の整理）。
