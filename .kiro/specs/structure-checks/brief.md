# Brief: structure-checks

## Problem

`components/` の配置は `componentLayout.test.ts` と `steeringRegions.test.ts` で検査されているが、`lib/`・`util/`・骨格（`layout/`）の配置は検査されていない。そのため、Phase 5 の組み替えを終えても、同じ種類の違反が再び入り込む。

## Current State

- `test:imports`（`scripts/architecture/`）は、層の方向（`lib` → `components`・`pages`）・循環・相対 import の深さ・`.js` 拡張子を検査する。
- `componentLayout.test.ts` は、部品フォルダの外のファイルを検査する。
- `steeringRegions.test.ts` は、`lib/` と `components/` の領域の一覧と実装の差を検査する。
- 検査の対象外: `lib` の基盤と業務の層（`lib-layers` で決める）、`util/` の利用元の数、`src/layout/` の不在、400 行を超えるファイル。

## Desired Outcome

- `lib` の基盤と業務の層の方向が検査される（`lib-layers` の規則）。
- `util/` に置かれたファイルが二つ以上の領域から使われることが検査される（利用元が一つなら違反として報告する）。
- `src/layout/` が存在しないことが検査される（骨格の一本化）。
- 許容リストにある例外は、理由を書いた上で記録される。

## Approach

- 既存の検査（`scripts/architecture/`・`tests/unit/scripts/`）の方式に合わせて、規則を追加する。
- 新しい規則は、既存の違反を許容リストに記録してから有効にする。

## Scope

- **In**: 上記の検査の追加、`structure.md` の「依存規則の検査」の表の更新、許容リストの更新。
- **Out**: 検査の対象の再設計（既存の規則の変更）、`scripts/` の検査（Phase 2 の範囲）、400 行の上限の検査（design で必要性を判断する）。

## Boundary Candidates

- `lib` の層の規則の検査
- `util` の利用元の検査
- 骨格の一本化の検査

## Out of Boundary

- 検査の基盤（`scripts/architecture/`）の書き換え。
- 既存の規則の緩和（規則の変更は steering の改訂と同じ変更で行う）。

## Upstream / Downstream

- **Upstream**: `layout-home`・`lib-layers`・`util-placement`・`components-small-areas`・`lib-large-files`（すべての配置が決まってから検査を有効にする）
- **Downstream**: なし

## Existing Spec Touchpoints

- **Extends**: `src-import-rules`（検査の規則を追加する）・`src-cycles`（循環の検査）
- **Adjacent**: `test-foundation`（テストの配置の方針）

## Constraints

- 検査を追加する変更は、検査が通る状態で終える（許容リストの記録を含む）。
- `npm run test:all` の結果は、着手時の件数を下回らない。
