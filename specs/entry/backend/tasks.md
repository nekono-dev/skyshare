# v2/entry API タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[BE]` バックエンド（skyshareサーバサイド） / `[TEST]` テスト

## 前提: 実装済み

- スレッド投稿数上限（`MAX_THREAD_POST_COUNT`、[src/lib/atproto/post.ts](../../../src/lib/atproto/post.ts)）を`v2/entry`の`posts`配列・`v2/bsky/drafts`の下書き`posts`配列の双方が参照する構成は実装済み（NFR-7対応）。
- レート制限をアプリケーション層で独自に持たない方針（NFR-8対応）は、独自実装を追加しないことそのものが対応であり、追加作業は不要。

## Phase 1: `entrySource`によるsource解決（design.md §7.1〜§7.3対応）

- [ ] `[BE]` `src/lib/api/schema/v2/entry/post.ts`の`EntryPostItemSchema`（3分岐すべて）に`entrySource: z.enum(["self", "threadRoot"]).optional()`を追加する。
- [ ] `[BE]` `src/lib/api/schema/v2/entry/post.ts`の`{uri, ogImage}`分岐（from-post）に同様の`entrySource`を追加する。
- [ ] `[BE]` `src/lib/entry/createBskyThread.ts`に、`entrySource`と各投稿の事前計算済み`uri`/`cid`（`posts[0]`含む）から、`createEntry:true`な投稿ごとの`source`を解決するロジックを実装する（design.md §7.2の解決表通り）。
- [ ] `[BE]` `src/lib/entry/fromPost.ts`のステップ6として、`entrySource`と取得済み`postRecord.reply.root`から`source`を解決するロジックを実装する（design.md §7.3の解決表通り。`root`のrepoが呼び出し者自身と異なる場合は`self`にフォールバック）。
- [ ] `[TEST]` `tests/lib/entry/createBskyThread.test.ts`に、`entrySource`省略時のデフォルト分岐（単発/スレッド）・`"self"`明示・`"threadRoot"`明示のテストを追加する。
- [ ] `[TEST]` `tests/lib/entry/fromPost.test.ts`に、`reply.root`あり（自分自身/他人）・なしの各組み合わせと`entrySource`指定の直積をテストする。
- [ ] `[TEST]` `tests/pages/v2/entry.test.ts`に、requirements.md §5の該当受け入れ条件（`entrySource`関連）を追加する。

## Phase 2: entry削除時のスレッド全体削除（design.md §7.4対応）

- [ ] `[BE]` `src/lib/api/schema/v2/entry/delete.ts`に`deleteBskyThread: z.boolean().optional()`を追加し、`deleteBskyPost`が`true`でないのに`deleteBskyThread: true`のみが指定された場合を`.strict()`＋`superRefine`等で拒否する。
- [ ] `[BE]` 削除対象の後続投稿群を`source.uri`から`app.bsky.feed.getPostThread`で辿って導出するロジックを実装する（design.md §7.4.1）。呼び出し者自身が投稿した直線的なreply chainのみを対象とし、各投稿の所有者（DID）を1件ずつ検証してから削除対象に含める。探索件数の上限に`MAX_THREAD_POST_COUNT`を用いる。
- [ ] `[BE]` `src/pages/v2/entry.ts`のDELETEハンドラに、`deleteBskyThread:true`時の分岐（導出した全投稿を1回の`applyWrites`で削除）を追加する。この削除の失敗はentry削除の成功可否に影響させない（既存の不変条件を維持）。
- [ ] `[TEST]` 削除対象導出ロジックの単体テストを追加する（自己投稿のみの直線的chain抽出、第三者の返信で分岐した先を含めないこと、所有者検証で弾かれるケース）。
- [ ] `[TEST]` `tests/pages/v2/entry.test.ts`に、requirements.md §5の該当受け入れ条件（スレッド全体削除関連）を追加する。

## Phase 3: 仕上げ

- [ ] `npm run codegen`を実行し、`entrySource`・`deleteBskyThread`を含む型でOpenAPIドキュメント・フロントエンド用クライアントを再生成する。
- [ ] `npx vitest run`・`npx tsc --noEmit`が全件成功することを確認する。
