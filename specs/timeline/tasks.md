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

## Phase 6.5: バグ修正 — getAuthorFeedの中間投稿欠落によるスレッド未グルーピング・投稿欠落（design.md §2, §3対応）

不具合: `app.bsky.feed.getAuthorFeed`が自分のスレッド内の中間投稿を一覧から欠落させる場合があり（design.md §3.3）、その場合`replyParentUri`のみに依存した`groupIntoThreads`では後続投稿を本来のスレッドグループへ連結できず、スレッドの折りたたみUIが表示されなくなっていた。さらに調査の結果、グルーピングを修正しても欠落した投稿自体は`GET /v2/entries`のレスポンスに含まれないままであり、3件で構成されるスレッド（test/test2/test3）が2件（test/test3）としてしか表示されないという実害が別途確認された（実例: `at://did:plc:quimkpbfh6mdasxs426v6ogy/app.bsky.feed.post/3mvifnorscc2u`のスレッド）。このため、欠落投稿自体を`getPostThread`で補完する対応（design.md §2.4）を追加で行った。

- [x] `[BE]` `src/lib/entry/posts.ts`の`TimelinePost`型に`replyRootUri?: string`を追加し、`normalizeTimelinePost`で`FeedViewPost.reply?.root`（PostView型の場合のみ）から設定する（design.md §2.1, §2.2）。
- [x] `[BE]` `GET /v2/entries`のレスポンススキーマ（`src/lib/api/schema/v2/entries/get.ts`）に`replyRootUri`を追加する。
- [x] `[TEST]` `normalizeTimelinePost`の単体テストに、`reply.root`あり/なし・PostView型でない場合の分岐を追加する。
- [x] `npm run codegen`を実行し、フロントエンド用クライアントの型に`replyRootUri`を反映する。
- [x] `[FE]` `src/components/post/Timeline/threadGroup.ts`の`groupIntoThreads`を、`replyRootUri`優先（一覧内に見つかればそれをroot、見つからなければ`replyParentUri`を辿るフォールバック）でグルーピングするよう変更する（design.md §3.2, §3.3）。
- [x] `[TEST]` `groupIntoThreads`の単体テストに、中間投稿が一覧から欠落したケース（`replyRootUri`のみでroot連結できることを確認）・`replyRootUri`が一覧外を指す場合のフォールバックケースを追加する。
- [x] `[BE]` `src/lib/entry/posts.ts`に`normalizeBackfilledThreadPost`を追加する（`getPostThread`が返す`PostView`を、`record.reply`からreplyParentUri/replyRootUriを直接設定してTimelinePostへ変換する。design.md §2.4）。
- [x] `[BE]` `src/pages/v2/entries.ts`に`backfillMissingThreadPosts`を追加し、`GET`ハンドラから呼び出す。直接の親が一覧に無くrootのみ一覧内に存在する投稿を検出し、`getPostThread`＋`extractOwnedLinearReplyChain`で欠落投稿を取得して`posts`へ追加、`indexedAt`降順に再ソートする（design.md §2.4）。
- [x] `[TEST]` `normalizeBackfilledThreadPost`の単体テストを追加する（`record.reply`あり/なしの分岐、必須フィールド欠如時に`undefined`を返すこと）。
- [x] `[TEST]` `GET /v2/entries`のルートテストに、中間投稿がgetAuthorFeedから欠落するケースを追加し、`getPostThread`が正しいroot uriで呼ばれ、欠落投稿が`posts`に補完されることを確認する。
- [x] `[TEST]` `npx vitest run`・`npx tsc --noEmit`が全件成功することを確認した。既存Phase 1〜6のテストに regression が無いことも確認した。
- [ ] 手動確認: 実際に中間投稿が欠落するスレッド（例に挙げた投稿）で、Timeline上で3件（test/test2/test3）すべてを含むスレッドの折りたたみUIが表示されることを確認する（要ログイン、次回セッション以降または利用者による確認が必要）。

**本Phaseの実装はPhase 8で置き換え・撤去された。** `replyRootUri`によるgap検出方式では「rootは残るが後続投稿がすべて欠落する」ケースを検知できないという限界があり、`replyCount`ベースの権威的解決（Phase 8）に置き換えられた。

## Phase 7: リンク・スレッド全体削除（design.md §8対応）

