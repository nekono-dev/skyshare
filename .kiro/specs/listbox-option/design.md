# Design Document

## Overview

**Purpose**: プルダウンとメンション・ハッシュタグの候補一覧で、選択肢の1行の見た目と操作を共通にする。
**Users**: プルダウンやメンション・ハッシュタグの候補から選ぶ利用者
**Impact**: 選択肢の1行の見た目と操作を共通にし、プルダウンと候補一覧で挙動を揃える。

### Goals

- 選択肢の1行の見た目・ハイライト・確定の操作。
- 候補一覧での選択肢行の利用。

### Non-Goals

- プルダウンの開閉と配置。
- 候補一覧の表示位置と候補の取得。

## Boundary Commitments

### This Spec Owns

- 選択肢の1行の見た目・ハイライト・確定の操作。
- 候補一覧での選択肢行の利用。

### Out of Boundary

- プルダウンの開閉と配置。
- 候補一覧の表示位置と候補の取得。

### Allowed Dependencies

- プルダウン（dropdown）と候補一覧（post-suggest）
- 共通 UI スタイル（`@layer ui`）

### Revalidation Triggers

- 選択肢行の入力（選択中・無効・アクティブの指定）を変えるとき
- 確定の契機（マウスボタンの押下）を変えるとき（入力欄のフォーカス維持に影響する）

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                                   | 責務                                 |
| ------------------------------------------------------ | ------------------------------------ |
| `src/components/common/ListboxOption/index.tsx`        | 選択肢の1行                          |
| `src/components/common/ListboxOption/index.module.css` | 行のハイライト・選択中・無効の見た目 |
| `src/components/post/SuggestPopover/index.tsx`         | 候補一覧での行の利用                 |

## Requirements Traceability

| Requirement   | Summary        | Components |
| ------------- | -------------- | ---------- |
| 1.1, 1.2, 1.3 | 共通の選択肢行 | D-1, D-2   |
| 2.1, 2.2      | 選択状態の表現 | D-1        |

## Components and Interfaces

#### D-1: 選択肢行

**Requirements**: 1.2, 1.3, 2.1, 2.2

```tsx
type ListboxOptionProps = {
  id: string // aria-activedescendant から参照する
  isActive: boolean
  isSelected?: boolean // プルダウンの選択中。候補一覧では未指定
  disabled?: boolean
  onHover: () => void
  onSelect: () => void
  children: React.ReactNode
}
;<div
  id={id}
  role="option"
  aria-selected={isSelected ?? isActive}
  aria-disabled={disabled || undefined}
  className={cx(
    styles.option,
    isActive && styles["option-active"],
    isSelected && styles["option-selected"],
    disabled && styles["option-disabled"],
  )}
  onMouseEnter={disabled ? undefined : onHover}
  onMouseDown={e => {
    e.preventDefault() // mousedown は blur より先に発火するため、フォーカスを維持できる
    if (!disabled) onSelect()
  }}
>
  {children}
</div>
```

`.option-selected` は太字と左端の強調線、`.option-disabled` は `--color-muted` の文字色と `cursor: not-allowed` にする。

#### D-2: 候補一覧での利用

**Requirements**: 1.1

| 項目         | 内容                                         |
| ------------ | -------------------------------------------- |
| 置き換え対象 | `SuggestPopover` の行の最外 `div`            |
| `children`   | アバター・表示名・ハンドル                   |
| `id`         | `${listboxId}-option-${index}`               |
| `isSelected` | 指定しない（アクティブ項目が選択状態になる） |

キャレット位置への表示、押下での確定、フォーカスの維持は候補一覧の挙動を変えない。

## Error Handling

- なし

## Testing Strategy

- Unit / Build Tests:
  - `npm run build`
- E2E/UI Tests:
  - `tests/e2e/dropdown.spec.ts` 表示テーマのプルダウンを開く → 選択中の項目が太字で、選択状態の属性を持つ
  - `tests/e2e/suggestPopover.spec.ts` 本文に「#」を入力して候補を上下キーで移動しクリックする → ハイライトが移動し、確定後も入力欄にフォーカスが残る
- テストの名前には、対応する基準 ID を `[listbox-option/<ID>]` の形で付ける（例: `[listbox-option/1.1]`）
