# スレッド投稿機能 タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[FE]` フロントエンド / `[BE]` バックエンド（skyshareサーバサイド） / `[TEST]` テスト

## Phase 1: バックエンド reply（スレッド化）対応 【完了】

- [x] `[BE]` `src/lib/api/schema/common.ts` に `CommonStrongRefSchema` / `CommonReplyRefSchema` を追加する。
- [x] `[BE]` `src/lib/api/schema/v2/entry/post.ts` の両union分岐に `reply: Common.CommonReplyRefSchema.optional()` を追加する。
- [x] `[BE]` `src/lib/api/schema/v2/bsky/record/post.ts` の全union分岐に同様の追加を行う。
- [x] `[BE]` `src/lib/atproto/post.ts` の `createBskyPost` に `reply` 引数を追加し、recordへ `reply: {root, parent}` を設定する。
- [x] `[BE]` `reply.root`/`reply.parent` のuriが呼び出しユーザー自身のDIDに属することをサーバ側で検証する `isReplyRefOwnedBySelf` を実装する。
- [x] `[BE]` `src/pages/v2/entry.ts` / `src/pages/v2/bsky/record.ts` で `body.data.reply` の受け渡し・所有権検証呼び出しを行う。
- [x] `[TEST]` `tests/lib/atproto/post.test.ts` に reply付与時・所有権検証の分岐を追加する。
- [x] `[TEST]` `tests/pages/v2/entry.test.ts` / `tests/pages/v2/bsky/record.test.ts` に reply指定時・他人の投稿への不正なreply指定時（400）の分岐を追加する。
- [x] `[TEST]` `tests/lib/api/schema/entryPost.test.ts` / `tests/lib/api/schema/bskyRecordPost.test.ts` に `reply` のスキーマテストを追加する。
- [x] `npm run codegen` を実行してフロント用クライアントを再生成する（Phase 1.5で`/v2/bsky/record`統合と合わせて実施）。

## Phase 1.5: バックエンド `/v2/bsky/record`統合・`applyWrites`原子化 【完了】

- [x] `[BE]` `package.json`に`@atproto/common-web`（`TID`）・`@atproto/lex-cbor`（`cidForLex`）を依存追加する。いずれもpure JS実装でCloudflare Workers上で動作することを確認済み。
- [x] `[BE]` `src/lib/api/schema/v2/entry/post.ts`を全面刷新し、`POST /v2/bsky/record`を統合する。リクエストボディを`{uri, ogImage}`（from-post）または`{posts: EntryPostItemSchema[], reply?}`（新規投稿、`posts`はスレッド）のunionへ変更し、各`posts[i]`に`createEntry`フラグを追加する。レスポンスを`{posts: [{url, uri, cid, skyshareEntry?}]}`へ統一し、`gateWarning`を廃止する。
- [x] `[BE]` `src/util/formData.ts`に`formDataIndexedArrayToObjects`（`posts[i][field]`形式のインデックス付きFormDataデコード）を追加する。
- [x] `[BE]` `src/lib/codegen/openapiFormData.ts`の`customFormData`を拡張し、オブジェクト配列（`posts`）をインデックス付きフィールド名へエンコードできるようにする。
- [x] `[BE]` `src/lib/atproto/post.ts`の`createBskyPost`（`agent.post()`ベース）を、レコード値のみを組み立てる純粋関数`buildBskyPostRecord`へ置き換える。
- [x] `[BE]` `src/lib/atproto/gate.ts`の`applyPostGate`（ベストエフォート・`createRecord`直接呼び出し）を削除し、`buildThreadgateRecord`/`buildPostgateRecord`（純粋関数）のみ維持する。
- [x] `[BE]` `src/lib/entry/skyshareRecord.ts`の`createSkyshareEntry`（`createRecord`直接呼び出し）を、`buildSkyshareEntryRecord`（純粋関数）+`toCreatedSkyshareEntry`（結果組み立て）へ分割する。
- [x] `[BE]` 新規`src/lib/entry/createBskyThread.ts`を追加し、`rkey`事前採番（`TID`）・cid事前計算（`cidForLex`）・投稿＋gate＋skyshare entryの`writes`組み立て・`applyWrites`呼び出し・結果マッピングを1つのオーケストレーションとして実装する。
- [x] `[BE]` `src/pages/v2/entry.ts`を全面書き換えし、`src/pages/v2/bsky/record.ts`を削除する。`src/lib/api/schema/index.ts`から`/v2/bsky/record/`のエントリを削除する。
- [x] `[BE]` `npm run apigen`を実行し、`createBskyRecord`が生成物から消え`createEntry`が新形状になっていることを確認する。
- [x] `[FE]` `src/components/post/PostForm/submitEntry.ts`・`src/components/post/PostCard/useSkyshareEntryStatus.ts`を新しいリクエスト/レスポンス形状へ追従させる（スレッドUI自体はまだ追加しない）。
- [x] `[FE]` レガシーフロントエンド（`_legacy/frontend/src/lib/v2BackendAPI/createV2Entry.ts`・`PostButton.tsx`）を新エンドポイント形状へ追従させ、`createV2BskyRecord.ts`を削除する。
- [x] `[TEST]` `tests/pages/v2/bsky/record.test.ts`・`tests/lib/api/schema/bskyRecordPost.test.ts`を削除し、`tests/pages/v2/entry.test.ts`・`tests/lib/atproto/post.test.ts`・`tests/lib/atproto/gate.test.ts`・`tests/lib/entry/skyshareRecord.test.ts`・`tests/lib/api/schema/entryPost.test.ts`を新設計に合わせて全面更新する。
- [x] `[TEST]` `tests/util/formData.test.ts`・`tests/lib/codegen/openapiFormData.test.ts`（新規）にインデックス付き配列のデコード/エンコードのテストを追加する。
- [x] `[TEST]` `npx vitest run`（496件）・`npx tsc --noEmit`・レガシー側`npx astro check`がいずれも成功することを確認する。

