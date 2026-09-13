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

## Phase 5: フロントエンド要件確定・設計 【完了】

依存: Phase 1〜4完了後

- [x] スレッド投稿の起動導線を「既存`PostForm`の拡張（専用画面は設けない）」に確定する。
- [x] スレッド投稿とクリエイターモード（EditorToolbox、`specs/creator-mode`）の関係性を「独立機能」に確定する。
- [x] スレッド全体の送信方式を「1リクエストにまとめる」に確定する。
- [x] `PostForm`本体を汚染しないセグメント表現方式（`ThreadComposer`/`ThreadSegmentForm`、共通入力プリミティブの切り出し）を設計する。
- [x] スレッド下書き（Phase 2で実装済みの`posts`配列API）とフロントエンドの状態管理の対応方法（`segments`配列を`posts`配列にそのままマッピング）を設計する。
- [x] 画像付きセグメントの扱い（セグメントごとに既存の画像圧縮・OGP合成パイプラインを独立適用）を設計する。
- [x] 上記を反映して `specs/threadpost/requirements.md` ・ `design.md` を更新する。
- [x] `.claude/skills/spec-driven-development/SKILL.md` の仕様書レビューチェックリストに基づき、本ディレクトリの3ファイルをセルフレビューする。

## Phase 6: フロントエンド実装（Phase 5完了後） 【完了】

- [x] `ThreadComposer`・`ThreadSegmentForm`を実装する（design.md §4.1）。`src/components/post/PostForm/`を`src/components/post/ThreadComposer/`へリネームし、単発投稿専用だった状態管理を`segments`配列 + `activeIndex`へ一般化した（design.md §4.1に記載の通り、当初想定していた「`PostForm`と`ThreadComposer`の併存」ではなく、`PostForm`を`ThreadComposer`へ一般化する方式に変更した）。
- [x] 既存の入力プリミティブ（`ImagePicker`・`OgpFetchButton`・`PostGateDialog`・`SelfLabelsSelect`・`LanguageSelect`・`useSuggest`・`useKeyboardRows`・`PostBodyEditor`等）をセグメント単位で個別にインスタンス化する形で`ThreadSegmentForm`から利用できるようにした。
- [x] セグメントの追加・削除、`activeIndex`の切り替え、非アクティブセグメントのグレーアウト表示を実装する（requirements.md §6.3の受け入れ条件に対応）。削除ルール（先頭segmentは削除不可）を確定・実装した。
- [x] スレッド全体を1回の`POST /v2/entry`にまとめて送信する処理を実装する（design.md §4.3、`submitThread.ts`）。画像投稿segmentのentry作成方針（先頭を自動選択、requirements.md §5）はPhase 7で仕様確定・実装した。
- [x] スレッド全体の下書き保存・復元を実装する（design.md §4.4、`segments.ts`の`segmentsToDraftPosts`/`draftPostsToSegments`）。
- [x] クロスポスト（自動ポップアップ・WebShareAPI）は先頭segmentのみを対象とする方針を決定・実装した（design.md §4.3に追記）。
- [x] `[TEST]` `ThreadComposer`/`ThreadSegmentForm`のセグメント追加・削除・`posts`配列への変換ロジックの単体テストを追加する（`tests/components/post/ThreadComposer/segments.test.ts`・`submitThread.test.ts`）。
- [x] `npx tsc --noEmit`・`npx vitest run`（531件）が全件成功することを確認した。
- [ ] 手動確認: 実際のBlueskyアカウントで3件以上のセグメントを作成し、順に投稿してBluesky上で正しいスレッドとして表示されることを確認する（要ログイン、次回セッション以降または利用者による確認が必要）。
- [ ] 手動確認: 既存の`/`（Timeline）・投稿フォームの投稿導線にregressionがないことを確認する（要ログイン、次回セッション以降または利用者による確認が必要）。

## Phase 7: 実運用で見つかった不具合の修正（entry作成先・画像プレビュー永続化） 【完了】

