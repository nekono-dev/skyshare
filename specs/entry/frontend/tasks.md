# entry フロントエンド タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

前提: [specs/entry/backend/tasks.md](../backend/tasks.md) Phase 1（`entrySource`廃止・`createEntry`/`visual`のトップレベル化）・Phase 2（`deleteBskyThread`）の実装、および[specs/threadpost](../../threadpost/tasks.md)側のスレッド投稿UI（segment配列の状態管理）が揃っていることを前提とする。

## Phase 1: 送信内容の決定をトップレベル形式へ移行（design.md §3.1・§3.2対応）

前回セッションで実装された、`posts[i]`ごとの`createEntry`/`entrySource`送信を、トップレベル送信へ置き換える。

- [ ] `src/components/post/ThreadComposer/submitThread.ts`の`buildPostItem`を変更し、`post.ogImage`/`post.createEntry`/`post.entrySource`（`posts[i]`側）への設定をやめる。
- [ ] `submitThread`本体で、`entryCandidateIndex`（先頭の画像投稿segment、既存ロジックを維持）が見つかった場合にリクエストのトップレベル`createEntry: true`・`visual: <選択segmentのimageEntry.thumbnailBlob>`を設定するよう変更する。
- [ ] レスポンスの読み取り箇所（`results[i]?.skyshareEntry`）を、トップレベルの`res.data.skyshareEntry`を読むように変更する。
- [ ] `[TEST]` `tests/components/post/ThreadComposer/submitThread.test.ts`を、トップレベル送信・トップレベルレスポンス読み取りに合わせて全面更新する（画像投稿segment数0件・1件・2件以上の各分岐、単発投稿でのregressionが無いことを含む）。

## Phase 2: entry詳細ページのスレッド表示（design.md §3.3対応）

- [ ] `entries/[slug].astro`に、`app.bsky.feed.getPostThread`（`AtpAgent`経由）でreply chainを取得する処理を追加する。
- [ ] 取得した`ThreadViewPost`から、`source`投稿の`author.did`と一致する後続投稿のみを直線的に辿って時系列順に抽出するロジックを実装する（`specs/entry/backend/design.md §7.4.1`と同一の抽出規則。第三者の返信・その分岐先は除外し、`MAX_THREAD_POST_COUNT`を探索上限とする）。
- [ ] 抽出結果が1件（後続投稿なし）の場合は既存の`EntryDetailView`にフォールバックする分岐を実装する。
- [ ] 抽出結果が2件以上の場合に描画する新設コンポーネント（例: `EntryThreadView`、`src/components/entry/`配下）を実装する。各投稿のテキスト・画像を`extractSourceImages`を用いて投稿順に描画する。
- [ ] `PostEngagementStats`の表示範囲（`source`投稿1件分）を実装する。
- [ ] `[TEST]` `author.did`一致抽出ロジック（直線的chainの抽出、第三者返信・分岐先の除外、`MAX_THREAD_POST_COUNT`上限）・1件時のフォールバック分岐の単体テストを追加する。
- [ ] `[TEST]` Playwrightで以下のシナリオを検証する（`tests/e2e/entryThreadDetail.spec.ts`、新規）:
  - 後続投稿を持つスレッド由来entryの詳細ページを開く → 先頭から後続投稿まで時系列順にすべて表示されることを確認
  - 単発投稿由来entryの詳細ページを開く → 従来通り単一投稿として表示されることを確認

## Phase 3: entry削除時のスレッド全体削除オプション（design.md §3.4対応）

- [ ] entry所有者向けの削除確認UIを共通コンポーネントとして実装し、entry詳細ページ・Timeline（PostCard）の双方から呼び出せるようにする（Timeline側の呼び出し配置自体は[specs/timeline/tasks.md](../../timeline/tasks.md)の対象）。
- [ ] 削除確認ダイアログを開くタイミングで、「`source`がスレッド先頭かつentry所有者自身の後続投稿が存在するか」を判定するロジックを実装する。詳細ページからの削除ではPhase 2で取得済みのスレッド情報を再利用し、追加のAPI呼び出しを避ける。
- [ ] 事前にスレッド情報を持たない削除導線で、ダイアログを開いた時点で`getPostThread`を呼び出す分岐を実装する。
- [ ] 判定結果に応じて「スレッド全体を削除」の選択肢を出し分ける。
- [ ] 「スレッド全体を削除」選択時に`DELETE /v2/entry`へ`deleteBskyPost: true`・`deleteBskyThread: true`を送信する。
- [ ] 削除確認ダイアログの文言・レイアウトを実装する（スレッド全体削除時は、後続の自己投稿もすべて削除される旨・元に戻せない旨を明示する）。
- [ ] `[TEST]` 「スレッド全体を削除」選択肢の出し分け判定ロジックの単体テストを追加する。
- [ ] `[TEST]` Playwrightで以下のシナリオを検証する:
  - スレッド由来entry（後続の自己投稿あり）の詳細ページで削除ダイアログを開く → 「entryのみ削除」「entry＋元投稿を削除」に加えて「スレッド全体を削除」が表示されることを確認
  - 単発投稿由来entryの詳細ページで削除ダイアログを開く → 「スレッド全体を削除」が表示されず2択のままであることを確認
  - 「スレッド全体を削除」を選んで削除を実行 → 削除成功後にentryが一覧・詳細ページから消えることを確認

## Phase 4: entry詳細ページでの視覚的区別（design.md §3.5対応）

- [ ] Phase 2の判定条件（`source`がスレッド先頭かつentry所有者自身の後続投稿が存在する）を満たすentryに、スレッド由来であることを示す区別表示（バッジ等）をentry詳細ページに実装する。
- [ ] `[TEST]` 詳細ページでの区別表示の判定ロジックがPhase 2の判定条件と一致することを確認する単体テストを追加する。
- [ ] `[TEST]` Playwrightで、スレッド由来entryの詳細ページにバッジが表示され、単発投稿由来entryには表示されないことを確認する。

## Phase 5: 仕上げ

- [ ] `npm run codegen`実行後の型（トップレベル`createEntry`/`visual`/`skyshareEntry`、`deleteBskyThread`）にフロントエンドの実装を追従させる。
- [ ] 手動確認: 画像投稿segmentが2件以上のスレッドを投稿し、選択したsegmentの画像がvisualとして使われ、entryが1件のみ作成されることを確認する。
- [ ] 手動確認: スレッド由来entryの詳細ページ・削除確認UI・視覚的区別が期待通り表示されることを確認する。
- [ ] 既存の単発投稿フロー（`ImagePicker`、entry詳細ページ）に regression がないことを確認する。