- [x] `[FE]` `src/components/entry/EntryCard/resolveThreadDeleteOption.ts`を`src/lib/entry/resolveThreadDeleteOption.ts`へ移設し、`EntryCard`側のimportを更新する（design.md §8.1）。対応するテスト（`tests/components/entry/EntryCard/resolveThreadDeleteOption.test.ts`）も`tests/lib/entry/resolveThreadDeleteOption.test.ts`へ移設し、import元を更新する。
- [x] `[FE]` `src/components/post/PostCard/useSkyshareEntryStatus.ts`を拡張する（design.md §8.2）: `isResolvingThreadOption`・`showThreadOption`の追加、`requestDeleteEntry`の非同期化（`resolveThreadDeleteOption`呼び出し）、`confirmDeleteEntry`への`deleteBskyThread`引数追加、`onPostDeleted`への`deletedThread`引数伝搬。
- [x] `[FE]` `src/components/post/PostCard/index.tsx`を変更し、`EntryDeleteConfirmDialog`へ`showThreadOption`/`onDeleteThread`を渡し、判定中のLoading overlay・ボタンdisabled状態を追加する（design.md §8.3）。
- [x] `[FE]` `src/components/post/ThreadCard/index.tsx`を変更し、`deletedThread=true`の場合にスレッドグループ全体（`group.rootPost`＋`group.replies`）を一覧除去対象にする（design.md §8.4）。
- [x] `[TEST]` `npx tsc --noEmit`・`npx vitest run`が全件成功することを確認した（既存`resolveThreadDeleteOption`のテストが移設後も成功することを含む）。
- [ ] `[TEST]` Playwrightで、entry付きスレッドルート投稿の削除ボタンから「リンク・スレッド全体を削除」の選択肢が表示され、選択すると折りたたみ/展開の対象だった投稿すべてが一覧から消えることを確認する。ゲストモードでは削除ボタン自体が無効化されているため自動検証不可。実アカウントでの確認が必要（要ログイン、次回セッション以降または利用者による確認が必要）。

**上記のうち`onPostDeleted`への`deletedThread`引数伝搬（`useSkyshareEntryStatus.ts`・`PostCard`・`ThreadCard`）はPhase 8で撤去・簡素化された。** Phase 8でTimelineのページング対象アイテムが`ThreadGroup[]`そのものになったことで、一覧からの除去は常にスレッドグループ単位となり、`deletedThread`で除去範囲を切り替える必要が無くなったため（design.md §4参照）。`resolveThreadDeleteOption`の共有化・`showThreadOption`/`isResolvingThreadOption`によるダイアログ制御自体はPhase 8後も維持される。

## Phase 8: バックエンド応答のスレッド構造化（design.md §1-§4対応。Phase 1・2・6.5を置き換え・撤去）

背景: Phase 6.5のgap検出方式（直接の親が一覧に無くrootのみ一覧内という条件でのみbackfillを発火）では、getAuthorFeedがスレッドの後続投稿すべてを欠落させ、rootのみが残るケースを検知できなかった。`PostView.replyCount`と投稿レコード自体の`record.reply`を権威あるシグナルとして使い、グルーピング自体をバックエンドで完結させる設計に変更する。これに伴い、Phase 1（reply chain情報の追加）・Phase 2（クライアント側グルーピング）・Phase 6.5（gap検出バックフィル）の実装はすべて本Phaseで置き換えられ、撤去される。

