# Brief: comments-components-pages

## Problem

`src/components`・`src/pages`・`src/` 直下（env.ts・vars.ts・worker.ts・middleware.ts）・`src/types`・`src/util`・`src/styles` のコメントに、経緯・旧 spec 参照・cc-sdd への言及が残っている。

## Current State

- `src/components` と `src/pages` に旧 spec 参照（`specs/timeline`・`specs/entry-detail` など）が多数ある。
- `src/util` の JSDoc にも経緯が残っている。

## Desired Outcome

これらのファイルのコメントが、現在の振る舞いと理由だけを述べている。

## Approach

各対象ファイルのコメントを、`.kiro/steering/comments.md` の基準に従って書き換える。

## Scope

- **In**: `src/components/**`・`src/pages/**`・`src/*.ts`・`src/types/**`・`src/util/**`・`src/styles/**` のコメント
- **Out**: `src/lib/**`（comments-lib）、`src/client/**`（生成物）、テストの題名（comments-tests）

## Boundary Candidates

コンポーネントの単位（`src/components` の領域）

## Out of Boundary

部品の配置（`structure-components.md` の規約）を変えない。

## Upstream / Downstream

- **Upstream**: comment-policy
- **Downstream**: なし

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: comments-lib（参照の整合のため）

## Constraints

- 振る舞いを変えない。`npm run test:type`・`test:imports`・unit・component・route・render・e2e が通ること。
- コメントの基準は `.kiro/steering/comments.md`（comment-policy の成果物）に従う。
- 判別に迷うコメントは、残したうえで差分の報告に挙げる（黙って削らない）。
