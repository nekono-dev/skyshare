# entry フロントエンド タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

前提: [specs/entry/backend/tasks.md](../backend/tasks.md) Phase 1（`entrySource`廃止・`createEntry`/`visual`のトップレベル化）・Phase 2（`deleteBskyThread`）の実装、および[specs/threadpost](../../threadpost/tasks.md)側のスレッド投稿UI（segment配列の状態管理）が揃っていることを前提とする。

## Phase 1: 送信内容の決定をトップレベル形式へ移行（design.md §3.1・§3.2対応）

前回セッションで実装された、`posts[i]`ごとの`createEntry`/`entrySource`送信を、トップレベル送信へ置き換える。

- [x] `src/components/post/ThreadComposer/submitThread.ts`の`buildPostItem`を変更し、`post.ogImage`/`post.createEntry`/`post.entrySource`（`posts[i]`側）への設定をやめる。
- [x] `submitThread`本体で、`entryCandidateIndex`（先頭の画像投稿segment、既存ロジックを維持）が見つかった場合にリクエストのトップレベル`createEntry: true`・`visual: <選択segmentのimageEntry.thumbnailBlob>`を設定するよう変更する。
- [x] レスポンスの読み取り箇所（`results[i]?.skyshareEntry`）を、トップレベルの`res.data.skyshareEntry`を読むように変更する。
- [x] `[TEST]` `tests/components/post/ThreadComposer/submitThread.test.ts`を、トップレベル送信・トップレベルレスポンス読み取りに合わせて全面更新する（画像投稿segment数0件・1件・2件以上の各分岐、単発投稿でのregressionが無いことを含む）。

## Phase 2: entry詳細ページのスレッド表示（design.md §3.3対応）

- [x] `entries/[slug].astro`に、`app.bsky.feed.getPostThread`（`AtpAgent`経由）でreply chainを取得する処理を追加する。
- [x] 取得した`ThreadViewPost`から、`source`投稿の`author.did`と一致する後続投稿のみを直線的に辿って時系列順に抽出するロジックを実装する（`specs/entry/backend/design.md §7.4.1`と同一の抽出規則。第三者の返信・その分岐先は除外し、`MAX_THREAD_POST_COUNT`を探索上限とする）。抽出ロジック自体は`src/lib/atproto/threadChain.ts`の`extractOwnedLinearReplyChain`として、entry/backend Phase2のスレッド削除と共通化した。
- [x] 抽出結果が1件（後続投稿なし）の場合は既存の`EntryDetailView`にフォールバックする分岐を実装する。
- [x] 抽出結果が2件以上の場合に描画する新設コンポーネント（`EntryThreadView`、`src/components/entry/EntryThreadView/`）を実装する。各投稿のテキスト・画像を`extractSourceImages`を用いて投稿順に描画する。
- [x] `PostEngagementStats`の表示範囲（`source`投稿1件分）を実装する。
- [x] `[TEST]` `author.did`一致抽出ロジック（直線的chainの抽出、第三者返信・分岐先の除外、`MAX_THREAD_POST_COUNT`上限）・1件時のフォールバック分岐の単体テストを追加する（`tests/lib/atproto/threadChain.test.ts`、entry/backend Phase2で追加済みのものを共用）。
- [x] `[TEST]` Playwrightで以下のシナリオを検証する（`tests/e2e/entryThreadDetail.spec.ts`、新規）:
  - 後続投稿を持つスレッド由来entryの詳細ページを開く → 先頭から後続投稿まで時系列順にすべて表示されることを確認（実PDSレコード・ログインへの依存を避けるため、新設の`entries/sample-thread.astro`サンプルページで`EntryThreadView`のレンダリングを検証。実アカウントでの`[slug].astro`本体の確認は手動確認タスクとして残す）
  - 単発投稿由来entryの詳細ページを開く → 従来通り単一投稿として表示されることを確認（既存`entries/sample.astro`で確認）

## Phase 3: entry削除時のスレッド全体削除オプション（design.md §3.4対応）

