# Timeline コンポーネント タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[FE]` フロントエンド / `[BE]` バックエンド / `[TEST]` テスト

前提: [specs/entry/backend/tasks.md](../entry/backend/tasks.md) Phase 1（トップレベル`createEntry`/`visual`化）が完了していること（事後entry作成ボタンの送信先APIが新形状であるため）。

## Phase 1: バックエンドのreply chain情報追加（design.md §2対応）

- [ ] `[BE]` `src/lib/entry/posts.ts`の`TimelinePost`型に`replyParentUri?: string`を追加する。
- [ ] `[BE]` `normalizeTimelinePost`を変更し、`FeedViewPost.reply?.parent`の`uri`を`replyParentUri`として設定する。
- [ ] `[BE]` `GET /v2/entries`のレスポンススキーマ（`src/lib/api/schema/v2/entries/get.ts`相当）に`replyParentUri`を追加する。
- [ ] `[TEST]` `normalizeTimelinePost`の単体テストに、`reply.parent`あり/なしの分岐を追加する。
- [ ] `npm run codegen`を実行し、フロントエンド用クライアントの型に`replyParentUri`を反映する。

## Phase 2: クライアント側グルーピングロジック（design.md §3対応）

- [ ] `[FE]` `src/components/post/Timeline/threadGroup.ts`を新規作成し、`ThreadGroup`型・`groupIntoThreads`関数を実装する（design.md §3.2の疑似コード通り）。
- [ ] `[TEST]` `groupIntoThreads`の単体テストを追加する（単独投稿のみ、連続スレッド、間に無関係な投稿が挟まるケース、ページング境界外への`replyParentUri`参照のケース）。

## Phase 3: `ThreadCard`・展開UIの実装（design.md §4対応）

- [ ] `[FE]` `src/components/post/ThreadCard/`を新規作成する。`group.replies.length === 0`の場合は既存`PostCard`をそのまま描画するフォールバック分岐を実装する。
- [ ] `[FE]` 2件以上のスレッドグループについて、折りたたみ表示（ルート投稿＋「返信を表示（N件）」ボタン）と、展開表示（`PostCard`をグループ内全投稿分レンダリング）を実装する。
- [ ] `[FE]` `PostCard`に`threadBadge`・`postCreateEntryButton`propsを追加する（design.md §4.2、既存のロジックは変更せず追加のみ）。
- [ ] `[FE]` `src/components/post/Timeline/index.tsx`の`ComponentList`を、`items`を`ThreadGroup[]`に、`itemComponent`を`ThreadCard`に差し替える（design.md §7）。
- [ ] `[TEST]` Playwrightで以下のシナリオを検証する（`tests/e2e/timelineThread.spec.ts`、新規）:
  - スレッド（3件）を投稿 → Timeline一覧で折りたたみ表示（「返信を表示（2件）」）になっていることを確認
  - 「返信を表示」をクリック → 3件すべてが時系列順に表示されることを確認
  - 「折りたたむ」をクリック → 元の折りたたみ表示に戻ることを確認
  - スレッドに関係しない単独投稿が、従来通り個別カードとして表示されることを確認

## Phase 4: 事後entry作成ボタン（design.md §5対応）

- [ ] `[FE]` `src/components/post/ThreadCard/entryCandidate.ts`を新規作成し、`resolvePostCreateEntryTarget`を実装する（design.md §5.1の疑似コード通り）。
- [ ] `[FE]` `ThreadCard`が`resolvePostCreateEntryTarget`の結果を対象投稿の`PostCard`へ`postCreateEntryButton={true}`として伝搬する。
- [ ] `[FE]` `postCreateEntryButton`が`true`のとき、既存の`useSkyshareEntryStatus`のfrom-post作成ロジックを呼び出すボタンを表示する（design.md §5.2）。
- [ ] `[TEST]` `resolvePostCreateEntryTarget`の単体テストを追加する（ルートが画像あり→対象外、既にentryあり→対象外、中間に画像投稿が複数→最古のもののみ、後続投稿すべてに画像なし→対象なし）。
- [ ] `[TEST]` Playwrightで以下のシナリオを検証する:
  - ルートがテキストのみ・中間が画像付きのスレッド（entry未作成）を用意し、中間投稿に「entryを作成」ボタンが表示されることを確認
  - ボタンをクリックしてentry作成 → ルート投稿にentryが紐づき、ボタンが再表示されなくなることを確認

## Phase 5: スレッド由来の視覚的区別（design.md §6対応）

- [ ] `[FE]` `src/components/post/ThreadCard/entryCandidate.ts`に`findEntryCarrier`を実装する（design.md §6.1）。
- [ ] `[FE]` `findEntryCarrier`が非nullを返す場合、ルート投稿の`PostCard`に`threadBadge={true}`を渡し、バッジ表示を実装する。
- [ ] `[TEST]` `findEntryCarrier`の単体テストを追加する（単独投稿→null、entryなしスレッド→null、ルートにentryありスレッド→ルートを返す）。
- [ ] `[TEST]` Playwrightで、スレッド由来entryを持つカードにバッジが表示され、単独投稿由来entryには表示されないことを確認する。

## Phase 6: 仕上げ

- [ ] 手動確認: 実アカウントでスレッド投稿・事後entry作成・視覚的区別が期待通り動作することを確認する（要ログイン）。
- [ ] `npx vitest run`・`npx tsc --noEmit`・`npx playwright test`が全件成功することを確認する。
- [ ] 既存の単独投稿の表示・entry作成/編集/削除ボタンの挙動に regression が無いことを確認する。
