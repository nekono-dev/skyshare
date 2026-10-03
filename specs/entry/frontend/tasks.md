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

- [x] `npm run codegen`実行後の型（トップレベル`createEntry`/`visual`/`skyshareEntry`、`deleteBskyThread`）にフロントエンドの実装を追従させる（`npx tsc --noEmit`エラーゼロを確認済み）。
- [ ] 手動確認: 実アカウントで画像投稿segmentが2件以上のスレッドを投稿し、選択したsegmentの画像がvisualとして使われ、entryが1件のみ作成されることを確認する（要ログイン、次回セッション以降または利用者による確認が必要）。
- [ ] 手動確認: 実アカウントでスレッド由来entryの詳細ページ・削除確認UI・視覚的区別が期待通り表示されることを確認する（要ログイン、次回セッション以降または利用者による確認が必要）。サンプルページ（`entries/sample-thread.astro`）・ゲスト表示（`/entries/?guest`）でのレンダリング自体はPlaywrightで確認済み。
- [x] 既存の単発投稿フロー（`ImagePicker`、entry詳細ページ）に regression が無いことを確認した（`npx vitest run`556件・`npx playwright test`全件成功、`entries/sample.astro`のフォールバック表示も確認済み）。

## Phase 6: スレッド全体削除の最終警告ダイアログ追加（design.md §3.4改訂対応）

- [x] 新規共通コンポーネント`ConfirmDialog`（`src/components/common/ConfirmDialog/`）を実装する。`Overlay`＋`ui.module.css`の`dialog-card`/`dialog-body`/`dialog-actions`/`dialog-actions-row`を直接使い、タイトル・本文メッセージ・確定/キャンセルボタンを描画する。
- [x] `ChoiceDialog`（`src/components/common/ChoiceDialog/index.tsx`）の`variantClassName`定数を`export`し、`ConfirmDialog`から再利用してボタン配色を揃える。
- [x] `EntryDeleteConfirmDialog`（`src/components/entry/EntryDeleteConfirmDialog/index.tsx`）に`stage`（`"choice"` | `"confirmThread"`）stateを追加し、「スレッド全体を削除」選択時に即実行せず`ConfirmDialog`による最終確認を挟むよう変更する。`open`がfalseになったら`stage`を`"choice"`にリセットする。
- [x] `src/components/common/README.md`の部品一覧・依存グラフに`ConfirmDialog`（`ConfirmDialog --> Overlay`）を追加する。
- [x] `[TEST]` `npx tsc --noEmit`・既存`vitest`一式（`npx vitest run`580件）が壊れていないことを確認した。
- [x] `[TEST]` Playwright（`tests/e2e/entryList.spec.ts`）でゲスト表示（`/entries/?guest`）のレンダリング回帰を再確認した（既存踏襲。ゲスト表示では削除ボタン自体が無効化されているため、最終確認ダイアログの実際の表示・段階遷移はこの経路では検証できない）。
- [ ] 手動確認: 実アカウントで「スレッド全体を削除」押下→最終確認ダイアログへの遷移→キャンセルで選択肢表示（`"choice"`）へ戻ること→再度「スレッド全体を削除」→最終確認→確定操作で`DELETE /v2/entry`が`deleteBskyThread: true`で送信され削除が完了することを、`/entries`（`EntryCard`）・Timeline（`PostCard`）両方の導線で確認する（要ログイン、次回セッション以降または利用者による確認が必要）。

## Phase 7: Bluesky投稿削除の統合・単発投稿の最終確認・旧entryの無効化（design.md §3.4改訂対応）

前提: [specs/entry/backend/tasks.md](../backend/tasks.md) Phase 5（`deleteBskyThread`廃止・`isThreadRootPost`追加・409対応・`npm run codegen`）。本Phaseは、Phase 3・6の「スレッド全体を削除」専用ボタンと`showThreadOption`を、「リンク・Bluesky投稿を削除」への一本化（常に最終確認、旧entryは無効化）で置き換える。