Phase 6実装後、実際にスレッド投稿を試したところ2件の不具合が見つかり、仕様の見直しとあわせて修正した。

- [x] 画像投稿segmentが複数あるスレッドで、entryのsourceが常にそのsegment自身を指す（スレッド先頭を代表させるthreadRoot方式が未実装だった）問題を調査し、`specs/entry/backend`・`specs/entry/frontend`が既に設計していた`entrySource: "threadRoot"`方式を採用することを確定した（requirements.md §5を更新）。
- [x] `[BE]` `entrySource`フィールド・source解決ロジックを実装した（`specs/entry/backend/tasks.md` Phase 1）。
- [x] `[FE]` `submitThread.ts`を、画像投稿segmentが2件以上ある場合は先頭のみを自動選択してentryを作成し、スレッドでは`entrySource: "threadRoot"`を明示送信するよう変更した（`specs/entry/frontend/tasks.md` Phase 1）。
- [x] UIバグ: `ThreadSegmentForm`が`isActive`でJSXを丸ごと出し分けていたため、非アクティブ化のたびに`ImagePicker`がアンマウントされ、画像プレビューが消えて見える不具合を修正した。フル編集UIブロック・簡略表示ブロックの両方を常時マウントし`hidden`属性で切り替える方式に変更した（design.md §4.1）。
- [x] 非アクティブなsegmentに画像が添付されている場合、読み取り専用のサムネイルプレビュー（`ImageEntry.thumbnailPreview`）を表示するようにした（requirements.md §6.3）。
- [x] `[TEST]` `tests/lib/entry/createBskyThread.test.ts`（新規）・`tests/lib/entry/fromPost.test.ts`・`tests/pages/v2/entry.test.ts`に`entrySource`関連のテストを追加した。
- [x] `[TEST]` `tests/components/post/ThreadComposer/submitThread.test.ts`を先頭自動選択の挙動に合わせて更新した。
- [x] `[TEST]` Playwrightを導入し（`.claude/skills/spec-driven-development/SKILL.md`のUI実装検証方針に基づく）、`tests/e2e/threadComposer.spec.ts`でセグメント追加・画像添付・非アクティブ化からの再アクティブ化・削除ルールをヘッドレスブラウザで検証した（`npm run test:e2e`）。
- [x] `npx tsc --noEmit`・`npx vitest run`・`npx playwright test`が全件成功することを確認した。
- [ ] 手動確認: 実際のBlueskyアカウントで、画像投稿segmentを2件以上含むスレッドを投稿し、entryが1件のみ作成されそのsourceがスレッド先頭を指すことを確認する（要ログイン、次回セッション以降または利用者による確認が必要）。

## Phase 8: レスポンス形状の見直し（`entrySource`方式からトップレベル`createEntry`/`visual`方式への置き換え）

Phase 7で採用した`entrySource: "threadRoot"`方式は、`posts[i]`ごとにentryを個別指定できる汎用性を残したままレスポンスも`posts[i].skyshareEntry`に埋め込んでいたため、スレッド先頭以外のsegmentがvisual元になった場合にレスポンス構造がわかりにくい問題があった。この節で、entry作成をリクエスト全体につき1回（トップレベルの`createEntry`+`visual`）に統一し、レスポンスの`skyshareEntry`もトップレベルへ移す再設計を行う。詳細は各specの該当tasks.mdを参照。

- [x] `[BE]` `entrySource`フィールドの廃止、`createEntry`/`visual`のトップレベル化（[specs/entry/backend/tasks.md](../entry/backend/tasks.md) Phase 1）。
- [x] `[FE]` `submitThread.ts`の送信内容をトップレベル形式へ移行（[specs/entry/frontend/tasks.md](../entry/frontend/tasks.md) Phase 1）。
- [x] 上記完了後、本書（requirements.md §5・design.md §2.1・§4.5）の記述と実装が一致していることを確認した（`entrySource`関連の記述は残存していないことを確認済み）。