- [x] `[BE]` `src/lib/entry/posts.ts`の`TimelinePost`から`replyParentUri`/`replyRootUri`を削除する。`normalizeTimelinePost`から`FeedViewPost.reply`を読む処理を削除する。
- [x] `[BE]` `src/lib/entry/posts.ts`に`ThreadGroup`型（`rootPost`/`replies`）を追加する（旧`src/components/post/Timeline/threadGroup.ts`から移設。`id`フィールドは持たない）。
- [x] `[BE]` `normalizeBackfilledThreadPost`を`normalizePostViewToTimelinePost`にリネームする。
- [x] `[BE]` `src/lib/atproto/threadChain.ts`に`extractReplyRootUri`を追加する（design.md §2.2）。
- [x] `[BE]` `src/lib/entry/timelineThreads.ts`を新規作成し、`buildTimelineThreads`を実装する（design.md §2.3の疑似コード通り。root解決は`Promise.all`で並行実行すること）。
- [x] `[BE]` `src/pages/v2/entries.ts`の`backfillMissingThreadPosts`を削除し、`buildTimelineThreads`の呼び出しに置き換える。レスポンスを`{ cursor, posts }`から`{ cursor, threads }`に変更する（design.md §2.4）。
- [x] `[BE]` `src/lib/api/schema/v2/entries/get.ts`の`ResponseBody200Schema`を`threads`形状に変更する（design.md §2.5）。
- [x] `npm run codegen`を実行し、フロントエンド用クライアントの型を`threads`形状に反映する。
- [x] `[FE]` `src/components/post/Timeline/threadGroup.ts`・`tests/components/post/Timeline/threadGroup.test.ts`を削除する。
- [x] `[FE]` `src/components/post/ThreadCard/index.tsx`・`entryCandidate.ts`の`ThreadGroup`のimport元を`@/lib/entry/posts`に変更する（ロジックは無変更）。
- [x] `[FE]` `src/components/post/Timeline/index.tsx`を変更し、`ComponentList`へ渡す`items`を`buildTimelineThreads`済みの`threads`（APIレスポンスそのもの）にする。`getItemKey`を`thread => thread.rootPost.uri`に変更する（design.md §3）。
- [x] `[FE]` `src/lib/entry/guestDummyPosts.ts`に`GUEST_DUMMY_THREADS`を追加し、`Timeline/index.tsx`のゲストモード分岐で使う（design.md §3.2）。
- [x] `[FE]` `src/components/post/PostCard/useSkyshareEntryStatus.ts`の`onPostDeleted`シグネチャを`(deletedThread?: boolean) => void`から`() => void`に戻す（design.md §4、`items`が`ThreadGroup[]`になったことで`deletedThread`による除去範囲の切り替えが不要になったため）。
- [x] `[FE]` `src/components/post/PostCard/index.tsx`の`onPostDeleted` propを`() => void`に戻す。
- [x] `[FE]` `src/components/post/ThreadCard/index.tsx`の`onPostDeleted`コールバックを、`deletedThread`分岐を持たない単純な形（`() => onPostDeleted(g => g.rootPost.uri === group.rootPost.uri)`）に簡素化する（design.md §4・§7.4）。
- [x] `[TEST]` `tests/lib/entry/timelineThreads.test.ts`を新規作成する: 単独投稿のみ／通常のスレッド／root残存＋後続全欠落（新規カバー範囲）／中間投稿欠落（Phase 6.5の既存ケース）／`getPostThread`失敗時のフォールバック／複数スレッド同時存在時の並び順、を網羅する。
- [x] `[TEST]` `tests/pages/v2/entries.test.ts`を`threads`形状に更新する（`json.posts`→`json.threads`）。root残存＋後続全欠落のケースもルートテストとして追加した。
- [x] `[TEST]` `tests/lib/entry/posts.test.ts`の`replyParentUri`/`replyRootUri`関連ケースを削除し、リネームに追従させる。
- [x] `[TEST]` `tests/components/post/ThreadCard/entryCandidate.test.ts`のimport元を更新する。
- [x] `[TEST]` `tests/lib/atproto/threadChain.test.ts`に`extractReplyRootUri`の単体テストを追加した。
- [x] `[TEST]` `npx vitest run`（577件）・`npx tsc --noEmit`・`npx playwright test`（8件、`timelineThread.spec.ts`含む）が全件成功することを確認した。
- [ ] 手動確認: 実際に中間/後続投稿が欠落するスレッドで、Timeline上で全件を含むスレッドの折りたたみUIが表示されることを確認する（要ログイン、次回セッション以降または利用者による確認が必要）。
- [ ] 手動確認: スレッドルート投稿の「リンク・Bluesky投稿を削除」（スレッド全体削除ではない）実行後、そのスレッドグループ全体が一覧から除去され、再取得（リロード）で後続投稿が新しい独立したスレッドとして再表示されることを確認する（NFR-5、要ログイン）。

## Phase 9: 分岐スレッドの正しい選択・削除カスケードとの整合・事後entry作成のルート限定（design.md §2.2, §2.3, §5, §7.1対応）

背景: スレッドが途中で分岐する場合（同一投稿に対する自分自身の複数返信、例: A-B-Cに加えA-D-EやA-B-F）に、Timeline上で正しく表示されないことが判明した。`extractOwnedLinearReplyChain`が「各ノードのreplies配列で最初に一致する投稿を機械的に採用する」という、AppViewの応答順に依存した恣意的な選択ロジックだったことが原因。同関数はentry削除カスケードとも共有されているため、削除対象がTimeline表示と食い違いうる問題も併せて解消する。また、事後entry作成の対象が中間投稿になりうる旧仕様を、投稿時と同じ「常にルート」規約に統一する。

