# EditorToolbox 設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

## 1. 配置・依存関係

```
src/components/common/EditorToolbox/
  index.tsx            # 本体コンポーネント（デフォルトエクスポート）とEditorToolboxTool型
  index.module.css      # ボタン列・折り返しレイアウトのスタイル
  toolboxReducer.ts      # 「どのパネルが開いているか」の状態遷移ロジック（純粋関数、Reactに非依存）
```

依存する既存コンポーネント: `src/components/common/FloatingBox`（パネルのフローティング表示・位置クランプ・スクロール/リサイズ時の自動消去）。

## 2. 型設計

```ts
// src/components/common/EditorToolbox/index.tsx
type EditorToolboxToolBase = {
  /** ボタンのReact key・DOM id・状態管理に使う一意な識別子 */
  id: string
  /** ボタンに表示するラベル。アイコンのみの表示にする場合もaria-labelとして使用する */
  label: string
  icon?: React.ReactNode
  /** アイコンのみ表示する場合等、labelと別に読み上げテキストを与えたい場合に指定する */
  ariaLabel?: string
  disabled?: boolean
}

export type EditorToolboxPanelTool = EditorToolboxToolBase & {
  kind: "panel"
  /** このツールのパネルが開いているかどうかをボタンの見た目（aria-expanded）に反映する。
   *  EditorToolbox内部の開閉状態から自動算出されるため、通常ホスト側が指定する必要はない。 */
  renderPanel: (ctx: { close: () => void }) => React.ReactNode
}

export type EditorToolboxActionTool = EditorToolboxToolBase & {
  kind: "action"
  /** トグルボタンとしての押下状態（aria-pressed）に反映する */
  isActive?: boolean
  onClick: () => void
}

export type EditorToolboxTool = EditorToolboxPanelTool | EditorToolboxActionTool

type Props = {
  tools: EditorToolboxTool[]
  className?: string
}
```

`kind` によるunion型により、パネル型ツールに `onClick` を書いてしまう、即時実行型ツールに `renderPanel` を書いてしまうといった誤用をTypeScriptの型チェックで防止する。

## 3. 状態遷移ロジック（`toolboxReducer.ts`）

「現在どのパネル型ツールのパネルが開いているか」という状態のみを、Reactに依存しない純粋なreducerとして切り出す。既存の `src/components/PostForm/shareTogglesReducer.ts` と同じ設計パターン（コンポーネント内の複雑な状態遷移をreducerへ切り出し、Node環境でテスト可能にする）を踏襲する。

```ts
// src/components/common/EditorToolbox/toolboxReducer.ts
export type ToolboxState = {
  openToolId: string | null
}

export type ToolboxAction =
  | { type: "TOGGLE_PANEL"; toolId: string }
  | { type: "CLOSE" }

export const initialToolboxState: ToolboxState = { openToolId: null }

export const toolboxReducer = (
  state: ToolboxState,
  action: ToolboxAction,
): ToolboxState => {
  switch (action.type) {
    case "TOGGLE_PANEL":
      // 開いているパネルと同じボタンが押された場合は閉じる。異なる場合は
      // 開いていたパネルを閉じてから新しいパネルを開く（同時に複数開かない）。
      return {
        openToolId: state.openToolId === action.toolId ? null : action.toolId,
      }
    case "CLOSE":
      return { openToolId: null }
  }
}
```

本体コンポーネントは `useReducer(toolboxReducer, initialToolboxState)` でこれを利用する。即時実行型ツール（`kind: "action"`）のボタン押下時は、reducerを経由せず直接 `tool.onClick()` を呼ぶ（パネル開閉状態に影響しない）。

## 4. パネル表示（`FloatingBox`の流用）

各パネル型ツールのボタンには `ref` を張り、押下時に `button.getBoundingClientRect()` からパネルのアンカー位置（`{ top: rect.bottom + GAP_PX, left: rect.left }`）を算出する。算出した位置と `openToolId === tool.id` を`open`として、`FloatingBox` にそのまま渡す。

```tsx
{tools.map(tool =>
  tool.kind === "panel" && state.openToolId === tool.id ? (
    <FloatingBox
      key={tool.id}
      open
      position={panelPositions[tool.id] ?? null}
      onDismiss={() => dispatch({ type: "CLOSE" })}
      role="dialog"
      aria-label={tool.ariaLabel ?? tool.label}
    >
      {tool.renderPanel({ close: () => dispatch({ type: "CLOSE" }) })}
    </FloatingBox>
  ) : null,
)}
```

`FloatingBox` がすでに提供する機能（ビューポート内クランプ、スクロール/リサイズでの自動 `onDismiss`、`document.body`へのポータル描画、最前面表示）をそのまま利用するため、EditorToolbox側で位置計算の補正やポータル管理を再実装する必要はない。外側クリックでの消去は `FloatingBox` 自体は提供しない（用途によって意味が異なるため各利用側の責務、と`FloatingBox`自身のコメントに明記されている）ため、EditorToolbox側で以下を追加実装する。

