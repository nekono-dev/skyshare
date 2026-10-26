# Design Document

## Overview

**Purpose**: 投稿ボタンを押して投稿フォームを開いたとき、そのまま本文を入力し始められるようにして、入力欄を押す手間をなくす。
**Users**: 投稿ボタンから投稿フォームを開いてすぐに書き始めたい利用者
**Impact**: 投稿フォームを開いた直後に本文の入力欄へフォーカスを移し、入力欄を押す手間をなくす。

### Goals

- 投稿ボタン（フローティングボタンとサイドバーのボタン）で開く投稿フォームの、本文の入力欄へのフォーカス。

### Non-Goals

- 投稿ページ（住所が /post/ のページ）と、タイムライン先頭の常時表示の投稿フォームの、表示時のフォーカス。
- 下書き・予約の画面や、そのほかのダイアログを開いたときのフォーカス。

## Boundary Commitments

### This Spec Owns

- 投稿ボタン（フローティングボタンとサイドバーのボタン）で開く投稿フォームの、本文の入力欄へのフォーカス。

### Out of Boundary

- 投稿ページ（住所が /post/ のページ）と、タイムライン先頭の常時表示の投稿フォームの、表示時のフォーカス。
- 下書き・予約の画面や、そのほかのダイアログを開いたときのフォーカス。

### Allowed Dependencies

- 投稿ボタン（PostLauncher）と投稿フォーム（ThreadComposer）

### Revalidation Triggers

- 投稿フォームの開き方（ダイアログ化・遅延マウント）を変えるとき
- フォーカスの移し方を変えるとき（スクロール位置への影響を再確認する）

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                           | 責務                                                       |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `src/components/post/PostLauncher/index.tsx`   | 投稿ボタンで開く投稿フォームに自動フォーカスを指示する     |
| `src/components/post/ThreadComposer/index.tsx` | マウント時に先頭のセグメントの本文の入力欄へフォーカスする |

## Requirements Traceability

| Requirement | Summary              | Components |
| ----------- | -------------------- | ---------- |
| 1.1, 1.2    | 開いた直後の入力     | D-1        |
| 2.1         | スクロール位置の保持 | D-1        |

## Components and Interfaces

#### D-1: マウント時のフォーカス

**Requirements**: 1.1, 1.2, 2.1

```ts
type Props = {
  // 既存の props に加える
  autoFocus?: boolean // 真のとき、マウント直後に先頭のセグメントの本文の入力欄へフォーカスする（既定は偽）
}
```

- `ThreadComposer` はマウント時の `useEffect` で、フォーム内の `[data-post-body-editor]` の先頭を `focus({ preventScroll: true })` で選ぶ。
- `PostLauncher` の `Overlay` は開いたときにだけ内容をマウントするため、開くたびにマウントの効果が走り、閉じて開き直しても再びフォーカスされる。
- `PostLauncher` だけが `autoFocus` を渡す。`PostPage` とタイムライン先頭のフォームは渡さないため、表示しただけで画面が動いたり、スマホのキーボードが出たりしない。
- 本文の入力欄は無効（送信中のとき）のときは `contentEditable` が偽でフォーカスできないが、開いた直後は無効にならない。

## Error Handling

| 事象                         | 処理                                           |
| ---------------------------- | ---------------------------------------------- |
| 入力欄がまだ描画されていない | 何もしない（フォーカスしない）。エラーにしない |

## Testing Strategy

- Unit / Build Tests:
  - `npx tsc --noEmit`
- E2E/UI Tests:
  - `tests/e2e/composerAutofocus.spec.ts` 投稿ボタンを押してそのまま入力する → 本文の入力欄に文字が入る
- テストの名前には、対応する基準 ID を `[composer-autofocus/<ID>]` の形で付ける（例: `[composer-autofocus/1.1]`）