- [x] `[BE]` `src/lib/atproto/threadChain.ts`の`extractOwnedLinearReplyChain`を改良する: 起点の所有権チェック（`ownerDid`不一致なら空配列）を追加。子ノード選択を「最初の1件」から「`author.did===ownerDid`な全候補のうち、候補が2件以上（実在する分岐）の場合のみ`record.createdAt`が親に最も近い1件を選ぶ」に変更する（design.md §2.2）。
- [x] `[BE]` `src/lib/entry/timelineThreads.ts`の`buildTimelineThreads`から「救済マージ」ステップ（`anchorRootUri`一致による強制合流）を削除する。root解決結果が空配列（他人のスレッドへの返信）の場合はそのrootを`resolvedThreads`に登録しないガードを追加する（design.md §2.3）。
- [x] `[BE]` `src/pages/v2/entry.ts`のDELETEハンドラ・`src/lib/entry/resolveThreadDeleteOption.ts`はコード変更なし（同じ`extractOwnedLinearReplyChain`を呼んでいるため、改良後の挙動を自動的に受け取る。design.md §7.1）。
- [x] `[FE]` `src/components/post/ThreadCard/entryCandidate.ts`の`resolvePostCreateEntryTarget`を、常にルート投稿のみを対象にする形に変更する（ルートが画像を持たない場合のrepliesへのフォールバックを廃止。design.md §5）。
- [x] `[FE]` `src/components/post/ThreadCard/index.tsx`で、ルートの`PostCard`にも`postCreateEntryButton`を明示的に渡す（design.md §5）。
- [x] `[TEST]` `tests/lib/atproto/threadChain.test.ts`に新規ケースを追加: 起点did不一致で空配列、分岐時の時刻近接tie-break、同値時の出現順優先、`createdAt`欠損時のフォールバック、分岐が無い場合(候補1件)は時刻乖離があっても採用。
- [x] `[TEST]` `tests/lib/entry/timelineThreads.test.ts`に新規ケースを追加: 分岐で正しい1本が選ばれ他方が単独ThreadGroupになること、root did不一致（他人のスレッドへの返信）時に単独表示されること。
- [x] `[TEST]` `tests/pages/v2/entries.test.ts`に分岐ケースのルートレベル統合テストを追加する。
- [x] `[TEST]` `tests/pages/v2/entry.test.ts`（`deleteBskyThread`関連）に「分岐時、Timelineが採用しない側は削除されない」ケースを追加する。
- [x] `[TEST]` `tests/lib/entry/resolveThreadDeleteOption.test.ts`に分岐ケースを追加する。
- [x] `[TEST]` `tests/components/post/ThreadCard/entryCandidate.test.ts`を新仕様（常にルートのみ、repliesへのフォールバック廃止）に書き換える。
- [x] `[TEST]` `src/lib/entry/guestDummyPosts.ts`にスレッドC（ルートに画像あり・entry未作成、事後entry作成ボタンの正常系）を追加し、`tests/e2e/timelineThread.spec.ts`をルート限定の新仕様に更新する。
- [x] `npx vitest run`（587件）・`npx tsc --noEmit`・`npx playwright test`（9件）が全件成功することを確認した。
- [ ] 手動確認: 実アカウントで、既存の古い投稿に事後で別スレッドを継ぎ足し、Timeline上でA-B-CとA-D-Eが正しく別グループとして分かれて表示されることを確認する。
- [ ] 手動確認: 分岐元スレッドの「スレッド全体削除」を実行し、採用されなかった側の投稿が削除されずに残ることを確認する。

## Phase 10: 事後entry作成の対象拡大 — ボタンは常にルート、Visualはルートに最も近い画像投稿から（design.md §5訂正対応）

背景: Phase 9で「事後entry作成の対象は常にルート投稿のみ」に制限した結果、ルート投稿が画像を持たないスレッドでは、後続に画像付き投稿が追加されても事後entry作成が一切できなくなった。調査の結果、`fromPost.ts`の`resolveFromPostSource`（既存実装）が、指定した投稿の`record.reply.root`が呼び出し者自身の投稿を指していれば、entryの`source`を自動的にスレッド先頭へ解決することが判明した。この既存の仕組みを踏まえ、「ボタンは常にルート投稿のカードに表示する」という制約は維持しつつ、「ボタンの表示可否とVisualの生成元」はルート自身の画像に限定せず、スレッド内の後続投稿（replies）の画像も対象にするよう訂正する。

