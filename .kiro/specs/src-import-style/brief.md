# Brief: src-import-style

## Problem

import の書き方が混在している。`@/` が 1,030 件、相対 import が 311 件ある。`lib/api/schema/` では `../` が 3 段以上の相対 import が 39 件あり、最深は 6 段である。`.js` 拡張子の付いた `@/` が 27 件ある一方、大半は付いていない。steering は「領域をまたぐ import は `@/` に統一」と定めている。

## Current State

- `../` の段数の分布: 0 段 232、1 段 11、2 段 29、3 段 15、4 段 12、5 段 9、6 段 3。
- `../` 3 段以上の 39 件はすべて `lib/api/schema/` 配下（v2 が 38、v1 が 1）。最深は 6 段（3 件）。最も多いのは `lib/api/schema/v2/entry/post.ts`（3 件）。
- トップ階層別: `components` は `@/` 604・相対 89（すべて `./`）。`lib` は `@/` 180・相対 218（`../` が 77 件）で最も混在している。`pages` は `@/` 224・相対 1。`util` は `@/` 8・相対 0。
- `lib/api/schema/` のフォルダ名は `_id`・`_did`・`_surveyId`・`_index`・`_dbIndex`・`_dbKey`。`pages/` の `[id]`・`[did]`・`[surveyId]`・`[index]`・`[dbIndex]`・`[dbKey]` と対応するが、表記が違う。
- API の経路は `schema/index.ts` の文字列（例: `"/v2/schedules/{id}/"`）で決まり、フォルダ名は経路にも生成物（`apigen` の出力）にも影響しない。

## Desired Outcome

- 領域をまたぐ import はすべて `@/` で書かれる。
- 同じ部品フォルダの中だけ相対 import を使う（steering の規約どおり）。
- `../` が 3 段以上の import が 0 件になる。
- `.js` 拡張子の混在が解消される（統一の向きは design で決める）。
- `lib/api/schema/` のフォルダ名が `pages/` と同じ `[param]` 形式になり、`npm run apigen` の出力に差分が出ない。

## Approach（決定済み: 2026-11-01）

- **フォルダ名の改名**: `_id`→`[id]`、`_did`→`[did]`、`_surveyId`→`[surveyId]`、`_index`→`[index]`、`_dbIndex`→`[dbIndex]`、`_dbKey`→`[dbKey]`。import の書き換えを伴う。
- **完了の確認**: 改名の前後で `npm run apigen` を実行し、生成物（`src/client/openapi/`）と OpenAPI のドキュメントに差分がないことを確かめる。
- 機械で置換できるもの（相対 → `@/`、`.js` の統一）は一括で行い、テストで確かめる。
- 深い相対 import は、`@/` に書き換える。
- 表記の変更は、`src-import-rules` の検査で `@/` の規則を有効にしてから行う。
- 採らない案: `schema/` を `pages/` の隣に置く案。`pages/` 配下の `.ts` は Astro がルートとして扱うため、schema が公開ルートになる。

## Scope

- **In**: import の表記（相対 → `@/`、`.js` の統一、`../` 3 段以上の解消）、`lib/api/schema/` のフォルダ名の改名（上記 6 件）。
- **Out**: 依存の向き（`src-import-rules` と各移動の spec）、ファイルの移動（`src-folder-layout` まで）、生成物（`src/client/openapi/model/`）の表記。

## Boundary Candidates

- 相対 import → `@/`（`lib`・`components`・`pages`）
- `.js` 拡張子の統一
- `lib/api/schema/` のフォルダ名の改名

## Out of Boundary

- API の経路と入出力（`api-contract` の振る舞い）
- 依存の向き（`src-import-rules`）
- 生成物の生成規則（`apigen`）

## Upstream / Downstream

- **Upstream**: `src-folder-layout`（ファイルの配置が決まってから表記を整える）、`src-pages-thin`（`pages` の import が変わるため）
- **Downstream**: なし（Phase 3 の最後）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `api-contract`（API の経路と schema の対応。生成物の再生成を伴う）、`legacy-posts`（`/v1/page` の経路）、`surveys`（`[surveyId]` の経路）、`scheduled-posting`（`[id]` の経路）

## Constraints

- 表記の変更で、API の経路・入出力・状態コードを変えない。route テストで守る。
- `npm run apigen` の出力に差分が出ないこと（完了条件）。
- 検証の基準 272 件が全通過すること。