```ts
useEffect(() => {
  if (!state.openToolId) return
  const handlePointerDown = (e: PointerEvent) => {
    const panelEl = panelRef.current
    const toolboxEl = toolboxRef.current
    if (panelEl?.contains(e.target as Node)) return
    if (toolboxEl?.contains(e.target as Node)) return // ツールボタン自身のクリックは既存のtoggleロジックに任せる
    dispatch({ type: "CLOSE" })
  }
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") dispatch({ type: "CLOSE" })
  }
  document.addEventListener("pointerdown", handlePointerDown)
  document.addEventListener("keydown", handleKeyDown)
  return () => {
    document.removeEventListener("pointerdown", handlePointerDown)
    document.removeEventListener("keydown", handleKeyDown)
  }
}, [state.openToolId])
```

`FloatingBox` はポータル先が `document.body` 直下になるため、パネル内部のDOM要素の参照は `FloatingBox` が公開する（または `renderPanel` 内部でツール側が用意する）ラッパー要素の `ref` を使って外側クリック判定を行う。この受け渡し方法（`FloatingBox`にpanel用refを渡せるようにするか、`renderPanel`の戻り値ルート要素にツール側でrefを付けるか）は実装時に`FloatingBox`の既存API（`Props`に`ref`の受け口が無い場合はラップ用のdivを1枚追加する等）を確認して決定する。

## 5. 折り返しレイアウト

ボタン列のコンテナに `display: flex; flex-wrap: wrap; gap: ...` を適用する（既存の `ui.module.css` の `toolbar-wrap` クラスと同等の実装パターンを踏襲する）。折り返しはブラウザの通常のflexboxレイアウトに任せるため、EditorToolbox側で行数やボタン位置を明示的に計算するロジックは不要。パネル位置の算出（4節）は「押されたボタン自身の実際の画面上の位置」を基準にするため、何行目に折り返されていても正しく機能する。

## 6. キーボード操作（roving tabindex）

- `role="toolbar"` をボタン列のコンテナに付与する。
- 現在フォーカス対象のボタン（初期値は先頭の有効なボタン）のみ `tabIndex={0}`、それ以外は `tabIndex={-1}` とする「roving tabindex」パターンを実装する。
- 左右矢印キーで、隣接する有効な（`disabled`でない）ボタンへフォーカスを移動する。折り返しによる行の境界は意識せず、`tools` 配列の並び順（DOM順）でシンプルに前後移動する（要件定義書8節の未決事項を「単純な前後移動」で解決する。上下キーでのグリッドナビゲーションは実装しない）。
- Enter/Spaceキーでフォーカス中のボタンをクリックしたのと同じ挙動にする（ネイティブ`<button>`要素であれば標準で対応するため、追加実装は基本的に不要）。
- パネルを閉じたとき（`CLOSE`アクション、Escape、外側クリック含む）、直前に開いていたツールのボタン要素へ `focus()` を戻す。

## 7. アクセシビリティ属性

| 要素 | 属性 |
| --- | --- |
| ボタン列コンテナ | `role="toolbar"` |
| パネル型ツールのボタン | `aria-expanded={openToolId === tool.id}`, `aria-haspopup="dialog"` |
| 即時実行型ツールのボタン（トグル） | `aria-pressed={tool.isActive}`（`isActive`未指定の場合は付与しない） |
| 無効化ツールのボタン | `disabled` |
| パネル（`FloatingBox`の中身） | `role="dialog"`, `aria-label`（`tool.ariaLabel ?? tool.label`） |

## 8. テスト方針

- `toolboxReducer.ts` はReactに依存しない純粋関数のため、`tests/components/common/EditorToolbox/toolboxReducer.test.ts` としてNode環境で単体テストする（`TOGGLE_PANEL`で同じツールを2回押すと閉じる、異なるツールを押すと開くパネルが切り替わる、`CLOSE`で必ず閉じる、の3分岐を最低限カバーする）。
- 実際のDOM描画・キーボード操作・`FloatingBox`との統合動作は、現状の自動テスト基盤（Node環境のみ、`@testing-library/react`未導入）では検証できないため、手動確認（ブラウザでの動作確認）で担保する。将来的にコンポーネントテスト基盤（jsdom + `@testing-library/react`等）を導入する場合は、本コンポーネントを最初の対象候補とする。

## 9. 影響範囲

**新規ファイル**
- `src/components/common/EditorToolbox/index.tsx`
- `src/components/common/EditorToolbox/index.module.css`
- `src/components/common/EditorToolbox/toolboxReducer.ts`
- `tests/components/common/EditorToolbox/toolboxReducer.test.ts`

**変更ファイル**
- なし（既存の `FloatingBox` はAPIを変更せずそのまま利用する想定。4節の外側クリック判定用にpanel要素へのref取得方法を確認した結果、`FloatingBox`側に軽微なAPI追加（例: `panelRef`を受け取れるようにする）が必要になった場合のみ、`src/components/common/FloatingBox/index.tsx` を変更対象に追加する）。

## 10. クリエイターモードからの利用イメージ（参考）

本コンポーネントの実際の利用例は `specs/creator-mode/design.md` を参照。概略は以下の通り。

```tsx
const linkTool: EditorToolboxPanelTool = {
  kind: "panel",
  id: "link",
  label: "リンク",
  renderPanel: ({ close }) => <LinkFacetPanel /* ... */ onDone={close} />,
}
const yayTextTool: EditorToolboxPanelTool = {
  kind: "panel",
  id: "yaytext",
  label: "装飾",
  renderPanel: ({ close }) => <YayTextPanel /* ... */ />,
}

<EditorToolbox tools={[linkTool, yayTextTool /* ... */]} />
```

EditorToolboxは `linkTool`/`yayTextTool` の中身を一切関知しない。