- [x] `[FE]` `src/components/post/ThreadCard/entryCandidate.ts`の`resolvePostCreateEntryTarget`を`resolveEntryVisualSourcePost`にリネームし、ルートが画像を持たない場合にrepliesのうち時系列上最も古い画像投稿へフォールバックするロジックを復元する（design.md §5）。
- [x] `[FE]` `src/components/post/PostCard/useSkyshareEntryStatus.ts`の`Options`に`visualSourcePost?: TimelinePost`を追加し、`hasImages`判定・画像取得・`createEntry`へ渡す`uri`を`item`ではなく`visualSourcePost ?? item`ベースにする（design.md §5）。
- [x] `[FE]` `src/components/post/PostCard/index.tsx`に`entryVisualSourcePost?: TimelinePost` propを追加し、`useSkyshareEntryStatus`へ渡す。
- [x] `[FE]` `src/components/post/ThreadCard/index.tsx`を更新: ルートの`PostCard`に`postCreateEntryButton={!!entryVisualSourcePost}`・`entryVisualSourcePost`を渡す。repliesの`PostCard`には常に`postCreateEntryButton={false}`を渡し、ボタンが中間投稿のカードに表示されることはないことをコードで保証する。
- [x] `[TEST]` `tests/components/post/ThreadCard/entryCandidate.test.ts`を`resolveEntryVisualSourcePost`向けに更新し、「ルートが画像を持たない場合、repliesのうち時系列上最も古い画像投稿を返す」ケースを復元する。
- [x] `[TEST]` `tests/e2e/timelineThread.spec.ts`のスレッドAのテストを、ルート投稿のカードに事後entry作成ボタンが表示され（Visual元は中間投稿の画像）、mid・tailいずれのカードにも表示されないことを確認する内容に更新する。
- [x] `src/lib/entry/guestDummyPosts.ts`のスレッドA・スレッドCのコメントを新しい趣旨に更新する。
- [x] `npx vitest run`（587件）・`npx tsc --noEmit`・`npx playwright test`（9件）が全件成功することを確認した。
- [ ] 手動確認: 実アカウントで、ルートが画像を持たないスレッドに画像付きreplyを追加し、ルートのカードに事後entry作成ボタンが表示されること、押下後に作成されたentryのVisualがそのreplyの画像から生成され、`source`がスレッド先頭を指すことを確認する。

## Phase 11: 分岐先スレッドセグメントの仕様追加（spec更新のみ、design.md §2.2.1・§2.3対応）

背景: Phase 9で「分岐時は投稿日時が最も近い1系統のみを採用し、不採用側はそれぞれ独立した単独投稿として表示する」という仕様を確定させたが、この結果、A→B,D,Fのように複数方向へ分岐したスレッドでは、不採用側（D-E、F-G）が本来は連続した投稿列であるにもかかわらず、Timeline上でバラバラの単独投稿として表示され、事後entry作成をしても`source`が分断されてしまう（例: F-Gに対し作成すると、Fではなく末尾のG自身が`source`になり、F-Gが1つのentryとして連結されない）という不整合が判明した。本Phaseで、分岐先（D、F）を新たな「スレッドセグメントのルート」として扱い、そこから伸びる投稿列も独立したスレッドセグメントとして構築できるようにする要件・設計を追加した。本Phaseはドキュメント更新のみであり、実装（Phase 12以降）は別セッションで行う。

