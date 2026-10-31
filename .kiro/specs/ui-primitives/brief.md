# Brief: ui-primitives

## Problem

ダイアログ・入力・リスト・トグル・ローディングなどの部品が、画面ごとに別々の振る舞い（閉じ方、キー操作、無効状態）を持つと、利用者の操作が画面によって違う。

## Current State

- `src/components/common/`: 約 25 部品（フォルダごとに `index.tsx` と `index.module.css`）。例: `Overlay`・`ConfirmDialog`・`ChoiceDialog`・`FloatingBox`・`Dropdown`・`Checkbox`・`RadioButton`・`ToggleSwitch`・`CountedTextInput`（`autoGrowHeight.ts` を持つ）・`ChoiceQuestion`・`ComponentList`・`InfiniteScrollSentinel`・`Loading`・`Spinner`・`Avatar`・`TabButtons`・`Collapsible`・`NavigationBar`・`LocaleSelect`・`ThemeModeSelect`・`PageSizeSelect`。
- `src/util/listbox/`（`filter.ts`・`navigation.ts`）、`src/util/scrollLock.ts`。
- `src/styles/`: `tokens.css`（値）と `ui.module.css`・`*.ui.module.css`（共通クラス）。
- `Checkbox` は `variant`（`default`・`card`）で二つの見た目を持つ。`ChoiceQuestion` は survey でも使う。

## Desired Outcome

- 部品ごとの入出力（props）と発火する操作が記録されている。
- 文字数カウンタ付き入力、リストボックスのキー操作、無限スクロールの番兵の規則が記録されている。
- スタイルトークンと共通クラスの役割が記録されている。

## Approach

部品の共通の振る舞いを所有する。部品を使う画面の内容は、各機能の spec が所有する。

## Scope

- **In**: `components/common/`、`util/listbox/`、`util/scrollLock.ts`、`styles/`。
- **Out**: 画像・動画の部品（media-attachments）、投稿本文のエディタ（post-composition）、画面の骨格（platform-runtime）。

## Boundary Candidates

- 重なり（Overlay・ConfirmDialog・ChoiceDialog・FloatingBox・scrollLock）
- 入力と選択（CountedTextInput・Checkbox・RadioButton・ToggleSwitch・Dropdown・listbox）
- 一覧（ComponentList・InfiniteScrollSentinel・TabButtons・NavigationBar）
- スタイル（styles/）

## Out of Boundary

- 画像・動画の部品、投稿本文のエディタ、画面の骨格

## Upstream / Downstream

- **Upstream**: i18n（`LocaleSelect` などが翻訳を使う）。
- **Downstream**: 全画面 spec。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: media-attachments、post-composition。

## Constraints

- 部品は約 25 あるため、design で部品群ごとに分けて tasks の件数を抑える（20 件を超えるおそれ）。
- 既知の不一致: なし（確認済みの範囲）。
