# 選択肢行 設計書

## 1. 構成

| パス                                                   | 責務                                 |
| ------------------------------------------------------ | ------------------------------------ |
| `src/components/common/ListboxOption/index.tsx`        | 選択肢の1行                          |
| `src/components/common/ListboxOption/index.module.css` | 行のハイライト・選択中・無効の見た目 |
| `src/components/post/SuggestPopover/index.tsx`         | 候補一覧での行の利用                 |

## 2. 設計項目

### D-1: 選択肢行 (FR-2, FR-3, FR-4, FR-5)

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

### D-2: 候補一覧での利用 (FR-1)

| 項目         | 内容                                         |
| ------------ | -------------------------------------------- |
| 置き換え対象 | `SuggestPopover` の行の最外 `div`            |
| `children`   | アバター・表示名・ハンドル                   |
| `id`         | `${listboxId}-option-${index}`               |
| `isSelected` | 指定しない（アクティブ項目が選択状態になる） |

キャレット位置への表示、押下での確定、フォーカスの維持は候補一覧の挙動を変えない。

## 3. エラー処理

- なし
