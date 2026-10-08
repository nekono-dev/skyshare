# 投稿先選択ダイアログ 設計書

## 1. 構成

| パス                                              | 責務                                             |
| ------------------------------------------------- | ------------------------------------------------ |
| `src/components/post/IntentShareDialog/index.tsx` | 投稿先選択ダイアログ                             |
| `src/components/post/ThreadComposer/index.tsx`    | 投稿直後のダイアログの表示と入力欄のクリア       |
| `src/components/post/PostLauncher/index.tsx`      | 投稿フォームのオーバーレイ外でのダイアログの表示 |
| `src/components/post/PostCard/index.tsx`          | タイムラインの投稿からのダイアログの表示         |

## 2. 設計項目

### D-1: ダイアログ (FR-1, FR-3, FR-4, FR-5, FR-6)

```ts
export type IntentShareRequest = {
  postText: string
  entryUrl: string | null
  linkCardUrl: string
}
type Props = {
  request: IntentShareRequest | null // null なら非表示
  keepOpenOnSelect?: boolean // 既定 false
  onClose: () => void
}
```

- `ChoiceDialog` で「X に投稿」「タイッツーに投稿」「Mastodonに投稿」「閉じる」を並べる。背景クリックとEscキーは `ChoiceDialog` の `onClose` が扱う。
- クリック時に `readTruncateIntentTextSetting(false)` を読み、`buildIntentText(postText, entryUrl ?? "", linkCardUrl, { truncateLimit: resolveTruncateLimit(target, truncate) })` を `openIntentPopupFor` に渡す。`keepOpenOnSelect` が偽のときだけ続けて `onClose()` を呼ぶ。
- `resolveMastodonInstanceDomain(readMastodonInstanceDomainSetting(""))` が `null` なら、Mastodonのボタンを `disabled` にする。

### D-2: 呼び出し側 (FR-2, FR-7, FR-8)

| 呼び出し元                     | `keepOpenOnSelect` | 描画位置                                    |
| ------------------------------ | ------------------ | ------------------------------------------- |
| `PostCard`                     | 指定しない         | `PostCard` 内                               |
| `ThreadComposer`（固定表示）   | true               | `ThreadComposer` 内の `shareRequest` state  |
| `PostLauncher`（オーバーレイ） | true               | `Overlay` の外。`onShareRequest` で受け取る |

- `PostLauncher` は投稿成功で `Overlay` を閉じて `ThreadComposer` ごとアンマウントするため、`ThreadComposer` に `onShareRequest` を渡し、ダイアログを自身のstateで描画する。
- `ThreadComposer` は、共有の分岐結果で `openShareDialog` が true なら、先頭の投稿の本文・skyshare entryのURL・リンクカードのURLから `IntentShareRequest` を作る。`onShareRequest` があればそれを呼び、無ければ自身のstateに入れる。
- 入力欄のクリア（`resetInputFields`）は、ダイアログの有無によらず投稿成功後に必ず実行する。

## 3. エラー処理

| 事象                   | 処理                                                         |
| ---------------------- | ------------------------------------------------------------ |
| ポップアップを開けない | ダイアログを開いたまま、利用者が別の投稿先を選べる状態を保つ |
