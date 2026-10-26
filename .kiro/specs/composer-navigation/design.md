# Design Document

## Overview

**Purpose**: 投稿フォームで作成中の内容を、別のページへ移る操作で失わないようにし、予約投稿が無効のときは有効にする設定へ迷わず移れるようにする。
**Users**: 投稿フォームで作成中に別のページへ移りたい利用者
**Impact**: 作成中の内容を別のページへ移る操作で失わないようにし、予約投稿が無効のときは設定へ案内する。

### Goals

- 作成中に別のページへ移ろうとしたときの、下書き保存の確認。
- 予約投稿が無効のときにカレンダーのボタンを押したときの、設定への案内。

### Non-Goals

- 下書きの保存の API と、下書きの一覧の表示。
- ブラウザの戻る・進む、タブを閉じる、再読み込みでの確認。
- 設定のページでの予約投稿の有効化の操作。

## Boundary Commitments

### This Spec Owns

- 作成中に別のページへ移ろうとしたときの、下書き保存の確認。
- 予約投稿が無効のときにカレンダーのボタンを押したときの、設定への案内。

### Out of Boundary

- 下書きの保存の API と、下書きの一覧の表示。
- ブラウザの戻る・進む、タブを閉じる、再読み込みでの確認。
- 設定のページでの予約投稿の有効化の操作。

### Allowed Dependencies

- 下書きの保存（draft-api）
- 予約投稿の有効状態（schedule-api）

### Revalidation Triggers

- 遷移の遮断の方式（リンクのクリックの扱い）を変えるとき
- 確認ダイアログの選択肢を変えるとき
- 未保存の判定（本文の空・下書きからの変更）を変えるとき

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                                                    | 責務                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `src/components/post/ThreadComposer/index.tsx`          | 遷移の遮断・下書き保存の確認・設定への案内の表示              |
| `src/components/schedule/RunAtPicker/index.tsx`         | 予約投稿が使えないときに押せる無効表示のボタンと、押下の通知  |
| `src/components/entry/DraftSaveConfirmDialog/index.tsx` | 保存して移る・破棄して移る・編集を続けるの3択（既存を再利用） |

## Requirements Traceability

| Requirement             | Summary                    | Components |
| ----------------------- | -------------------------- | ---------- |
| 1.1, 1.2, 1.3, 1.4, 1.5 | 未保存の内容の保護         | D-1        |
| 2.1, 2.2                | 予約投稿が無効のときの案内 | D-2        |

## Components and Interfaces

#### D-1: 遷移の遮断と下書き保存の確認

**Requirements**: 1.1, 1.2, 1.3, 1.4, 1.5

```ts
// 投稿フォームのマウント中ずっと、click を capture で購読する（最新の状態は ref 経由で読む）
document.addEventListener("click", (event) => {
  // navigatingLinkTarget(event, location)（src/util/links.ts）で、このタブで別のページへ移るリンクか判定する
  // 修飾キー付き・target="_blank"・download・同じ住所・http(s) 以外は null で止めない
  // hasUnsavedDraftChanges() が偽なら止めない
  // 真なら event.preventDefault() と stopPropagation() で Astro のリンク処理に届く前に止め、
  // requestNavigation(to.href) で pendingNavigation と確認ダイアログの表示を設定する
}, true)
const requestNavigation = (to: string): void // 設定への案内など、フォーム自身が起こす遷移
```

| 選択         | 動作                                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| 下書きを保存 | 下書きを保存し、成功したらフォームを初期化して `goTo(pendingNavigation)` を呼ぶ |
| 破棄         | 保存せずフォームを初期化して `goTo(pendingNavigation)` を呼ぶ                   |
| 編集を続ける | `pendingNavigation` を空にして、ページとフォームをそのままにする                |

- `goTo` は、同じオリジンなら `navigate()`、別のオリジンなら `location.assign` で移る。
- `astro:before-preparation` は取り消すと全体の再読み込みに切り替わり、入力が失われるため使わない。遷移を始める前のリンクのクリックを capture で捕まえて止めるため、確認の間、遷移先のページは取得も表示もされず、住所も変わらない。クリックを止めるので、確認後の `goTo` を素通りさせる印（`allowNavigationRef` など）は要らない。
- ブラウザの戻る・進む、再読み込み、タブを閉じる操作は、クリックを経ないため対象にしない（Out of Boundary）。
- 予約の編集中は、閉じるときと同じく `cancelAction` により、下書きの3択の代わりに予約の取消・予約を残して閉じる・編集を続けるの3択（`editChoice`）を出す。
- 判定は既存の `hasUnsavedDraftChanges()` を使う（本文が空なら偽、開いた下書きがあれば保存済みの内容との差で判定する）。下書きは本文だけを保存するため、画像だけの入力は未保存とみなさない。
- 確認のダイアログは、キャンセルボタンの確認と同じ `DraftSaveConfirmDialog` を使い、移る先の有無だけで保存の後の動作を分ける。

#### D-2: 予約投稿が無効のときの案内

**Requirements**: 2.1, 2.2

```tsx
type RunAtPickerProps = {
  // 既存の props に加える
  onUnavailable?: () => void // 渡すと、使えない状態でも押せる無効表示（aria-disabled）にする
}
```

- 登録の状態が「未登録」（`registered === false`）のときは、設定への案内を開く `onUnavailable` を渡す。登録済みで許可が無効になっている（`registered === true` かつ再許可が必要）ときも `onUnavailable` を渡すが、これは設定への案内ではなく、この画面のまま再度の許可のダイアログを開く。取得前・制限値の取得失敗・ゲスト表示・送信中は、`disabled` 属性で押せない。
- 押すと `ChoiceDialog` で「予約投稿を有効にしていません」と、設定画面で機能を有効にすると予約投稿を使える旨の案内を出し、「設定を開く」「閉じる」を選ばせる。
- 「設定を開く」は `requestNavigation("/settings/")` を呼ぶ（本文があれば、下の遷移の確認を挟む）。
- 登録の状態が変わった直後に古い制限値で押せてしまわないよう、`limits` は予約投稿が有効なときだけ渡す。

## Error Handling

| 事象                 | 処理                                                          |
| -------------------- | ------------------------------------------------------------- |
| 下書きの保存に失敗   | 確認を開いたまま、フォームに保存の失敗の文言を表示する        |
| 遷移先が取得できない | `navigate()` の通常の失敗の扱いに従う（フォームは初期化済み） |

## Testing Strategy

- Unit / Build Tests:
  - `npx tsc --noEmit`
- E2E/UI Tests:
  - `tests/e2e/composerNavigation.spec.ts` 本文を入力してフッターの設定を押す → 3択の確認が出て、保存を選ぶと設定のページへ移る
- テストの名前には、対応する基準 ID を `[composer-navigation/<ID>]` の形で付ける（例: `[composer-navigation/1.1]`）
