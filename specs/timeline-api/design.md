# タイムラインAPI 設計書

## 1. 構成

| パス                                   | 責務                                 |
| -------------------------------------- | ------------------------------------ |
| `src/pages/v2/entries.ts`              | 一覧の取得のハンドラ                 |
| `src/lib/api/schema/v2/entries/get.ts` | クエリと応答のスキーマ               |
| `src/lib/entry/timelineThreads.ts`     | スレッドグループの構築               |
| `src/lib/entry/posts.ts`               | 投稿の型と変換、entryの突き合わせ    |
| `src/lib/atproto/threadChain.ts`       | 返信の連鎖の抽出と起点・所有者の判定 |

## 2. 設計項目

### D-1: 応答の形式 (FR-9, NFR-1, NFR-2)

```ts
export type TimelinePost = {
  uri: string
  cid: string
  url: string
  indexedAt: string
  author: TimelinePostAuthor
  text: string
  images: SourceImage[]
  skyshareEntry?: TimelineSkyshareEntry // 派生元のURIで突き合わせる
}
export type ThreadGroup = { rootPost: TimelinePost; replies: TimelinePost[] } // replies は古い順。0件は単独の投稿
// 200: { cursor?: string, threads: ThreadGroup[] }
const [feedRes, rawEntries] = await Promise.all([
  fetchOwnAuthorFeed(agent, did, limit, cursor), // 件数が足りなければカーソルをたどる
  listAllRecords(agent, { repo: did, collection: ENTRY_COLLECTION }),
])
const threads = await buildTimelineThreads(
  agent,
  did,
  feedRes.feed,
  groupTimelineEntriesBySourceUri(rawEntries),
)
```

投稿の型は返信の参照を持たず、スレッドの構造は `ThreadGroup` だけで表す。

### D-2: スレッドグループの構築 (FR-1, FR-2, FR-5, FR-6, FR-7, FR-8)

```
1. feed を順に正規化し、protocolRootUri = record.reply.root.uri ?? 自身 を併記する
   extractRepoDidFromAtUri(protocolRootUri) !== did の投稿は解決対象にしない
   replyCount > 0 または返信である投稿の protocolRootUri を解決対象に加える
2. 解決対象の起点ごとに並行して
   getPostThread({ uri: rootUri, depth: MAX_THREAD_POST_COUNT })
   → extractOwnedLinearReplyChain(thread, did, MAX_THREAD_POST_COUNT)
   → normalizePostViewToTimelinePost で起点と後続を変換する（起点ごとに try/catch）
3. 解決した起点が feed に無ければ、起点の indexedAt より古い最初の位置に挿入する
4. 順に走査して ThreadGroup を組み立てる
   他人が起点 → 出力しない
   解決済みのスレッドに含まれる → 起点ごとに1回だけ { rootPost, replies（古い順） } を出力する
   自身が起点で未解決 → { rootPost: 自身, replies: [] }
   それ以外（採用されなかった系統） → 出力しない
```

状態を保存せず、取得のたびに `getPostThread` と抽出をやり直すため、系統の構成が変われば次の取得で選出し直される。

### D-3: 系統の選出 (FR-3, FR-4)

```ts
export const extractOwnedLinearReplyChain = (
  thread: AppBskyFeedDefs.ThreadViewPost, ownerDid: string, maxCount: number,
): AppBskyFeedDefs.PostView[]
export const extractReplyRootUri = (post: AppBskyFeedDefs.PostView): string | undefined
export const extractRepoDidFromAtUri = (uri: string): string | undefined // at://<did>/... の did
```

| 条件                           | 採用                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 起点が `ownerDid` の投稿でない | 空配列                                                                                                       |
| 自分の返信の候補が0件          | 打ち切る                                                                                                     |
| 候補が1件                      | 投稿日時によらず採用する                                                                                     |
| 候補が2件以上                  | 親の `createdAt` との差の絶対値が最小の候補。同値は `replies` の順で先勝ち。`createdAt` の欠けた候補は後回し |
| `maxCount` に到達              | 打ち切る                                                                                                     |

採用しなかった候補の先は列挙しない。

## 3. エラー処理

| 事象                 | 処理                                                     |
| -------------------- | -------------------------------------------------------- |
| `limit` が範囲外     | 400                                                      |
| 未認証               | 401                                                      |
| 一覧の取得の失敗     | `resolveXrpcStatus` で変換したステータス                 |
| スレッドの取得の失敗 | その起点だけ単独の投稿として扱い、他の起点に影響させない |
