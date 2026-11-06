# Brief: components-small-areas

## Problem

`src/components/` の中に、部品が 1〜4 件しかない領域が複数ある（`share` 1・`feedback` 2・`privacy` 2・`i18n` 2・`help` 4）。小さい領域は、どこに属するかを読む人が判断しにくい。

## Current State（2026-11-03 の実測）

- `components/share`（1 件）: `IntentShareDialog`。利用元は composer・timeline などの共有の処理。
- `components/feedback`（2 件）・`components/privacy`（2 件）・`components/help`（4 件）: それぞれ一つの画面の部品。
- `components/i18n`（2 件）: 翻訳の入口（`useTranslation`・`renderSlots`）。他の多数の部品から import される。
- 部品フォルダの規約（1 部品 1 フォルダ・利用元の内側）は、`structure.md` で定まっている。

## Desired Outcome

- 小さい領域のそれぞれについて、「統合する」か「残す」かが、利用元の実測に基づいて記録される。
- 統合する場合は、部品の利用元の内側に置かれる（`structure.md` の規則）。
- 残す場合は、理由が `structure.md` に書かれる（例: `components/i18n` は多数の部品から import される翻訳の入口のため移動しない）。

## Approach（決定済み 2026-11-03: C-A 規約維持＋小領域統合）

- 各領域の利用元を実測し、統合先を決める。`components/i18n` は移動しない（入口のため）。
- 統合の判断は、`structure.md` の「利用元の内側に置く」規則で行う。

## Scope

- **In**: `components/share`・`feedback`・`privacy`・`help` の統合の判断と移動。`structure.md` の領域一覧の更新。
- **Out**: `components/i18n`（移動しない）、部品の中身（表示・操作）、`common/` の分類（Phase 4 で決定済み）、`lib/` の層（`lib-layers`）。

## Boundary Candidates

- 小さい部品領域の統合判断

## Out of Boundary

- 部品の振る舞い・表示の変更。
- `common/` の分類の再編。

## Upstream / Downstream

- **Upstream**: `util-placement`（`util/` から移る部品の置き場が決まってから）
- **Downstream**: `structure-checks`

## Existing Spec Touchpoints

- **Extends**: `src-component-nesting`（利用元の内側に置く規則を適用する）
- **Adjacent**: `feedback`（フォームの仕様）・`help-privacy`（FAQ と文言）・`share`（外部共有の部品）

## Constraints

- 利用元が複数の領域にまたがる部品は、無理に統合しない（規則に従う）。
- `npm run test:all` の結果は、着手時の件数を下回らない。
