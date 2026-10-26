# Design Document

## Overview

**Purpose**: 1つのダイアログやカードの中で、複数の表示を切り替えるタブの見た目と操作を共通にし、どの画面でも同じ操作で切り替えられるようにする。
**Users**: ダイアログやカードの中で表示を切り替える利用者（キーボード・支援技術の利用者を含む）
**Impact**: タブの見た目と操作を共通にし、どの画面でも同じ操作で切り替えられるようにする。

### Goals

- タブの並び・選択中の表示・無効の表示。
- マウスとキーボードによるタブの切り替え。
- タブとタブの中身の、支援技術への関連付け。

### Non-Goals

- タブの中身の描画と、中身のデータの取得。
- 選択中のタブの保存と、ページの再読み込み後の復元。

## Boundary Commitments

### This Spec Owns

- タブの並び・選択中の表示・無効の表示。
- マウスとキーボードによるタブの切り替え。
- タブとタブの中身の、支援技術への関連付け。

### Out of Boundary

- タブの中身の描画と、中身のデータの取得。
- 選択中のタブの保存と、ページの再読み込み後の復元。

### Allowed Dependencies

- 共通 UI スタイル（`@layer ui`）

### Revalidation Triggers

- タブの入力（無効・識別子の対応）を変えるとき（利用側のダイアログとカードが影響を受ける）
- キー操作（矢印・Home・End・ロービング tabindex）を変えるとき
- タップ領域の基準（44px）を変えるとき

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                                | 責務                                           |
| --------------------------------------------------- | ---------------------------------------------- |
| `src/components/common/TabButtons/index.tsx`        | タブの並びの描画と、押下とキー操作での切り替え |
| `src/components/common/TabButtons/index.module.css` | 選択中・無効・狭い画面の見た目                 |

## Requirements Traceability

| Requirement   | Summary              | Components |
| ------------- | -------------------- | ---------- |
| 1.1, 1.2, 1.3 | タブの表示と選択     | D-1        |
| 2.1, 2.2, 2.3 | キーボード操作       | D-2        |
| 3.1           | 支援技術への関連付け | D-1        |

## Components and Interfaces

#### D-1: タブの並びと見た目

**Requirements**: 1.1, 1.2, 1.3, 3.1

```tsx
export type TabItem<K extends string> = {
  key: K
  label: string
  disabled?: boolean
}
type TabButtonsProps<K extends string> = {
  idPrefix: string // 同じ画面に複数置くときの識別子の接頭辞
  ariaLabel: string
  items: TabItem<K>[]
  value: K
  onChange: (next: K) => void
}
export const tabId = (idPrefix: string, key: string): string => `${idPrefix}-tab-${key}`
export const panelId = (idPrefix: string, key: string): string => `${idPrefix}-panel-${key}`

<div role="tablist" aria-label={ariaLabel} className={styles["tab-list"]}>
  {items.map(item => (
    <button
      type="button"
      role="tab"
      id={tabId(idPrefix, item.key)}
      aria-controls={panelId(idPrefix, item.key)}
      aria-selected={item.key === value}
      tabIndex={item.key === value ? 0 : -1}
      disabled={item.disabled}
      className={cx(styles.tab, item.key === value && styles["tab-selected"])}
      onClick={() => onChange(item.key)}
      onKeyDown={event => handleKeyDown(event, item.key)}
    >
      {item.label}
    </button>
  ))}
</div>
```

- 中身は呼び出し側が `role="tabpanel"`・`id={panelId(...)}`・`aria-labelledby={tabId(...)}` を付けて描画し、選択中でない中身は `hidden` にする。
- `.tab-selected` は `font-weight: bold` と下端の `2px` の強調線、無効なタブは `--color-muted` の文字色にする。
- `@media (max-width: 639px)` で `.tab` の `min-height` を `44px` にする。

#### D-2: キー操作での切り替え

**Requirements**: 2.1, 2.2, 2.3

```ts
export const nextTabKey = <K extends string>(
  items: TabItem<K>[],
  current: K,
  key: "ArrowLeft" | "ArrowRight" | "Home" | "End",
): K // 無効なタブを飛ばし、左右は端で反対の端へ巡回する
```

| キー         | 選択するタブ                         |
| ------------ | ------------------------------------ |
| `ArrowRight` | 次の無効でないタブ（末尾では先頭へ） |
| `ArrowLeft`  | 前の無効でないタブ（先頭では末尾へ） |
| `Home`       | 先頭の無効でないタブ                 |
| `End`        | 末尾の無効でないタブ                 |

- `handleKeyDown` は上の4キーのときだけ `preventDefault` し、`onChange(nextTabKey(...))` を呼んでから、選んだタブの要素へ `focus()` する。
- 選択中のタブだけを `tabIndex=0` にし、Tab キーはタブの並びから中身へ移る。

## Error Handling

| 事象                            | 処理                                   |
| ------------------------------- | -------------------------------------- |
| すべてのタブが無効              | キー操作で選択を変えない               |
| `value` が `items` に含まれない | どのタブも選択状態にせず、描画は続ける |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/components/common/TabButtons.test.ts`
- E2E/UI Tests:
  - `tests/e2e/tabButtons.spec.ts` 投稿フォームの下書き・予約を開いてタブを押しキーで移動する → 選択中のタブが太字と下線になり、対応する中身だけが表示される
- テストの名前には、対応する基準 ID を `[tab-buttons/<ID>]` の形で付ける（例: `[tab-buttons/1.1]`）
