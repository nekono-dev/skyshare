# 投稿フォームの遷移の確認 設計書

## 1. 構成

| パス                                                    | 責務                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `src/components/post/ThreadComposer/index.tsx`          | 遷移の遮断・下書き保存の確認・設定への案内の表示              |
| `src/components/schedule/RunAtPicker/index.tsx`         | 予約投稿が使えないときに押せる無効表示のボタンと、押下の通知  |
| `src/components/entry/DraftSaveConfirmDialog/index.tsx` | 保存して移る・破棄して移る・編集を続けるの3択（既存を再利用） |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: 遷移の遮断と下書き保存の確認 (FR-1, FR-2, NFR-1)

```ts
// 投稿フォームのマウント中ずっと購読する（最新の状態は ref 経由で読む）
document.addEventListener("astro:before-preparation", (event) => {
  // event.navigationType, event.to: URL
  // "traverse"（戻る・進む）は止めない。履歴がすでに動いているため
  // hasUnsavedDraftChanges() が偽なら止めない
  // 真なら event.preventDefault() し、pendingNavigation = to.href と確認ダイアログの表示を設定する
})
const requestNavigation = (to: string): void // 設定への案内など、フォーム自身が起こす遷移
```

| 選択         | 動作                                                                                |
| ------------ | ----------------------------------------------------------------------------------- |
| 下書きを保存 | 下書きを保存し、成功したらフォームを初期化して `navigate(pendingNavigation)` を呼ぶ |
| 破棄         | 保存せずフォームを初期化して `navigate(pendingNavigation)` を呼ぶ                   |
| 編集を続ける | `pendingNavigation` を空にして、ページとフォームをそのままにする                    |

- `Astro` のページ遷移の `astro:before-preparation` は、遷移先の取得の前に発火して取り消せる。このため確認の間、遷移先のページは取得も表示もされない。
- 確認の後に呼ぶ `navigate()` は同じイベントを再び発火するため、`allowNavigationRef` の印を立てて一度だけ素通りさせる。
- 判定は既存の `hasUnsavedDraftChanges()` を使う（本文が空なら偽、開いた下書きがあれば保存済みの内容との差で判定する）。下書きは本文だけを保存するため、画像だけの入力は未保存とみなさない。
- 確認のダイアログは、キャンセルボタンの確認と同じ `DraftSaveConfirmDialog` を使い、移る先の有無だけで保存の後の動作を分ける。

### D-2: 予約投稿が無効のときの案内 (FR-3)

```tsx
type RunAtPickerProps = {
  // 既存の props に加える
  onUnavailable?: () => void // 渡すと、使えない状態でも押せる無効表示（aria-disabled）にする
}
```

- 登録の状態が「未登録」（`registered === false`）のときだけ `onUnavailable` を渡す。取得前・制限値の取得失敗・ゲスト表示・送信中は、`disabled` 属性で押せない。
- 押すと `ChoiceDialog` で「予約投稿を有効にしていません」と、設定で有効にしてアプリパスワードを登録する案内を出し、「設定を開く」「閉じる」を選ばせる。
- 「設定を開く」は `requestNavigation("/settings/")` を呼ぶ（本文があれば、下の遷移の確認を挟む）。
- 登録の状態が変わった直後に古い制限値で押せてしまわないよう、`limits` は予約投稿が有効なときだけ渡す。

## 4. エラー処理

| 事象                 | 処理                                                          |
| -------------------- | ------------------------------------------------------------- |
| 下書きの保存に失敗   | 確認を開いたまま、フォームに保存の失敗の文言を表示する        |
| 遷移先が取得できない | `navigate()` の通常の失敗の扱いに従う（フォームは初期化済み） |