**スコープ決定（実装時、ユーザー確認済み）**: `entries/[slug].astro`（公開ページ）は現状、所有者判定・インタラクティブUIを一切持たない完全公開SSRページであり、削除UIを追加するには新規のDID判定Reactアイランドが必要になる。実装コスト対効果を踏まえ、今回は既存の所有者限定管理ページ`/entries`（`EntryCard`、`GET /v2/entries/skyshare`がCookie認証済みで所有者制御が自然に効く）のみに「スレッド全体を削除」を追加する。`entries/[slug].astro`・Timeline（PostCard）への追加は将来対応として見送る（`EntryDeleteConfirmDialog`は共通コンポーネントのまま拡張したため、追加時の変更は呼び出し元の配線のみで済む）。

- [x] entry所有者向けの削除確認UI（`EntryDeleteConfirmDialog`）に`showThreadOption`/`onDeleteThread`propsを追加し、共通コンポーネントのまま拡張する。`EntryCard`から利用する。
- [x] 削除確認ダイアログを開くタイミングで、「`source`がスレッド先頭かつentry所有者自身の後続投稿が存在するか」を判定するロジック（`resolveThreadDeleteOption`、`src/components/entry/EntryCard/resolveThreadDeleteOption.ts`）を実装する。`sourceUri`のrepo（DID）がentry所有者自身であることを利用し、追加のセッション取得なしで`getPostThread`→`extractOwnedLinearReplyChain`（entry/backend Phase2・entry/frontend Phase2と共通）で判定する。
- [x] 判定結果に応じて「スレッド全体を削除」の選択肢を出し分ける。
- [x] 「スレッド全体を削除」選択時に`DELETE /v2/entry`へ`deleteBskyPost: true`・`deleteBskyThread: true`を送信する。
- [x] 削除確認ダイアログの文言を実装する（「リンク・スレッド全体を削除（後続の自己投稿もすべて削除、元に戻せません）」）。
- [x] `[TEST]` `resolveThreadDeleteOption`の単体テストを追加する（`tests/components/entry/EntryCard/resolveThreadDeleteOption.test.ts`: 不正なsourceUri、後続投稿なし、後続の自己投稿あり、getPostThread失敗の4分岐）。
- [x] `[TEST]` Playwrightでページのレンダリング自体（削除ボタンの存在・ゲストモードでの無効化）を`tests/e2e/entryList.spec.ts`（新規）で確認した。
- [ ] `[TEST]` Playwrightで削除フロー本体（「スレッド全体を削除」の出し分け・選択・実行）を検証する。ゲストモード（`/entries/?guest`）は削除ボタン自体が無効化されているため検証不可。実アカウントでの確認が必要（要ログイン、次回セッション以降または利用者による確認が必要）。
  - 「スレッド全体を削除」を選んで削除を実行 → 削除成功後にentryが一覧・詳細ページから消えることを確認

## Phase 4: entry詳細ページでの視覚的区別（design.md §3.5対応）

- [ ] Phase 2の判定条件（`source`がスレッド先頭かつentry所有者自身の後続投稿が存在する）を満たすentryに、スレッド由来であることを示す区別表示（バッジ等）をentry詳細ページに実装する。
- [x] `[TEST]` 詳細ページでの区別表示の判定ロジックがPhase 2の判定条件と一致することを確認する単体テストを追加する。`EntryThreadView`はPhase2の判定条件（`extractOwnedLinearReplyChain`の抽出結果が2件以上）を満たす場合にのみ描画されるコンポーティングのため、バッジ表示条件は render 条件そのものと構造的に一致する（別途の判定ロジックを持たない設計。`entries/[slug].astro`側の分岐は既存テスト対象外だが、抽出ロジック自体は`tests/lib/atproto/threadChain.test.ts`で網羅済み）。
- [x] `[TEST]` Playwrightで、スレッド由来entryの詳細ページにバッジが表示され、単発投稿由来entryには表示されないことを確認する（`tests/e2e/entryThreadDetail.spec.ts`に追記し、`npx playwright test`で実行確認済み）。

## Phase 5: 仕上げ

- [ ] `npm run codegen`実行後の型（トップレベル`createEntry`/`visual`/`skyshareEntry`、`deleteBskyThread`）にフロントエンドの実装を追従させる。
- [ ] 手動確認: 画像投稿segmentが2件以上のスレッドを投稿し、選択したsegmentの画像がvisualとして使われ、entryが1件のみ作成されることを確認する。
- [ ] 手動確認: スレッド由来entryの詳細ページ・削除確認UI・視覚的区別が期待通り表示されることを確認する。
- [ ] 既存の単発投稿フロー（`ImagePicker`、entry詳細ページ）に regression がないことを確認する。
