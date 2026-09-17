# v2/entry API タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[BE]` バックエンド（skyshareサーバサイド） / `[TEST]` テスト

## 前提: 実装済み

- スレッド投稿数上限（`MAX_THREAD_POST_COUNT`、[src/lib/atproto/post.ts](../../../src/lib/atproto/post.ts)）を`v2/entry`の`posts`配列・`v2/bsky/drafts`の下書き`posts`配列の双方が参照する構成は実装済み（NFR-7対応）。
- レート制限をアプリケーション層で独自に持たない方針（NFR-8対応）は、独自実装を追加しないことそのものが対応であり、追加作業は不要。

## Phase 1: `entrySource`の廃止・`createEntry`/`visual`のトップレベル化（design.md §3.1〜§3.2・§7対応）

前回セッションで実装された`entrySource: "self" | "threadRoot"`（`posts[i]`ごとの個別選択）を、本設計へ置き換える。

- [x] `[BE]` `src/lib/api/schema/v2/entry/post.ts`の`EntryPostItemSchema`（3分岐すべて）から`createEntry`・`entrySource`フィールドを削除する。
- [x] `[BE]` `RequestBodySchema`の新規投稿分岐（`posts`を持つ方）に、トップレベルの`createEntry: z.boolean().optional()`・`visual: imageField.optional()`を追加する。
- [x] `[BE]` `RequestBodySchema`のfrom-post分岐（`{uri, ogImage}`）から`entrySource`を削除し、`ogImage`を`visual`へリネームする。
- [x] `[BE]` `RequestBodyFieldKinds`・`PostItemFieldKinds`（FormData種別マップ）を上記のフィールド移動に合わせて更新する。
- [x] `[BE]` `ResponseBody200Schema`を変更する。`posts[i]`から`skyshareEntry`を削除し、トップレベルに`skyshareEntry: SkyshareEntrySchema.optional()`を追加する。
- [x] `[BE]` `src/pages/v2/entry.ts`のPOSTハンドラを更新する（design.md §3.3）。トップレベル`createEntry:true`の検証（`posts`に画像投稿が1件以上・`visual`必須）をフェーズ5に追加し、`posts[i]`ごとの`createEntry`判定コードを削除する。
- [x] `[BE]` `src/lib/entry/createBskyThread.ts`を更新する（design.md §3.5・§7.2）。entry作成対象の`posts[i]`を選ぶロジックを削除し、`createEntry:true`なら常に`source = posts[0]`・`visual`はリクエストのトップレベル値を使ってentryレコードを1件だけ組み立てるようにする。戻り値の型を`{ posts: [...], skyshareEntry? }`（トップレベル）に変更する。
- [x] `[BE]` `src/lib/entry/fromPost.ts`の`resolveFromPostSource`を、`entrySource`引数を受け取らず常に「`reply.root`があり自分自身のrepoならroot、それ以外は自身」を返すように簡略化する。`ogImage`パラメータ名を`visual`に統一する。
- [x] `[TEST]` `tests/lib/entry/createBskyThread.test.ts`を新設計に合わせて全面更新する（トップレベル`createEntry`・`visual`、`source`が常に`posts[0]`になること、`entrySource`関連テストの削除）。
- [x] `[TEST]` `tests/lib/entry/fromPost.test.ts`を、`entrySource`引数を削除した`resolveFromPostSource`のシグネチャに合わせて更新する。
- [x] `[TEST]` `tests/pages/v2/entry.test.ts`を新しいリクエスト/レスポンス形状に合わせて全面更新する（requirements.md §5の該当受け入れ条件）。
- [x] `[TEST]` `tests/lib/api/schema/entryPost.test.ts`を新しいスキーマ（トップレベル`createEntry`/`visual`、`posts[i]`から除去されたフィールド）に合わせて更新する。

## Phase 2: entry削除時のスレッド全体削除（design.md §7.4対応）

- [x] `[BE]` `src/lib/api/schema/v2/entry/delete.ts`に`deleteBskyThread: z.boolean().optional()`を追加し、`deleteBskyPost`が`true`でないのに`deleteBskyThread: true`のみが指定された場合を`.strict()`＋`superRefine`等で拒否する。
- [x] `[BE]` 削除対象の後続投稿群を`source.uri`から`app.bsky.feed.getPostThread`で辿って導出するロジックを実装する（design.md §7.4.1）。呼び出し者自身が投稿した直線的なreply chainのみを対象とし、各投稿の所有者（DID）を1件ずつ検証してから削除対象に含める。探索件数の上限に`MAX_THREAD_POST_COUNT`を用いる。
- [x] `[BE]` `src/pages/v2/entry.ts`のDELETEハンドラに、`deleteBskyThread:true`時の分岐（導出した全投稿を1回の`applyWrites`で削除）を追加する。この削除の失敗はentry削除の成功可否に影響させない（既存の不変条件を維持）。
- [x] `[TEST]` 削除対象導出ロジックの単体テストを追加する（自己投稿のみの直線的chain抽出、第三者の返信で分岐した先を含めないこと、所有者検証で弾かれるケース）。
- [x] `[TEST]` `tests/pages/v2/entry.test.ts`に、requirements.md §5の該当受け入れ条件（スレッド全体削除関連）を追加する。

## Phase 3: 仕上げ

- [x] `npm run codegen`を実行し、新しいリクエスト/レスポンス形状（トップレベル`createEntry`/`visual`/`skyshareEntry`、`deleteBskyThread`）でOpenAPIドキュメント・フロントエンド用クライアントを再生成する。
- [x] `npx vitest run`・`npx tsc --noEmit`が全件成功することを確認する。

## Phase 4: サーバ側の作成可否判定・source自動解決の撤廃（design.md §3.1〜§3.4・§7対応。requirements.md改訂に伴うspec更新）

背景: サーバがentryの作成対象としての妥当性（画像投稿を含むか）やfrom-postの`source`（`reply.root`を辿った自動解決）を判定・決定していたことが、将来クライアント側でentry作成の挙動を拡張する際の障害になるとの指摘を受け、これらの判定・解決をすべてクライアントの責務に切り出す設計に改訂した（requirements.md FR-1・FR-2、[specs/timeline/requirements.md](../../timeline/requirements.md)）。本Phaseはこの設計変更をコードへ反映する。実装は次回セッション以降で行う。

- [ ] `[BE]` `src/pages/v2/entry.ts`のPOSTハンドラ（フェーズ5）から、トップレベル`createEntry:true`時の「`posts`のいずれかが画像投稿であること」の検証を削除する。`visual`必須の検証のみ残す（design.md §3.3）。
- [ ] `[BE]` `src/lib/entry/fromPost.ts`から、`hasEligibleImage`（対象投稿の画像embed検証）・`resolveFromPostSource`・`isPostOnOwnedRootChain`を削除する。`source`は常に検証済みの`postUri`/`postCid`自身を使う（design.md §3.4・§7.2）。
- [ ] `[TEST]` `tests/lib/entry/fromPost.test.ts`を更新する: 画像を持たない投稿からのentry作成が成功すること、`reply.root`を持つ投稿から作成しても`source`が対象投稿自身のままになること（自動解決されないこと）を確認する。
- [ ] `[TEST]` `tests/pages/v2/entry.test.ts`を更新する: 画像投稿を含まないスレッドで`createEntry:true`が成功すること（`visual`は指定）を確認するケースを追加する。
- [ ] `npx vitest run`・`npx tsc --noEmit`が全件成功することを確認する。