- [x] `[FE]` `src/lib/entry/resolveThreadDeleteOption.ts`を`src/lib/entry/resolveEntryDeleteScope.ts`へ改名し、`EntryDeleteScope`（`deletable`/`legacy`/`unknown`）を返す実装へ置き換える（design.md §3.4.1）。`isThreadRootPost`・`extractOwnedLinearReplyChain`を用い、`getPostThread`は`parentHeight: 0`で呼ぶ。
- [x] `[FE]` `src/components/common/ChoiceDialog/index.tsx`に任意prop`description?: string`を追加し、ボタン列の上に`ui["dialog-body"]`で表示する（design.md §3.4.2）。`src/components/common/README.md`の記載を更新する。
- [x] `[FE]` `src/components/entry/EntryDeleteConfirmDialog/index.tsx`を更新する（design.md §3.4.2）: props を`deleteScope`ベースへ置き換え（`showThreadOption`・`onDeleteThread`を削除）、stageを`"choice"`/`"confirmPost"`に変更する。「リンク・Bluesky投稿を削除」は`deletable`で`red`・最終確認遷移、`legacy`/`unknown`で`gray`・`disabled`・`description`に理由表示とする。最終確認の文言は`postCount`で単発/スレッドを出し分ける。
- [x] `[FE]` `src/components/entry/EntryCard/index.tsx`を更新する（design.md §3.4.3）: `deleteScope` stateと`resolveEntryDeleteScope`呼び出し、`confirmDelete`から`deleteBskyThread`引数の削除、409応答のエラーメッセージ。orphaned entryの単純確認は変更しない。
- [x] `[FE]` `src/components/post/PostCard/useSkyshareEntryStatus.ts`・`src/components/post/PostCard/index.tsx`を更新する（design.md §3.4.3）: `isResolvingDeleteScope`・`deleteScope`への改名、`confirmDeleteEntry`の引数整理、ダイアログへの`deleteScope`受け渡し。Timeline側の一覧除去の仕様は[specs/timeline/tasks.md](../../timeline/tasks.md)で扱う。
- [x] `[FE]` `src/components/entry/README.md`・`src/components/post/README.md`の削除確認ダイアログに関する記述を更新する。
- [x] `[FE]` ゲスト表示での削除フローの模擬を実装する（design.md §3.4.4）: `src/lib/entry/guestDummyPosts.ts`に`GUEST_DELETE_SCOPES`・`resolveGuestDeleteScope`を追加し、スレッドD・`guest-unknown`のダミーデータ（entry付き）を追加する。`EntryCard`・`useSkyshareEntryStatus`で、`guestMode`時は`resolveGuestDeleteScope`による判定と、`deleteEntry`を呼ばない成功遷移に切り替える。削除ボタンのゲスト無効化を外す（編集ボタン等は無効のまま）。`PostCardEntryActions`に`deleteDisabled`を追加する。ゲスト案内文に模擬動作である旨を加える。
- [x] `[TEST]` `tests/lib/entry/resolveThreadDeleteOption.test.ts`を`tests/lib/entry/resolveEntryDeleteScope.test.ts`へ改名・更新する: 不正な`sourceUri`→`unknown`、単発起点→`deletable`（`postCount: 1`）、自己後続投稿あり→`deletable`（件数が一致）、`record.reply`あり→`legacy`、`getPostThread`失敗・`NotFoundPost`→`unknown`、分岐で採用側のみ数えること。
- [x] `[TEST]` `npx tsc --noEmit`・`npx vitest run`が全件成功することを確認する。
- [x] `[TEST]` Playwrightで、ゲスト表示（`/entries/?guest`・`/?guest`）の模擬動作により削除フローを確認する。`tests/e2e/entryDeleteDialog.spec.ts`（新規）を追加し、`page.route`で`**/v2/entry`（DELETE）と`public.api.bsky.app`の`getPostThread`を監視して、いずれの通信も発生しないことを全シナリオで検証する。
  - `/entries/?guest`、単発のentry（`guest2`）: 削除ボタンが活性。押下で「リンク・Bluesky投稿を削除」が活性（グレーでない）で表示される → クリックしても直後には削除されず、「Blueskyの投稿を削除します」を含む最終確認が表示される → キャンセルで選択肢表示に戻る → 再度選んで確定するとカードが一覧から消える
  - `/?guest`、スレッドB（`guest-thread-b-root`のentry）: 最終確認に「2件の投稿」と「第三者からの返信は削除されず残ります」が表示され、確定するとスレッドグループ全体が一覧から消える
  - `/?guest`、スレッドD（返信側のentry）: 「リンク・Bluesky投稿を削除」が同じ文言のまま`disabled`で、旧仕様を示す理由文が表示される。クリックしても最終確認へ遷移しない。「Skyshareリンクを削除」は押下でき、スレッドグループは一覧に残る
  - `/?guest`、`guest-unknown`のentry: 「リンク・Bluesky投稿を削除」が`disabled`で、状態を確認できない旨の理由文が表示される
  - 「Skyshareリンクを削除」押下では最終確認を挟まずカードのentry表示のみが消える
  - 編集ボタンなど削除以外のゲスト無効化が維持されている
  - 既存の`tests/e2e/entryList.spec.ts`のゲスト表示確認（削除ボタンが無効であることを検証している箇所）を、削除ボタンが活性であることの検証へ更新し、他のレンダリング回帰は維持する
- [ ] 手動確認: 実アカウントで、(1) 単発投稿由来entryの「リンク・Bluesky投稿を削除」で最終確認が出て確定後にBluesky投稿が削除されること、(2) スレッド由来entryで自己後続投稿がすべて削除され第三者の返信が残ること、(3) 旧実装で作成された（中間投稿を`source`とする）entryでボタンがグレーかつ理由が表示されること、を`/entries`・Timeline両方の導線で確認する（要ログイン、利用者による確認が必要）。

## Phase 8: 削除予定Bluesky投稿一覧付きの最終確認（design.md §3.4.1・§3.4.2・§3.4.5対応）

