# Brief: comments-lib

## Problem

`src/lib`（`api/schema` を除く）のコメントに、経緯・旧 spec 参照・cc-sdd への言及が残っている。

## Current State

- `src/lib` の旧 spec 参照と経緯の記述が多数ある（件数は comment-policy の brief を参照）。
- 生成物（`src/client`）の元になる `src/lib/api/schema` は、この spec の対象外（comments-api-schema）。

## Desired Outcome

`src/lib`（schema を除く）の全ファイルのコメントが、現在の振る舞いと理由だけを述べている。

## Approach

各対象ファイルのコメントを、`.kiro/steering/comments.md` の基準に従って書き換える。

## Scope

- **In**: `src/lib/**`（`src/lib/api/schema/**` を除く）のコメント
- **Out**: `src/lib/api/schema/**`（comments-api-schema）、テストの題名（comments-tests）

## Boundary Candidates

`src/lib` の各領域（`structure-lib.md` の領域の一覧）

## Out of Boundary

層の規約（`structure-lib.md`）と領域の構成を変えない。

## Upstream / Downstream

- **Upstream**: comment-policy
- **Downstream**: comments-api-schema（schema の整理は lib の整理の後に行う）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: comments-api-schema

## Constraints

- 振る舞いを変えない。`npm run test:type`・`test:imports`・unit・component・route・render・e2e が通ること。
- コメントの基準は `.kiro/steering/comments.md`（comment-policy の成果物）に従う。
- 判別に迷うコメントは、残したうえで差分の報告に挙げる（黙って削らない）。
