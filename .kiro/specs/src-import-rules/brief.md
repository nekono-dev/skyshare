# Brief: src-import-rules

## Problem

`src/` の規約（三層・`lib` の UI 非依存・循環の禁止・`@/` の統一）は steering に書かれているが、機械では検査されていない。そのため違反が増え続けている（2026-11-01 の実測: `lib` の UI 依存 6 ファイル、循環 2 件、相対 import 311 件）。開発者は規約を読まないと違反に気づけない。

## Current State

- 依存の向き（`lib` → `components`）は現状 0 件で守られている。ただし検査はない。
- `util` → `lib`・`components`・`react` の依存は 0 件。検査はない。
- 循環（ファイル単位 2 件、計 18 ファイル）と、`@/` と相対 import の混在（`@/` 1,030 件に対し相対 311 件）は、どちらも検査されていない。

## Desired Outcome

- 規約の違反を検査する仕組みがあり、`npm run` の一つで実行できる。
- 現状の違反は許容リストに記録されており、新しい違反は検査で止まる。
- 後続の spec が違反を減らすと、許容リストの項目も減る。

## Approach

steering の規約を検査ルールとして書き、現状の違反を許容リストに記録する。検査の実装（既存の依存関係の検査ツールを使うか、スクリプトを書くか）は design で決める。新しい依存を追加する場合は、導入の理由と代替を design に書く。

## Scope

- **In**: 三層の依存の向き、`lib` の UI 依存（`react`・`react-easy-crop`）、`util` の依存の向き、循環（ファイル単位・ディレクトリ単位）、`@/` と相対 import の検査（相対の `../` 3 段以上の禁止を含む）、許容リストの記録、検査の実行の入口（`package.json` のスクリプトと CI への組み込み）。
- **Out**: 違反そのものの修正（後続の spec が行う）、テストの方針（`testing.md` が決める）、`scripts/` の検査（運用ツールの領域）。

## Boundary Candidates

- 検査ルールの定義（steering と一対一に対応する）
- 許容リストの形式と更新の手順
- 検査の実行の入口（npm スクリプトと CI）

## Out of Boundary

- 循環の解消（`src-cycles`）
- `lib` の UI 依存の移動（`src-lib-ui-boundary`）
- `pages` の責務の移動（`src-pages-thin`）
- フォルダの移動と import の書き換え（`src-folder-layout`・`src-import-style`）

## Upstream / Downstream

- **Upstream**: `.kiro/steering/structure.md`（規約の正）、`.kiro/steering/testing.md`
- **Downstream**: すべての Phase 3 の spec（検査の結果を完了の条件に使う）

## Existing Spec Touchpoints

- **Extends**: なし（既存の振る舞いは変えない）
- **Adjacent**: `test-foundation`（テストの配置と設定に触れない）、`ops-tooling-layout`（検査スクリプトの置き場所は運用ツールの規約に従う）

## Constraints

- 検査の追加で、既存の 272 件（type・unit・component・route・render・e2e）の結果を変えない。
- 許容リストは、どの spec が減らすかを明記する。
- 検査は既存の CI に組み込み、`npm run test:all` の一部にする（design で確認）。
