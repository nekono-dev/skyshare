# entry フロントエンド タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

前提: [specs/entry/backend/tasks.md](../backend/tasks.md) の`entrySource`・`deleteBskyThread`実装、および[specs/threadpost](../../threadpost/tasks.md)側のスレッド投稿UI（segment配列の状態管理）が揃っていることを前提とする。

## Phase 1: visual選択・送信内容の決定（design.md §3.1・§3.2対応）

- [ ] スレッド投稿UIの状態から、画像投稿segmentを抽出しvisual元候補を判定するロジックを実装する。
- [ ] 画像投稿segmentが2件以上ある場合の選択UI、1件の場合の自動選択、0件の場合は何も表示しない、の3分岐を実装する。
- [ ] visual選択・`createEntry`/`entrySource`/`ogImage`の決定ロジックを、下書き復元時ではなく送信直前に評価するよう組み込む。
- [ ] `[TEST]` 画像投稿segment数（0件・1件・2件以上）ごとの分岐について、visual選択・送信内容決定ロジックの単体テストを追加する。
- [ ] 単発投稿（1segment）の既存フロー（`submitEntry.ts`）に regression がないことを確認する。

## Phase 2: entry詳細ページのスレッド表示（design.md §3.3対応）

- [ ] `entries/[slug].astro`に、`app.bsky.feed.getPostThread`（`AtpAgent`経由）でreply chainを取得する処理を追加する。
- [ ] 取得結果から、`source`投稿の`author.did`と一致する投稿のみを時系列順に抽出するロジックを実装する。
- [ ] 抽出結果が1件（後続投稿なし）の場合は既存の`EntryDetailView`にフォールバックする分岐を実装する。
- [ ] 抽出結果が2件以上の場合に描画する新設コンポーネント（例: `EntryThreadView`、`src/components/entry/`配下）を実装する。各投稿のテキスト・画像を`extractSourceImages`を用いて投稿順に描画する。
- [ ] `PostEngagementStats`の表示範囲（`source`投稿1件分）を実装する。
- [ ] `[TEST]` `author.did`一致抽出ロジック・1件時のフォールバック分岐の単体テストを追加する。

## Phase 3: entry削除時のスレッド全体削除オプション（design.md §3.4対応）

- [ ] 削除確認ダイアログを開くタイミングで、「`source`がスレッド先頭かつentry所有者自身の後続投稿が存在するか」を判定するロジックを実装する。詳細ページからの削除ではPhase 2で取得済みのスレッド情報を再利用し、追加のAPI呼び出しを避ける。
- [ ] 一覧ページなど事前にスレッド情報を持たない削除導線で、ダイアログを開いた時点で`getPostThread`を呼び出す分岐を実装する。
- [ ] 判定結果に応じて「スレッド全体を削除」の選択肢を出し分ける。
- [ ] 「スレッド全体を削除」選択時に`DELETE /v2/entry`へ`deleteBskyPost: true`・`deleteBskyThread: true`を送信する。
- [ ] 削除確認ダイアログの文言・レイアウトを実装する（スレッド全体削除時は、後続の自己投稿もすべて削除される旨・元に戻せない旨を明示する）。
- [ ] `[TEST]` 「スレッド全体を削除」選択肢の出し分け判定ロジックの単体テストを追加する。

## Phase 4: entry一覧・詳細ページでの視覚的区別（design.md §3.5対応）

- [ ] 一覧ページで、後続の自己投稿の有無を判定するための取得方法・タイミングを設計・実装する。
- [ ] 判定条件（`source`がスレッド先頭かつentry所有者自身の後続投稿が存在する）を満たすentryに、スレッド由来であることを示す区別表示（バッジ等）を一覧・詳細ページに実装する。
- [ ] `[TEST]` 一覧・詳細ページでの区別表示の判定ロジックが3.3節・3.4節の判定条件と一致することを確認する単体テストを追加する。

## Phase 5: 仕上げ

- [ ] `npm run codegen`実行後の型（`entrySource`・`deleteBskyThread`）にフロントエンドの実装を追従させる。
- [ ] 手動確認: 画像投稿segmentが2件以上のスレッドを投稿し、選択したsegmentのみにentryが作成されることを確認する。
- [ ] 手動確認: スレッド由来entryの詳細ページ・削除確認UI・一覧の視覚的区別が期待通り表示されることを確認する。
- [ ] 既存の単発投稿フロー（`ImagePicker`、entry一覧・詳細ページ）に regression がないことを確認する。