- [x] `requirements.md`の用語定義に「プロトコルルート」「スレッドセグメント」を追加し、「ルート投稿」の定義をセグメント単位に整理し直した。
- [x] `requirements.md` FR-1を、「分岐で不採用の投稿は独立した単独投稿として表示する」から「分岐で不採用の投稿群は、分岐先を新たなルート投稿とする別のスレッドセグメントとして扱う（2件以上ならグルーピング表示）」に書き換えた。多段分岐（1つのセグメント内でさらに分岐する場合）も同様に扱う旨を明記した。
- [x] `requirements.md` NFR-3に、分岐後のスレッドセグメントが`getAuthorFeed`の一覧取得から完全に欠落するケースへの対応を追記した。
- [x] `requirements.md`の受け入れ条件を新仕様に合わせて書き換え、未実装のため`- [ ]`（未検証）に戻した。
- [x] `design.md`に`extractOwnedReplySegments`（§2.2.1、分岐先セグメントをBFSで列挙する新関数）の設計・疑似コードを追加した。既存の`extractOwnedLinearReplyChain`はこれに委譲するリファクタとして位置づけ、entry詳細ページ・削除カスケード側は変更不要であることを明記した。
- [x] `design.md` §2.3（`buildTimelineThreads`）の処理フローを、投稿uri→セグメント逆引きMapによるセグメント単位の構築ロジックに書き換え、欠落セグメントの`order`事後挿入処理を追加した。
- [x] `design.md` §5・§7.1に、ThreadGroupの単位がスレッドセグメントになることによる影響（変更不要である旨）を注記した。
- [x] `specs/entry/backend/requirements.md` FR-2・`design.md` §7.3の source解決規則を、「対象投稿が属するスレッドセグメントのルート」を`source`とする記述に統合した。
- [x] `specs/entry/frontend/design.md` §3.3に、`source`が常にプロトコルルートとは限らずセグメントルートでありうる旨を注記した。

**Phase 12〜16（旧計画、`extractOwnedReplySegments`による分岐先セグメント表示）は、以下のPhase 17による設計見直しで撤回された。** 不採用側の分岐を独立したスレッドグループとして表示する代わりに、Timelineには一切表示しない方針に変更されたため（requirements.md FR-1）、セグメント列挙自体が不要になった。

## Phase 17: メインスレッド専用設計への転換（spec更新のみ、requirements.md・design.md全面改訂）

背景: Phase 11で「分岐先セグメントもTimelineに表示する」設計へ進めていたが、利用者からの再検討要請により方針を転換した。(1) サブスレッド（分岐で不採用側の投稿）はTimelineに一切表示しない、(2) 他人の投稿への返信から始まるスレッド（後続がすべて自分の投稿であっても）もTimelineに一切表示せず、entry作成対象にもしない、(3) メインスレッドの選出はTimeline取得のたびに動的に再評価される（構成投稿が削除されれば次点の系統が自動的に昇格する）、(4) skyshare entry作成の可否判定（画像を含むか・対象がルートか等）をサーバから撤廃し、クライアントの責務にする、(5) entry作成時の`source`はクライアントが明示的に指定し、サーバはreply chainを辿った自動解決を行わない。本Phaseはドキュメント更新のみであり、実装（Phase 18以降）は別セッションで行う。

- [x] `requirements.md`の用語定義を書き換えた（「スレッドセグメント」を廃止し、「自分起点スレッド」「他者起点スレッド」「メインスレッド」「サブスレッド」を追加）。
- [x] `requirements.md` FR-1を「メインスレッドのグルーピング表示」に書き換え、他者起点スレッドの非表示・サブスレッドの非表示・メインスレッドの動的再評価を明記した。
- [x] `requirements.md` FR-3を「クライアントが作成可否・作成範囲を判断する」形に書き換え、ルート限定・source明示送信の方針を追加した。
- [x] `requirements.md` NFR-4に、entry作成可否の判断はクライアントの責務でありサーバの構造判定とは別の関心事である旨を追記した。
- [x] `requirements.md`の受け入れ条件を新仕様に合わせて書き換えた。
- [x] `design.md`から`extractOwnedReplySegments`関連の記述を撤去し、§2.3（`buildTimelineThreads`）を「他者起点スレッドの除外（AT URIからのDID抽出）＋メインスレッドのみの組み立て」ロジックに書き換えた。
- [x] `design.md` §5に、`entrySourcePost`（常にルート投稿）を`entryVisualSourcePost`（Visual生成元、ルートまたはreply）と分離して送信する設計を追加した。
- [x] `specs/entry/backend/requirements.md` FR-1（entry作成対象の妥当性判定をサーバから撤廃）・FR-2（sourceの決定、自動解決の廃止）・FR-4（from-postの対象制限をクライアントの責務にする）を書き換えた。
- [x] `specs/entry/backend/design.md` §7を全面改訂し（`source解決ロジック`→`sourceの決定ロジック`）、`resolveFromPostSource`・`isPostOnOwnedRootChain`・セグメント探索を撤去した設計にした。§7.4〜7.5を§7.3〜7.4に繰り上げた。
- [x] `specs/entry/frontend/design.md`のsource自動解決・セグメント関連の記述を、新しいsource決定方式に合わせて更新した。

