# components カテゴリ構成

`src/components/` は import 依存関係に基づき、以下7カテゴリへ分割している。各カテゴリの内部関係は `<category>/README.md` を参照。

- `common`: 特定機能に依存しない汎用UI部品(モーダル基盤・リスト表示・ページング・入力欄など)
- `image`: 画像選択・クロップ・リンクカード取得プレビューまわりの部品
- `post`: Bluesky投稿(タイムライン・投稿フォーム・投稿カード)まわりの部品
- `entry`: skyshare entry(下書き・保存済みページ)の一覧・編集・削除まわりの部品
- `account`: アカウント切り替え・ログインまわりの部品
- `settings`: 設定一覧・設定ダイアログまわりの部品
- `layout`: サイドバー・フッターナビ・ページmetaなど、ページ全体のレイアウト部品

## カテゴリ間の依存関係

```mermaid
graph TD
  layout[layout]

  image --> common
  post --> common
  post --> image
  post -- PostCard --> entry
  entry -- DraftListPanel --> post
  entry --> common
  account --> common
  settings --> common
```

- `post` と `entry` は相互参照している(`PostCard` が `EntryDeleteConfirmDialog` を、`DraftListPanel` が `SelfLabelsSelect` の定数をそれぞれ参照)。カテゴリ間循環にはなっているが、いずれもUIパーツの再利用であり実装上の問題はない。
- `layout` は他カテゴリに依存しない独立したカテゴリ。
