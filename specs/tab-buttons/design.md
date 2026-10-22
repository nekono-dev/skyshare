# タブ切り替え 設計書

## 1. 構成

| パス                                                | 責務                                           |
| --------------------------------------------------- | ---------------------------------------------- |
| `src/components/common/TabButtons/index.tsx`        | タブの並びの描画と、押下とキー操作での切り替え |
| `src/components/common/TabButtons/index.module.css` | 選択中・無効・狭い画面の見た目                 |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: タブの並びと見た目 (FR-1, FR-2, FR-5, NFR-1)

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

### D-2: キー操作での切り替え (FR-3, FR-4, FR-6)

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

## 4. エラー処理

| 事象                            | 処理                                   |
| ------------------------------- | -------------------------------------- |
| すべてのタブが無効              | キー操作で選択を変えない               |
| `value` が `items` に含まれない | どのタブも選択状態にせず、描画は続ける |