## Phase 18: バックエンドの再実装（design.md §2.2・§2.3対応）

- [ ] `[BE]` `src/lib/atproto/threadChain.ts`に`extractRepoDidFromAtUri`を追加する（design.md §2.2）。`extractOwnedLinearReplyChain`・`extractReplyRootUri`は変更なし。
- [ ] `[BE]` `src/lib/entry/timelineThreads.ts`の`buildTimelineThreads`を、design.md §2.3の疑似コード通り「他者起点スレッドの除外＋メインスレッドのみの組み立て」ロジックに書き換える。現行の「不採用側は単独ThreadGroupとして表示する」フォールバックを削除する。
- [ ] `[TEST]` `tests/lib/atproto/threadChain.test.ts`に`extractRepoDidFromAtUri`の単体テストを追加する。
- [ ] `[TEST]` `tests/lib/entry/timelineThreads.test.ts`を更新する: 他人の投稿への返信（後続が自分の投稿のみの場合を含む）がTimelineに一切表示されないこと、分岐で不採用の投稿群がTimelineに一切表示されないこと（単独投稿としても表示されない）、メインスレッドの構成投稿が無くなった場合に次点の系統が選出されること（`getPostThread`のモック応答を変えて再現）を確認するケースに更新する。
- [ ] `[TEST]` `tests/pages/v2/entries.test.ts`を更新する。
- [ ] `npx vitest run`・`npx tsc --noEmit`が成功することを確認する。

## Phase 19: from-postのsource自動解決撤廃（`specs/entry/backend/tasks.md` Phase 4と対応）

- [ ] `[BE]` `src/lib/entry/fromPost.ts`から`resolveFromPostSource`・`isPostOnOwnedRootChain`・`hasEligibleImage`を削除する（[specs/entry/backend/tasks.md Phase 4](../entry/backend/tasks.md)）。
- [ ] `npx vitest run`・`npx tsc --noEmit`が成功することを確認する。

## Phase 20: フロントエンドのsource明示送信（design.md §5対応）

- [ ] `[FE]` `src/components/post/PostCard/useSkyshareEntryStatus.ts`の`Options`に`sourcePost?: TimelinePost`を追加し、APIへ送信する`uri`を`options.sourcePost ?? item`ベースにする（`visualSourcePost`とは独立に扱う）。
- [ ] `[FE]` `src/components/post/PostCard/index.tsx`に`entrySourcePost?: TimelinePost` propを追加し、`useSkyshareEntryStatus`へ渡す。
- [ ] `[FE]` `src/components/post/ThreadCard/index.tsx`を更新し、rootの`PostCard`に`entrySourcePost={group.rootPost}`を渡す。
- [ ] `[TEST]` `tests/components/post/PostCard/useSkyshareEntryStatus.test.ts`（または相当のテスト）に、`visualSourcePost`がreplyでも`sourcePost`（root）のuriがAPIへ送信されることを確認するケースを追加する。
- [ ] `npx vitest run`・`npx tsc --noEmit`が成功することを確認する。

## Phase 21: E2E・仕上げ

- [ ] `[FE]` `src/lib/entry/guestDummyPosts.ts`に、他人の投稿への返信から始まる自己スレッド（Timelineに表示されないことを確認するフィクスチャ）・分岐スレッド（採用側のみ表示されることを確認するフィクスチャ）を追加する。
- [ ] `[TEST]` `tests/e2e/timelineThread.spec.ts`に、上記フィクスチャを用いたPlaywrightシナリオを追加する。
- [ ] `npx vitest run`・`npx tsc --noEmit`・`npx playwright test`が全件成功することを確認する。
- [ ] 手動確認: 実アカウントで他人の投稿に返信し、そこから自分の投稿を続けても、その一連の投稿がTimelineに一切表示されないことを確認する。
- [ ] 手動確認: 分岐スレッド（A→B,D）を作成し、Bのみが表示されDが表示されないこと、Bを削除すると次回表示でDが新たにメインスレッドとして表示されることを確認する（要ログイン）。
- [ ] 手動確認: ルートが画像を持たずreplyが画像を持つスレッドで事後entry作成を行い、作成されたentryの`source`がルート投稿になっていることを確認する（要ログイン）。