## Phase 2: バックエンド スレッド下書き対応 【完了】

- [x] `[BE]` `src/lib/api/schema/v2/bsky/drafts/post.ts` の下書き作成リクエストを「1件のtext」から「`posts`（1〜100件の`{text, labels?}`）配列」へ変更する。
- [x] `[BE]` `src/lib/api/schema/v2/bsky/drafts/put.ts` / `get.ts` を同様に`posts`配列対応へ変更する。
- [x] `[BE]` `src/lib/atproto/draft.ts` に `posts` 配列の検証ロジック（作成・更新共通の`parseDraftPostsInput`、一覧取得時の`parseDraft`）を実装する。
- [x] `[BE]` `src/pages/v2/bsky/drafts.ts` のハンドラを`posts`配列対応へ更新する。
- [x] `[FE]` `src/lib/entry/draftList.ts`（データアダプタ、UIコンポーネントではない）を`posts`配列形式に対応させる。
- [x] `[TEST]` `tests/lib/atproto/draft.test.ts` / `tests/pages/v2/bsky/drafts.test.ts` に `posts` 配列の分岐網羅テストを追加する。

## Phase 3: 既存フロントエンド試作の整理 【本セッションで完了】

- [x] クリエイターモード設計書（FR5）を叩き台に一度実装した`ThreadComposer`及び`PostForm`へのスレッド対応組み込み一式を、コミットせずに`git stash`（メッセージ:「スレッド投稿フロントエンド試作(参考用に退避、破棄予定)」）へ退避する。
- [x] 退避後、バックエンド（Phase 1・2）のみが作業ツリーに残っていることを確認する。
- [x] `npx vitest run` を実行し、フロントエンド試作を取り除いた状態でも全テストがパスすることを確認する（513件パス確認済み）。
- [ ] 退避したstashについて、次セッションでの設計完了後、参考として不要と判断した時点で`git stash drop`する（本タスク一覧の範囲外・次セッション以降の判断）。

## Phase 4: ドキュメント整備 【本セッションで完了】

- [x] `specs/creator-mode`からスレッド投稿（FR5）に関する要件・設計記述を抽出し、`specs/threadpost/requirements.md`・`design.md`として独立させる。
- [x] 実装済みのバックエンド部分（reply対応・スレッド下書き対応）を「実装済み」として設計書に反映する。
- [x] 破棄したフロントエンド実装の問題点を、次回設計時の反面教師として設計書に記録する。

## Phase 5: フロントエンド要件確定・設計（次セッション） 【未着手】

依存: Phase 1〜4完了後

- [ ] スレッド投稿の起動導線（既存PostFormの拡張か、専用画面か等）を再検討し要件として確定する。
- [ ] 各セグメントの視覚的な並べ方（見栄え）を要件定義段階で先に固める。
- [ ] `PostForm`本体を汚染しないセグメント表現方式を設計する（design.md 4.2の検討課題を参照）。
- [ ] スレッド投稿とクリエイターモード（EditorToolbox、`specs/creator-mode`）の関係性を整理する。
- [ ] スレッド下書き（Phase 2で実装済みの`posts`配列API）とフロントエンドの状態管理の対応方法を設計する。
- [ ] 上記を反映して `specs/threadpost/requirements.md` ・ `design.md` を更新し、本タスク一覧にフロントエンド実装フェーズを追記する。

## Phase 6: フロントエンド実装（次セッション以降・Phase 5完了後） 【未着手】

- [ ] Phase 5の設計に基づき、スレッド投稿UIを実装する。
- [ ] `npm run codegen` を実行し、`reply`を含む型でフロントエンドを実装する。
- [ ] 手動確認: 3件以上のセグメントを作成し、順に投稿してBluesky上で正しいスレッドとして表示されることを確認する。
- [ ] 手動確認: 既存の`/`（Timeline）・既存PostFormの投稿導線にregressionがないことを確認する。
- [ ] `[TEST]` 全体の `npx vitest run` を実行し、既存テストを含めてすべてパスすることを確認する。