前提: Phase 7。最終確認の`ConfirmDialog`を、削除予定投稿の一覧を持つ専用ダイアログへ置き換える。

- [x] `[FE]` `src/lib/entry/resolveEntryDeleteScope.ts`を更新する: `EntryDeleteScope`の`deletable`を`{ kind: "deletable"; posts: TimelinePost[] }`へ変更し（`postCount`は廃止、件数は`posts.length`）、`chain`を`normalizePostViewToTimelinePost`で変換して保持する。変換不能な投稿があれば`unknown`を返す。
- [x] `[FE]` `src/components/entry/DeletePostListDialog/`（`index.tsx`・`index.module.css`）を新設する（design.md §3.4.5）: 日時・省略本文・サムネイル（最大4枚＋「+N」）の一覧、スクロール領域、`isDeleting`中のローディングと両ボタン無効化。
- [x] `[FE]` `src/components/entry/EntryDeleteConfirmDialog/index.tsx`を更新する: `confirmPost`ステージの`ConfirmDialog`を`DeletePostListDialog`へ置き換え、`deleteScope.postCount`の参照を`posts.length`／`posts`へ改める。
- [x] `[FE]` `src/lib/entry/guestDummyPosts.ts`の`GUEST_DELETE_SCOPES`を`posts`形式へ更新し、`guestPost(id)`を追加する（design.md §3.4.4）。
- [x] `[FE]` `src/components/entry/README.md`に`DeletePostListDialog`を追記し、`EntryDeleteConfirmDialog`の記述を更新する。
- [x] `[TEST]` `tests/lib/entry/resolveEntryDeleteScope.test.ts`を更新する: `deletable`の`posts`が古い順で`chain`と同数・同一uriであること、単発で1件、分岐では採用側のみ、変換不能な投稿を含む場合は`unknown`。
- [x] `[TEST]` `DeletePostListDialog`の単体テスト（`tests/components/entry/DeletePostListDialog.test.tsx`）: 1件／複数件の`summary`文言、本文が空のとき「（本文なし）」、画像なしでサムネイル欄が無いこと、画像5枚以上で「+N」、確定・キャンセルのコールバック、`isDeleting`時のボタン無効化。
- [x] `[TEST]` `npx tsc --noEmit`・`npx vitest run`が全件成功することを確認する。
- [x] `[TEST]` `tests/e2e/entryDeleteDialog.spec.ts`を更新し、Playwrightで以下を確認する（ゲスト表示、`getPostThread`・`DELETE /v2/entry`への通信が発生しないことの監視は維持）:
  - `/entries/?guest`、単発entry（`guest2`）: 「リンク・Bluesky投稿を削除」を選ぶと最終確認に一覧が表示され、1件分の本文・日時・サムネイル（`img`）がある。最初の選択肢表示には一覧が無い
  - `/?guest`、スレッドB: 一覧が2件で古い順（ルート→後続）に並び、「2件の投稿」と「第三者からの返信は削除されず残ります」が表示される。確定でスレッドグループが消える
  - 画像の無い投稿の行にサムネイルが無いこと
  - キャンセル → 選択肢表示に戻る → 再度選ぶと一覧が再表示される
  - ビューポート高さを320pxに下げたスレッドBの最終確認でも、確定・キャンセルのボタンが画面内で押下できる（`ol`が`overflow-y: auto`のスクロール領域になっている）
  - 一覧の件数が確定時に削除される件数と一致する（スレッドBでグループ全体が消える）
- [ ] 手動確認: 実アカウントで、スレッド由来entryの最終確認の一覧が実際のBluesky投稿（本文・日時・画像）と一致し、確定後に一覧どおりの投稿が削除されること、`/entries`・Timeline両方の導線で同様に表示されることを確認する（要ログイン、利用者による確認が必要）。

## Phase 9: 削除予定投稿一覧の固定高さスクロールと共通コンポーネント化（design.md §3.4.5改訂対応）

- [x] `[FE]` `src/components/entry/DeletePostListItem/`（`index.tsx`・`index.module.css`）を新設し、1行の描画を`DeletePostListDialog`から移す。
- [x] `[FE]` `DeletePostListDialog`の一覧を`ComponentList`＋`DeletePostListItem`へ置き換え、スレッド（2件以上）のみ`.post-list-fixed`（固定高さ・縦スクロール）を適用する。
- [x] `[FE]` `src/components/entry/README.md`に`DeletePostListItem`・`ComponentList`への依存を追記する。
- [x] `[TEST]` `tests/components/entry/DeletePostListDialog.test.ts`に、スレッドのみ固定高さクラスが付くことの検証を追加した。
- [x] `[TEST]` `tests/e2e/entryDeleteDialog.spec.ts`で、スレッドBの一覧が固定高さの`overflow-y: auto`領域であること、各行が潰れていない（高さが内容の高さ以上）こと、低い画面でも「全て削除」が押下できることを確認した（確定ボタン名は「全て削除」）。
