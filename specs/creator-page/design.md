# クリエイターモードのページ 設計書

## 1. 構成

| パス                                                             | 責務                                     |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `src/pages/creator.astro`                                        | 専用のページ                             |
| `src/components/creator/creatorTools.ts`                         | ツールの一覧とツールの組み立ての文脈の型 |
| `src/components/post/ThreadComposer/index.tsx`                   | ツールの組み立て関数の受け渡し           |
| `src/components/post/ThreadComposer/ThreadSegmentForm/index.tsx` | ツールボックスの表示                     |

## 2. 設計項目

### D-1: ツールの組み立て (FR-3, FR-4)

```ts
export type CreatorToolContext = {
  segment: SegmentState
  update: (partial: Partial<SegmentState>) => void
  editorRef: React.RefObject<HTMLDivElement | null> // 本文の編集領域（選択範囲の取得に使う）
  disabled: boolean // 投稿の処理中
}
export type CreatorToolFactory = (ctx: CreatorToolContext) => EditorToolboxTool
// 各ツールはこの配列に1件ずつ登録する。並び順がボタンの並び順になる
export const CREATOR_TOOLS: CreatorToolFactory[] = []
export const buildCreatorTools = (
  ctx: CreatorToolContext,
): EditorToolboxTool[] => CREATOR_TOOLS.map(factory => factory(ctx))
```

ツールの状態は `SegmentState` の任意のフィールドとして各ツールが追加し、下書きとの変換の対象にしない。

### D-2: 投稿フォームへの差し込み (FR-1, FR-2, FR-5)

```tsx
// ThreadComposer の Props に追加
buildTools?: (ctx: CreatorToolContext) => EditorToolboxTool[] // 未指定ならツールボックスを表示しない
// ThreadSegmentForm（編集表示の側）で本文の直下に描画する
{buildTools && (
  <EditorToolbox tools={buildTools({ segment, update, editorRef, disabled })} />
)}
```

| 呼び出し元                                              | `buildTools`        |
| ------------------------------------------------------- | ------------------- |
| `creator.astro` の `ThreadComposer`（`variant="page"`） | `buildCreatorTools` |
| `PostLauncher`・`Timeline`・`PostPage`                  | 指定しない          |

### D-3: ページ (FR-6)

```astro
---
// 未認証ならログインのページへリダイレクトする（既存のページと同じセッション判定を使う）
---

<Baselayout pageTitleKey="creator.pageTitle">
  <ThreadComposer client:load variant="page" buildTools={buildCreatorTools} />
</Baselayout>
```

## 3. エラー処理

| 事象   | 処理                               |
| ------ | ---------------------------------- |
| 未認証 | ログインのページへリダイレクトする |
