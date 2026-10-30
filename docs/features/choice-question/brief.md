# Brief: choice-question

## Problem

アンケートなど、選択式の質問を表示する画面が、単一選択と複数選択を切り替えて再利用できる部品を持たない。

## Current State

`RadioButton` と `Checkbox`（card）が `src/components/common/` にあるが、質問ひとまとまりとして扱う部品はない。

## Desired Outcome

質問文と選択肢を渡すと、種別（単一選択・複数選択）に応じて適切な部品で描画し、選択の変化を通知する共通部品がある。

## Approach

既存の `RadioButton` と `Checkbox` を種別で切り替えるだけの薄い部品にする。アンケートの知識（言語・「回答しない」）を持たない。

## Scope

- **In**: 質問文・選択肢の描画、単一選択と複数選択の切り替え、選べる数の上限、無効状態、アクセシビリティ（グループのラベル）。
- **Out**: アンケートの設定の読み込み、言語の選択、回答の送信、ダイアログ。

## Boundary Candidates

- 質問ひとまとまりの描画と選択状態の通知

## Out of Boundary

- 文言の多言語化（呼び出し側が選んだ文言を渡す）、「回答しない」の特別扱い

## Upstream / Downstream

- **Upstream**: `RadioButton`・`Checkbox`（既存の共通部品）
- **Downstream**: survey-form

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `listbox-option`、`dropdown`

## Constraints

共通 UI のスタイル規約（`@layer ui`、CSS モジュール）と、アロー関数のコンポーネントの規約に従う。
