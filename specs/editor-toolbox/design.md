# エディタのツールボックス 設計書

## 1. 構成

| パス                                                    | 責務                                     |
| ------------------------------------------------------- | ---------------------------------------- |
| `src/components/common/EditorToolbox/index.tsx`         | ボタン列・パネルの描画・キーボード操作   |
| `src/components/common/EditorToolbox/index.module.css`  | ボタン列の折り返し                       |
| `src/components/common/EditorToolbox/toolboxReducer.ts` | 開いているパネルの状態遷移               |
| `src/components/common/FloatingBox/index.tsx`           | パネルのフローティング表示（変更しない） |

## 2. 設計項目

### D-1: ツールの型 (FR-1, FR-3, FR-12)

```ts
type EditorToolboxToolBase = {
  id: string // key・DOM id・状態管理に使う一意な識別子
  label: string
  icon?: React.ReactNode
  ariaLabel?: string
  disabled?: boolean
}
export type EditorToolboxPanelTool = EditorToolboxToolBase & {
  kind: "panel"
  renderPanel: (ctx: { close: () => void }) => React.ReactNode
}
export type EditorToolboxActionTool = EditorToolboxToolBase & {
  kind: "action"
  isActive?: boolean // 指定時はトグルボタンにする
  onClick: () => void
}
export type EditorToolboxTool = EditorToolboxPanelTool | EditorToolboxActionTool
type Props = { tools: EditorToolboxTool[]; className?: string }
```

`kind` の判別共用体により、パネル型に `onClick`、即時実行型に `renderPanel` を書く誤用を型検査で防ぐ。ツールボックスは `tools` 以外の入力を持たず、特定の機能や呼び出し側の状態の型を参照しない。

### D-2: 開閉の状態遷移 (FR-5, FR-6, FR-8)

```ts
export type ToolboxState = { openToolId: string | null }
export type ToolboxAction =
  { type: "TOGGLE_PANEL"; toolId: string } | { type: "CLOSE" }
export const initialToolboxState: ToolboxState = { openToolId: null }
export const toolboxReducer = (
  state: ToolboxState,
  action: ToolboxAction,
): ToolboxState => {
  switch (action.type) {
    case "TOGGLE_PANEL":
      return {
        openToolId: state.openToolId === action.toolId ? null : action.toolId,
      }
    case "CLOSE":
      return { openToolId: null }
  }
}
```

本体は `useReducer` で使う。即時実行型ツールは reducer を通さずに `tool.onClick()` を呼ぶ。

### D-3: パネルの表示と閉じ方 (FR-4, FR-7, NFR-1)

```tsx
{
  openTool && (
    <FloatingBox
      open
      position={{ top: rect.bottom + GAP_PX, left: rect.left }}
      onDismiss={() => dispatch({ type: "CLOSE" })} // スクロール・リサイズ
      role="dialog"
      aria-label={openTool.ariaLabel ?? openTool.label}
    >
      <div ref={panelRef}>
        {openTool.renderPanel({ close: () => dispatch({ type: "CLOSE" }) })}
      </div>
    </FloatingBox>
  )
}
```

- 位置は押されたボタンの `getBoundingClientRect()` から求めるため、折り返した行の位置でも正しく表示される。
- `FloatingBox` は要素の参照を外部へ渡さないため、パネルの中身をラッパーの `div` で囲み、その `ref` で外側クリックを判定する。`FloatingBox` の API は変更しない。
- パネルが開いている間、`document` に `pointerdown` と `keydown` を登録する。`pointerdown` はパネルとボタン列の外側なら `CLOSE` を送り、`keydown` は `Escape` で `CLOSE` を送る。

### D-4: レイアウトとキーボード (FR-2, FR-9, FR-10, FR-11)

| 要素               | 実装                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| ボタン列           | `role="toolbar"`、`display: flex; flex-wrap: wrap; gap: var(--space-1)`       |
| パネル型のボタン   | `aria-expanded={openToolId === tool.id}`、`aria-haspopup="dialog"`            |
| 即時実行型のボタン | `isActive` があるときだけ `aria-pressed={tool.isActive}`                      |
| フォーカス         | roving tabindex。フォーカス対象だけ `tabIndex={0}`、他は `-1`                 |
| 左右の矢印キー     | `disabled` を飛ばして配列の順に前後へ移動する。上下キーでの行の移動は行わない |
| 閉じたとき         | 直前に開いていたツールのボタンへ `focus()` を戻す                             |

Enterキーと Spaceキーによる実行は `<button>` の既定の動作に任せる。

## 3. エラー処理

- なし
