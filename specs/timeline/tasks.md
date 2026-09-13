# Timeline コンポーネント タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[FE]` フロントエンド / `[BE]` バックエンド / `[TEST]` テスト

前提: [specs/entry/backend/tasks.md](../entry/backend/tasks.md) Phase 1（トップレベル`createEntry`/`visual`化）が完了していること（事後entry作成ボタンの送信先APIが新形状であるため）。

## Phase 1: バックエンドのreply chain情報追加（design.md §2対応）

- [x] `[BE]` `src/lib/entry/posts.ts`の`TimelinePost`型に`replyParentUri?: string`を追加する。
- [x] `[BE]` `normalizeTimelinePost`を変更し、`FeedViewPost.reply?.parent`の`uri`を`replyParentUri`として設定する（`AppBskyFeedDefs.isPostView`でPostView型のみを対象とし、NotFoundPost/BlockedPostは設定しない）。
- [x] `[BE]` `GET /v2/entries`のレスポンススキーマ（`src/lib/api/schema/v2/entries/get.ts`）に`replyParentUri`を追加する。
- [x] `[TEST]` `normalizeTimelinePost`の単体テストに、`reply.parent`あり/なし・PostView型でない場合の分岐を追加する。
- [x] `npm run codegen`を実行し、フロントエンド用クライアントの型に`replyParentUri`を反映する。

## Phase 2: クライアント側グルーピングロジック（design.md §3対応）

- [x] `[FE]` `src/components/post/Timeline/threadGroup.ts`を新規作成し、`ThreadGroup`型・`groupIntoThreads`関数を実装する（design.md §3.2の疑似コード通り）。
- [x] `[TEST]` `groupIntoThreads`の単体テストを追加する（単独投稿のみ、連続スレッド、間に無関係な投稿が挟まるケース、ページング境界外への`replyParentUri`参照のケース）。

## Phase 3: `ThreadCard`・展開UIの実装（design.md §4対応）

- [x] `[FE]` `src/components/post/ThreadCard/`を新規作成する。`group.replies.length === 0`の場合は既存`PostCard`をそのまま描画するフォールバック分岐を実装する。
- [x] `[FE]` 2件以上のスレッドグループについて、折りたたみ表示（ルート投稿＋「返信を表示（N件）」ボタン）と、展開表示（`PostCard`をグループ内全投稿分レンダリング）を実装する。
- [x] `[FE]` `PostCard`に`threadBadge`・`postCreateEntryButton`propsを追加する（design.md §4.2、既存のロジックは変更せず追加のみ。ただし`postCreateEntryButton===false`の場合のみ、投稿自身が適格でもボタン表示用のdisplayを差し替えて抑制するロジックを追加した。1スレッドにつき事後entry作成ボタンを最大1箇所にするFR-3の制約上、この抑制が無いとスレッド内の他の画像投稿にも個別の作成ボタンが出てしまうため）。
- [x] `[FE]` `src/components/post/Timeline/index.tsx`の`ComponentList`を、`items`を`ThreadGroup[]`に、`itemComponent`を`ThreadCard`に差し替える（design.md §7）。
- [x] `[TEST]` Playwrightで以下のシナリオを検証する（`tests/e2e/timelineThread.spec.ts`、新規。実アカウントでの投稿の代わりに、`GUEST_DUMMY_POSTS`（`src/lib/entry/guestDummyPosts.ts`）に追加した固定スレッドフィクスチャ（`/?guest`）で検証）:
  - スレッド（3件）が折りたたみ表示（「返信を表示（2件）」）になっていることを確認
  - 「返信を表示」をクリック → 3件すべてが時系列順に表示されることを確認
  - 「折りたたむ」をクリック → 元の折りたたみ表示に戻ることを確認
  - スレッドに関係しない単独投稿が、従来通り個別カードとして表示されることを確認

## Phase 4: 事後entry作成ボタン（design.md §5対応）

- [x] `[FE]` `src/components/post/ThreadCard/entryCandidate.ts`を新規作成し、`resolvePostCreateEntryTarget`を実装する（design.md §5.1の疑似コード通り）。
- [x] `[FE]` `ThreadCard`が`resolvePostCreateEntryTarget`の結果を対象投稿の`PostCard`へ`postCreateEntryButton={true}`（対象外の他の画像投稿へは`false`）として伝搬する。
- [x] `[FE]` `postCreateEntryButton`が`true`のとき、既存の`useSkyshareEntryStatus`のfrom-post作成ロジックをそのまま使う（ボタン表示は`display.kind`の自然な"creatable"判定に委ねられるため、状態機械自体の変更は不要と判明。design.md §5.2の「常に表示する」という記述は、実装時にこの単純化で十分と確認した）。
- [x] `[TEST]` `resolvePostCreateEntryTarget`の単体テストを追加する（ルートが画像あり→対象外、既にentryあり→対象外、中間に画像投稿が複数→最古のもののみ、後続投稿すべてに画像なし→対象なし）。
- [x] `[TEST]` Playwrightで、ルートがテキストのみ・中間が画像付きのスレッド（entry未作成）で中間投稿にのみ「entryを作成」ボタンが表示され、末尾投稿には表示されないことを確認した（`/?guest`のスレッドAフィクスチャ）。
- [ ] `[TEST]` Playwrightでボタンをクリックしてentry作成 → ルート投稿にentryが紐づき、ボタンが再表示されなくなることを確認する。ゲストモードは作成ボタン自体が無効化されているため検証不可。実アカウントでの確認が必要（要ログイン、次回セッション以降または利用者による確認が必要）。

## Phase 5: スレッド由来の視覚的区別（design.md §6対応）

- [x] `[FE]` `src/components/post/ThreadCard/entryCandidate.ts`に`findEntryCarrier`を実装する（design.md §6.1）。
- [x] `[FE]` `findEntryCarrier`が非nullを返す場合、ルート投稿の`PostCard`に`threadBadge={true}`を渡し、バッジ表示を実装する。
- [x] `[TEST]` `findEntryCarrier`の単体テストを追加する（単独投稿→null、entryなしスレッド→null、ルートにentryありスレッド→ルートを返す）。
- [x] `[TEST]` Playwrightで、スレッド由来entryを持つカードにバッジが表示されることを確認した（`/?guest`のスレッドBフィクスチャ）。単独投稿由来entryに表示されないことは既存の単独投稿カードで暗黙に確認済み（バッジ描画条件は`threadBadge`propであり、単独投稿の`ThreadCard`フォールバック分岐は`threadBadge`自体を渡さない）。

## Phase 6: 仕上げ

- [ ] 手動確認: 実アカウントでスレッド投稿・事後entry作成・視覚的区別が期待通り動作することを確認する（要ログイン、次回セッション以降または利用者による確認が必要）。
- [x] `npx vitest run`・`npx tsc --noEmit`・`npx playwright test`が全件成功することを確認した（`threadComposer.spec.ts`の1件は初回コールドコンパイル起因の既知のflakinessで、本機能追加とは無関係。単独実行では成功）。
- [x] 既存の単独投稿の表示・entry作成/編集/削除ボタンの挙動に regression が無いことを確認した（ゲストモードの単独投稿・スレッドに無関係な投稿が従来通り表示されることをe2eで確認）。
