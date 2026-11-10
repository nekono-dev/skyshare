# Brief: comments-api-schema

## Problem

生成物 `src/client/openapi/**` のコメントは、生成元 `src/lib/api/schema` の説明文の転写である。生成元が古い説明を持つため、生成物にも同じ経緯が残る。

## Current State

- `src/client/openapi` のコメントに出るのは、route の `summary`（約 35 件）と zod の説明（`description`、約 50 件）の文字列だけ。schema ファイルの JSDoc は生成物に出ない（確認済み）。
- `src/client` は gitignore 対象で、リポジトリの差分には出ない。OpenAPI 文書は配信されておらず（`docs/openapi.md` は設計の説明）、読み手は codegen を実行する開発者と AI。
- 生成は `npm run apigen`（`scripts/build/build-openapi-document.ts` と orval）。生成物は手で編集しない。

## Desired Outcome

生成元の説明が現在の振る舞いを述べ、`npm run codegen` の結果が生成元の説明の変更だけを反映する。

## Approach

1. `src/lib/api/schema/**` の説明を直す。2) `npm run codegen` で生成物を作り直す。3) 生成物の差分が説明文だけであることを確かめる（API の形は変えない）。

## Scope

- **In**: `src/lib/api/schema/**` のコメント、`src/client/openapi/**` の再生成
- **Out**: API の入出力の形・経路・バリデーション

## Boundary Candidates

API 契約（`lib/api`）の領域

## Out of Boundary

`scripts/build/build-openapi-document.ts` と orval の設定（ツールは変えない）。

## Upstream / Downstream

- **Upstream**: comments-lib（schema を含む src/lib の整理の後に行う）
- **Downstream**: なし

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: api-contract（API 契約の所有者）

## Constraints

- 振る舞いを変えない。`npm run test:type`・`test:imports`・unit・component・route・render・e2e が通ること。
- コメントの基準は `.kiro/steering/comments.md`（comment-policy の成果物）に従う。
- 判別に迷うコメントは、残したうえで差分の報告に挙げる（黙って削らない）。
- 再生成の前後で、`src/client/openapi` のコード（型・関数）に差分が無いこと。説明文の差分だけを許す。
