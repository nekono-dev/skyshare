# Brief: comments-tests

## Problem

`tests/` のコメントとテストの題名に、「要件 x.y」・AC/FR タグ・旧 spec 名・経緯が残っている。

## Current State

- `tests/unit`・`tests/route`・`tests/e2e`・`tests/component`・`tests/render`・`tests/support`・`tests/fixtures` が対象。
- テストの題名の要件番号は、振る舞いの文言に置き換える（確認済みの方針）。題名が変わると ID も変わる。
- `config/test/` の設定ファイルのコメントも含む。

## Desired Outcome

テストのコメントと題名が、検証する振る舞いを述べている。要件番号・spec 名は残らない。

## Approach

各対象ファイルのコメントを、`.kiro/steering/comments.md` の基準に従って書き換える。
題名は、検証している振る舞いを `testing.md` の規則（題名の言語）に従って書く。

## Scope

- **In**: `tests/**`・`config/test/**` のコメントと題名
- **Out**: src の実装（comments-lib・comments-components-pages）、テストの期待値（振る舞いの変更）

## Boundary Candidates

テストの層（unit・route・component・render・e2e）

## Out of Boundary

テストの期待値と振る舞いの検証内容を変えない。

## Upstream / Downstream

- **Upstream**: comment-policy、test-foundation（`testing.md`）
- **Downstream**: なし

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: live-tests（tests/live）、test-foundation

## Constraints

- 振る舞いを変えない。`npm run test:type`・`test:imports`・unit・component・route・render・e2e が通ること。
- コメントの基準は `.kiro/steering/comments.md`（comment-policy の成果物）に従う。
- 判別に迷うコメントは、残したうえで差分の報告に挙げる（黙って削らない）。
- テストの件数は変わらないこと（題名の変更だけで件数が増減しないこと）。
