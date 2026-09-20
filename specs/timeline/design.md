# Timeline コンポーネント 設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

対象ファイル:

- バックエンド: [src/pages/v2/entries.ts](../../src/pages/v2/entries.ts)、[src/lib/entry/posts.ts](../../src/lib/entry/posts.ts)、[src/lib/entry/timelineThreads.ts](../../src/lib/entry/timelineThreads.ts)
- フロントエンド: [src/components/post/Timeline/index.tsx](../../src/components/post/Timeline/index.tsx)、[src/components/post/PostCard/](../../src/components/post/PostCard/)、[src/components/post/ThreadCard/](../../src/components/post/ThreadCard/)

## 1. 設計方針

`GET /v2/entries`は、フラットな投稿一覧ではなく、**バックエンドが権威的に解決・グルーピング済みのメインスレッド構造（`threads: ThreadGroup[]`）**を返す（NFR-4）。フロントエンドは、受け取った`threads`をそのまま描画するだけであり、reply chainの再構築（どの投稿とどの投稿が同一スレッドか、どちらがメインスレッドか）は一切行わない。この「表示用の構造判定はサーバの責務」という方針は変えないが、「entryを作成してよいか・どの投稿をsourceにするか」という判断は、この構造判定とは別の関心事としてクライアントの責務に切り出す（[specs/entry/backend/requirements.md](../entry/backend/requirements.md)、5節参照）。サーバ側にスレッド構造判定と作成可否判定の両方を持たせず、後者をクライアントへ切り出すことで、将来クライアント側でentry作成の挙動を拡張する際の自由度を確保する。

レスポンスに含まれるのは自分起点スレッド（プロトコルルートが自分自身の投稿であるスレッド）のメインスレッド（分岐点ごとに投稿日時が最も近い側を採用して選ばれる、唯一の直線的投稿列）のみである。他者起点スレッド（自分の投稿が他人の投稿への返信から始まっている場合）、およびメインスレッドの選出で採用されなかったサブスレッドは、レスポンスに一切含めない（[requirements.md FR-1](requirements.md#fr-1-メインスレッドのグルーピング表示)）。

グルーピングの根拠には、Bluesky側が各投稿に付与する`replyCount`（返信件数）と、投稿レコード自体が持つ`record.reply`（`app.bsky.feed.post#replyRef`、常に存在するStrongRef）を用いる。これにより、`app.bsky.feed.getAuthorFeed`が自分自身のスレッドを構成する投稿の一部（中間・後続を問わず任意件数）を一覧レスポンスから欠落させる場合（既知のAppView側の挙動）でも、`app.bsky.feed.getPostThread`で該当スレッドを直接・権威的に取得し直すことで、欠落の程度によらず正しいスレッド構造を構築できる（NFR-3）。他者起点スレッドの判定（`record.reply.root`が指す投稿のDID比較）は、AT URI（`at://<did>/...`）自体にDIDが埋め込まれているため、追加のAPI呼び出しなしに行える。

`PostCard`（[src/components/post/PostCard/index.tsx](../../src/components/post/PostCard/index.tsx)）は1投稿単位の描画・entry作成/削除の状態機械（`useSkyshareEntryStatus.ts`）を持つ既存コンポーネントであり、本設計でも変更せず再利用する。`ThreadCard`（[src/components/post/ThreadCard/index.tsx](../../src/components/post/ThreadCard/index.tsx)）が`ThreadGroup`単位で`PostCard`を複数回インスタンス化して描画する構成も維持する。

## 2. バックエンド: `GET /v2/entries`のスレッド構造化

### 2.1 型定義

```ts
// src/lib/entry/posts.ts
export type TimelinePost = {
  uri: string
  cid: string
  url: string
  indexedAt: string
  author: TimelinePostAuthor
  text: string
  images: SourceImage[]
  skyshareEntry?: TimelineSkyshareEntry
  // reply chain由来のフィールド（replyParentUri/replyRootUri）は持たない。
  // スレッド構造はTimelinePost単体ではなくThreadGroupという形で表現するため。
}

export type ThreadGroup = {
  rootPost: TimelinePost
  replies: TimelinePost[] // 古い→新しい順。0件なら単独投稿
}
```

`ThreadGroup`は、フロントエンド専用ファイル（旧`src/components/post/Timeline/threadGroup.ts`）ではなく、バックエンド・フロントエンド双方が参照する`src/lib/entry/posts.ts`に定義する（レスポンスの型そのものであるため）。`rootPost.uri`をそのままキー・React `key`として使う。

### 2.2 `src/lib/atproto/threadChain.ts`

```ts
/**
 * 投稿レコード自体（record.reply、app.bsky.feed.post#replyRef のStrongRef）から
 * スレッド先頭(root)投稿のuriを取り出す。FeedViewPost.reply（AppViewによる
 * enriched view、NotFoundPost/BlockedPost型で欠落しうる）には依存しない。
 * 返信でない投稿はundefined。
 */
export const extractReplyRootUri = (
  post: AppBskyFeedDefs.PostView,
): string | undefined =>
  (post.record as AppBskyFeedPost.Main | undefined)?.reply?.root?.uri

/**
 * AT URI（at://<did-or-handle>/collection/rkey）から authority 部分（DID）を
 * 取り出す。record.reply.root/parent のStrongRef.uriは常にDID形式で記録される
 * ため、追加のAPI呼び出しなしに「このuriの投稿は誰が所有するrepoか」を判定できる。
 * 他者起点スレッドの除外判定（2.3節）に用いる。
 */
export const extractRepoDidFromAtUri = (uri: string): string | undefined =>
  uri.match(/^at:\/\/([^/]+)/)?.[1]
```

`extractOwnedLinearReplyChain`（entry削除カスケード・entry詳細ページのスレッド表示と共有、`specs/entry/backend/design.md §7.3.1`）は、スレッドが途中で分岐する場合（同一投稿への自己返信が複数存在する場合）の選択ロジックを持つ。これがメインスレッドの選出規則そのものである:

- 起点（`threadView`自身）が`ownerDid`の投稿でない場合、空配列を返す（自分が他人のスレッドに返信したケースの防御。2.3節のDID事前フィルタにより、実際にはこの分岐に到達する呼び出しは発生しない）。
- 各ノードの`replies`のうち`author.did === ownerDid`一致する候補をすべて集める。
  - 候補が0件なら打ち切る。
  - 候補が1件なら、`record.createdAt`の近さを問わずそのまま採用する（既存の古い投稿へ事後で新規スレッドを継ぎ足す正当な機能があり、継ぎ足し元との時刻差は無関係のため）。
  - 候補が2件以上（実在する分岐）の場合のみ、親ノードの`record.createdAt`との差の絶対値が最小の候補を採用する（`createBskyThread.ts`が1回の`applyWrites`内で`createdAt`を連続採番するため、同一操作で作られた投稿群は時刻が近接する、という性質を利用したtie-break）。同値の場合は`replies`の出現順で先勝ちする。
- 採用されなかった側の候補（サブスレッド）は破棄する。分岐先を新たなセグメントの起点として列挙するような処理は持たない（Timelineは採用された1系統＝メインスレッドのみを表示するため、不採用側を後から参照する必要が無い）。

`via`（Skyshare発かどうか）は判定に使わない（既存の古い投稿への事後継ぎ足しでは、継ぎ足し元がSkyshare発である保証が無いため）。

### 2.3 `src/lib/entry/timelineThreads.ts`（新規）

`buildTimelineThreads`が、`fetchOwnAuthorFeed`の生の`FeedViewPost[]`から`ThreadGroup[]`を構築する。処理フロー:

```ts
export const buildTimelineThreads = async (
  agent: AtpAgent,
  did: string,
  feed: AppBskyFeedDefs.FeedViewPost[],
  entriesBySourceUri: Map<string, TimelineSkyshareEntry>,
): Promise<ThreadGroup[]> => {
  // 1. フラット正規化。feedの出現順（indexedAt降順）を保持しつつ、各投稿の
  //    プロトコルルートuri（record.reply.rootが無ければ自分自身）を併記する。
  //    プロトコルルートのDIDが自分自身でない投稿（他者起点スレッド）は、
  //    この時点でrootsNeedingResolutionに加えず、権威解決の対象にもしない
  //    （無駄なgetPostThread呼び出しを避ける）。
  type Entry = { post: TimelinePost; protocolRootUri: string }
  const normalizedByUri = new Map<string, Entry>()
  const order: string[] = []
  const rootsNeedingResolution = new Set<string>()

  for (const item of feed) {
    const normalized = normalizeTimelinePost(
      item,
      typeof item?.post?.uri === "string"
        ? entriesBySourceUri.get(item.post.uri)
        : undefined,
    )
    if (!normalized) continue
    const protocolRootUri = extractReplyRootUri(item.post) ?? normalized.uri
    normalizedByUri.set(normalized.uri, { post: normalized, protocolRootUri })
    order.push(normalized.uri)

    if (extractRepoDidFromAtUri(protocolRootUri) !== did) continue // 他者起点スレッド：解決不要
    const hasReplies = (item.post?.replyCount ?? 0) > 0
    const isReply = protocolRootUri !== normalized.uri
    if (hasReplies || isReply) rootsNeedingResolution.add(protocolRootUri)
  }

  // 2. 自分起点のプロトコルroot単位で、getPostThread + extractOwnedLinearReplyChain
  //    により権威的にメインスレッド（採用された1系統のみ）を解決する。root同士は
  //    独立なのでPromise.allで並行実行する。1件の失敗が他のrootに影響しないよう
  //    root単位でtry/catchする。
  type Resolved = { rootPost: TimelinePost; repliesByUri: Map<string, TimelinePost> }
  const resolvedThreads = new Map<string, Resolved>()

  await Promise.all(
    [...rootsNeedingResolution].map(async rootUri => {
      try {
        const threadRes = await agent.app.bsky.feed.getPostThread({
          uri: rootUri,
          depth: MAX_THREAD_POST_COUNT,
        })
        if (!AppBskyFeedDefs.isThreadViewPost(threadRes.data.thread)) return

        const chain = extractOwnedLinearReplyChain(
          threadRes.data.thread,
          did,
          MAX_THREAD_POST_COUNT,
        )
        if (chain.length === 0) return // 通常発生しない（rootsNeedingResolutionは自分起点のみ）フェイルセーフ

        const rootPost = normalizePostViewToTimelinePost(
          chain[0],
          entriesBySourceUri.get(chain[0].uri),
        )
        if (!rootPost) return

        const repliesByUri = new Map<string, TimelinePost>()
        for (const post of chain.slice(1)) {
          const normalized = normalizePostViewToTimelinePost(
            post,
            entriesBySourceUri.get(post.uri),
          )
          if (normalized) repliesByUri.set(normalized.uri, normalized)
        }
        resolvedThreads.set(rootUri, { rootPost, repliesByUri })
      } catch (err) {
        console.error(
          "timelineThreads.ts: failed to resolve thread",
          rootUri,
          err,
        )
      }
    }),
  )

  // 3. 解決済みメインスレッドのrootが、getAuthorFeedのfeed（＝order）に1件も
  //    現れない場合がある（rootの投稿自体がAppViewの一覧取得から欠落し、
  //    そのrootへの返信だけがfeedに残っているケース。NFR-3対応）。rootの
  //    indexedAtを用いて、新しい順（降順）を保ったままorderへ挿入する。
  const insertedRoots = new Set<string>()
  for (const [rootUri, resolved] of resolvedThreads) {
    if (normalizedByUri.has(rootUri) || insertedRoots.has(rootUri)) continue
    insertedRoots.add(rootUri)
    normalizedByUri.set(rootUri, {
      post: resolved.rootPost,
      protocolRootUri: rootUri,
    })
    const insertAt = order.findIndex(uri => {
      const existing = normalizedByUri.get(uri)!.post
      return (
        new Date(existing.indexedAt).getTime() <
        new Date(resolved.rootPost.indexedAt).getTime()
      )
    })
    if (insertAt === -1) order.push(rootUri)
    else order.splice(insertAt, 0, rootUri)
  }

  // 4. orderを走査してThreadGroup[]を組み立てる。
  const threads: ThreadGroup[] = []
  const emittedRoots = new Set<string>()
  for (const uri of order) {
    const entry = normalizedByUri.get(uri)!
    if (extractRepoDidFromAtUri(entry.protocolRootUri) !== did) continue // 他者起点スレッド：非表示

    const resolved = resolvedThreads.get(entry.protocolRootUri)
    if (
      resolved &&
      (resolved.rootPost.uri === uri || resolved.repliesByUri.has(uri))
    ) {
      if (emittedRoots.has(entry.protocolRootUri)) continue
      emittedRoots.add(entry.protocolRootUri)
      const replies = [...resolved.repliesByUri.values()].sort(
        (a, b) =>
          new Date(a.indexedAt).getTime() - new Date(b.indexedAt).getTime(),
      )
      threads.push({ rootPost: resolved.rootPost, replies })
      continue
    }

    if (entry.protocolRootUri === uri) {
      // フォールバック: 自分自身がプロトコルルートなのに解決済みチェーンに
      // 含まれない（getPostThread失敗等）場合、単独投稿として表示する
      // （欠落より過表示の方が実害が小さいため）。
      threads.push({ rootPost: entry.post, replies: [] })
    }
    // それ以外（自分起点スレッドの一部だが、メインスレッドの選出で採用され
    // なかった側＝サブスレッド）はTimelineに一切表示しない（FR-1）。
  }

  return threads
}
```

- `extractOwnedReplySegments`のような、不採用の分岐先を新たなセグメントとして列挙する処理は持たない。サブスレッドはTimelineに表示しないため、その構造を保持・列挙する必要自体が無い（旧設計からの単純化）。
- メインスレッドの構成が変化した場合（例: メインスレッドの分岐選択に関わる投稿が削除された）の再評価は、状態を一切保持せず、`GET /v2/entries`が呼ばれるたびに`getPostThread`＋`extractOwnedLinearReplyChain`を実行し直すことで自然に実現される。前回メインスレッドとして選出されていた投稿が無くなれば、その時点で残っている候補から`extractOwnedLinearReplyChain`が改めて1系統を選び直す（[requirements.md FR-1](requirements.md#fr-1-メインスレッドのグルーピング表示)の動的再評価）。

`src/lib/entry/posts.ts`の変更点:

- `normalizeTimelinePost`から`FeedViewPost.reply`（enriched view）を読む処理を削除する（`replyParentUri`/`replyRootUri`の設定を廃止）。
- `normalizeBackfilledThreadPost`を`normalizePostViewToTimelinePost`にリネームする。「`getPostThread`が返す`PostView`を`TimelinePost`に変換する」汎用関数として、root・repliesの両方に使う（実装内容は変更なし、名称と用途の一般化のみ）。

### 2.4 `src/pages/v2/entries.ts`の変更

`backfillMissingThreadPosts`を削除し、`buildTimelineThreads`の呼び出しに置き換える。

```ts
const [feedRes, rawEntries] = await Promise.all([
  fetchOwnAuthorFeed(agent, session.did, limit, cursor),
  listAllRecords(agent, { repo: session.did, collection: ENTRY_COLLECTION }),
])

const entriesBySourceUri = groupTimelineEntriesBySourceUri(rawEntries)
const threads = await buildTimelineThreads(
  agent,
  session.did,
  feedRes.feed,
  entriesBySourceUri,
)

return new Response(JSON.stringify({ cursor: feedRes.cursor, threads }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
})
```

`fetchOwnAuthorFeed`・`MAX_AUTHOR_FEED_PAGES`は無変更。

### 2.5 `src/lib/api/schema/v2/entries/get.ts`

```ts
const TimelinePostSchema = z
  .object({
    uri: z.string(),
    cid: z.string(),
    url: z.string(),
    indexedAt: z.string(),
    text: z.string(),
    author: z
      .object({
        did: z.string(),
        handle: z.string(),
        displayName: z.string().optional(),
        avatar: z.string().optional(),
      })
      .strict(),
    images: z.array(
      z.object({ url: z.string(), alt: z.string(), cid: z.string() }).strict(),
    ),
    skyshareEntry: z
      .object({
        uri: z.string(),
        cid: z.string(),
        createdAt: z.string(),
        sourceUri: z.string(),
        sourceCid: z.string(),
        heading: z.string().optional(),
        caption: z.string().optional(),
        visualUrl: z.string().optional(),
        webUrl: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const ResponseBody200Schema = z
  .object({
    cursor: z.string().optional(),
    threads: z.array(
      z
        .object({
          rootPost: TimelinePostSchema,
          replies: z.array(TimelinePostSchema),
        })
        .strict(),
    ),
  })
  .strict()
```

`replyParentUri`/`replyRootUri`フィールドは持たない。`npm run codegen`で`orval`生成クライアント（`.gitignore`対象、コミット不要）を再生成する。

### 2.6 影響ファイル

- [src/lib/entry/posts.ts](../../src/lib/entry/posts.ts)（`TimelinePost`型・`ThreadGroup`型・`normalizeTimelinePost`・`normalizePostViewToTimelinePost`）
- [src/lib/entry/timelineThreads.ts](../../src/lib/entry/timelineThreads.ts)（`buildTimelineThreads`。他者起点スレッドの除外・サブスレッド非表示への対応）
- [src/lib/atproto/threadChain.ts](../../src/lib/atproto/threadChain.ts)（`extractReplyRootUri`・`extractRepoDidFromAtUri`の追加。`extractOwnedReplySegments`は導入しない）
- [src/pages/v2/entries.ts](../../src/pages/v2/entries.ts)（`buildTimelineThreads`呼び出し）
- [src/lib/api/schema/v2/entries/get.ts](../../src/lib/api/schema/v2/entries/get.ts)（`ResponseBody200Schema`のスレッド構造化）

## 3. フロントエンド: `Timeline`本体の変更

クライアント側のreply chain再構築は行わない（NFR-4）。

`src/components/post/Timeline/index.tsx`:

```tsx
import type { ThreadGroup } from "@/lib/entry/posts"

const fetchPage = useCallback(
  async ({ cursor, limit }): Promise<CursorPageFetchResult<ThreadGroup>> => {
    if (isGuestModeRequested() && isSessionKnownUnauthenticated()) {
      setGuestMode(true)
      return { items: GUEST_DUMMY_THREADS } // 3.2節
    }
    const res = await getEntries(cursor ? { limit, cursor } : { limit })
    if (res.status === 200) {
      const threads = res.data.threads ?? []
      const nextAvatarUrl = threads
        .flatMap(t => [t.rootPost, ...t.replies])
        .find(post => typeof post.author?.avatar === "string" && post.author.avatar !== "")
        ?.author.avatar
      if (nextAvatarUrl) setResolvedAvatarUrl(nextAvatarUrl)
      return { items: threads, nextCursor: res.data.cursor }
    }
    // ...401/その他エラー分岐は変更なし
  },
  [],
)

<ComponentList
  itemComponent={ThreadCard}
  getItemKey={thread => thread.rootPost.uri}
  getItemProps={thread => ({ group: thread, onPostDeleted: removeItem, guestMode })}
  items={items}
/>
```

`countHashtagUsage`向けのテキスト収集（ハッシュタグ履歴のseed処理）は`items.flatMap(t => [t.rootPost, ...t.replies]).map(p => p.text)`を用いる。`CursorPageFetchResult<ThreadGroup>`/`useCursorPaginationController<ThreadGroup>`/`useInfiniteScrollController<ThreadGroup>`という型引数を使う。

### 3.1 `ThreadCard`・`entryCandidate.ts`

`ThreadGroup`は`@/lib/entry/posts`からimportする。

### 3.2 `src/lib/entry/guestDummyPosts.ts`

既存`GUEST_DUMMY_POSTS: TimelinePost[]`（entry詳細ページのサンプル表示等、他の参照箇所があるため維持）に加え、`GUEST_DUMMY_THREADS: ThreadGroup[]`を持つ。既存のスレッドA/B/C用ダミー投稿（`guest-thread-a-*`等）を`{ rootPost, replies }`形にネストして手書きする。`Timeline/index.tsx`のゲストモード分岐は`GUEST_DUMMY_THREADS`を返す。

## 4. 削除操作と一覧除去範囲（NFR-5対応）

`items`（`ComponentList`が保持するページング対象）が`ThreadGroup[]`そのものであるため、「一覧から何を取り除くか」の単位は常に**スレッドグループ全体**になる。

- `useSkyshareEntryStatus.ts`の`options.onPostDeleted`は`() => void`。`deleteBskyPost`成功時（`deleteBskyThread`の有無を問わず）呼び出す。
- `PostCard`の`onPostDeleted` propも`() => void`。
- `ThreadCard`の`onPostDeleted`コールバックは常に次の1行: `onPostDeleted={() => onPostDeleted(g => g.rootPost.uri === group.rootPost.uri)}`（root・replies双方の`PostCard`から同一のコールバックを渡せる）。

**表示上の挙動（NFR-5）**: ルート投稿に対するいずれの削除操作（「リンク・Bluesky投稿を削除」「リンク・スレッド全体を削除」）が成功しても、そのスレッドグループ全体（ルート＋現在表示中の全返信）が一覧から除去される。「リンク・スレッド全体を削除」ではなくルート投稿単体を削除した場合、Bluesky上には後続投稿がなお存在しうるが、それらは次回の一覧再取得時に`buildTimelineThreads`が新たな独立したスレッド（新しいroot）として改めて解決し、表示する。現在表示中のページ内で即座に「新しいrootへ昇格して表示し直す」というクライアント側の再構成は行わない（NFR-4「フロントエンドは独自にreply chainを再構築しない」という方針に一致させるための、意図的な単純化）。

## 5. 事後entry作成ボタンの表示条件とsourceの明示送信（FR-3対応）

ボタンは常にルート投稿のカードにのみ表示する（中間投稿のカードに表示することはない）。ボタンの表示可否とVisual（カバー画像）の生成元は、ルート投稿自身の画像だけでなく、スレッド内のreplies（後続投稿）の画像も対象にする。「ボタンの表示位置」（常にルート）と「Visualの取得元投稿」（ルート自身、またはルートに最も近い画像付きreply）を分離して扱う点は従来通りだが、**APIへ送信する`source`（`uri`）は、Visual取得元投稿とは独立して常にルート投稿のuriにする**（backend design.md §7.1がサーバ側のreply chain自動解決を撤廃したことに伴う変更）。

```ts
// src/components/post/ThreadCard/entryCandidate.ts
export const resolveEntryVisualSourcePost = (
  group: ThreadGroup,
): TimelinePost | null => {
  if (group.replies.length === 0) return null
  if (group.rootPost.skyshareEntry) return null
  if (group.rootPost.images.length > 0) return group.rootPost
  return group.replies.find(post => post.images.length > 0) ?? null
}
```

判定はルート投稿自身が持つ`skyshareEntry`の有無のみで行い、`group.replies`側のentryの有無は見ない（[requirements.md FR-3](requirements.md#fr-3-事後entry作成クライアントが作成可否作成範囲を判断する)）。本機能の実装前に、スレッド中間の投稿を対象にentryが作成されていたケースでは、ルート投稿自身がentryを持たない限りこの関数はrootPost/repliesを返し、ルート投稿を起点とする新規entry作成が許可される。結果として、後続投稿に紐づく既存entryとルート投稿に紐づく新規entryが同一スレッドグループ内に共存しうるが、これは意図した挙動であり、後続投稿側のentryへの操作（編集・削除）はTimelineの対象外（entry一覧側の既存機能で行う）とすることで一貫性を保つ。

Timelineが渡す`ThreadGroup`は、2.3節の通りバックエンドが権威的に決定したメインスレッドそのものであり、非表示のサブスレッド・他者起点スレッドがここに紛れ込むことは無いため、本節のロジックが「ルート投稿は常に自分起点スレッドのメインスレッド先頭である」という前提を検証し直す必要はない（[requirements.md FR-3](requirements.md#fr-3-事後entry作成クライアントが作成可否作成範囲を判断する)の3条件のうち条件2・3は、条件1を満たす時点で自動的に満たされる）。

`ThreadCard`は、rootの`PostCard`に`postCreateEntryButton={!!entryVisualSourcePost}`・`entryVisualSourcePost={entryVisualSourcePost ?? undefined}`・**`entrySourcePost={group.rootPost}`**を渡す。repliesの`PostCard`には常に`postCreateEntryButton={false}`を渡し、ボタンが中間投稿のカードに表示されることはない。

`entryVisualSourcePost`・`entrySourcePost`はいずれも`src/components/post/PostCard/index.tsx`のprop（`PostCardProps.entryVisualSourcePost?: TimelinePost`・`PostCardProps.entrySourcePost?: TimelinePost`）として受け取り、`useSkyshareEntryStatus(item, { ..., visualSourcePost: entryVisualSourcePost, sourcePost: entrySourcePost })`へそのまま渡す。フック内の役割分担:

- `const visualSource = options.visualSourcePost ?? item`: `hasImages`判定（ボタンの活性状態）・`createEntryFromPost`内の画像取得（`GET /v2/bsky/images`）・combine処理（`createDefaultThumbnail`、単独投稿の事後entry作成と同一ロジック）に使う。
- `const source = options.sourcePost ?? item`: APIへ送信する`uri`（entryの`source`になる投稿）に使う。単独投稿（`PostCard`が`ThreadCard`を介さず直接使われる場合）は`sourcePost`を渡されないため`item`（投稿自身）にフォールバックし、既存の単発投稿からのentry作成の挙動と変わらない。

`entryVisualSourcePost`がroot以外（＝あるreply）の場合でも、APIに渡す`uri`（`source`）は常に`entrySourcePost`＝`group.rootPost`のuriになる。backend design.md §7.1・§7.2により、サーバはreply chainを辿った`source`の自動解決を行わないため、この明示送信を欠くとVisual元のreplyがそのまま`source`になってしまう。`state`の初期値（`item.skyshareEntry`）・作成後の`sourceUri`等のフォールバックは、そのカード自身の投稿（`item`＝root）のまま変更しない。

## 6. スレッド由来entryの視覚的区別（FR-4対応）

（変更なし）

```ts
export const findEntryCarrier = (group: ThreadGroup): TimelinePost | null => {
  if (group.replies.length === 0) return null
  if (group.rootPost.skyshareEntry) return group.rootPost
  return group.replies.find(post => !!post.skyshareEntry) ?? null
}
```

本機能（FR-3）によって新規に作成されるentryは常にルート投稿（`rootPost`）に紐づく。一方、本機能の実装前に中間投稿を対象に作成されたentryが残存している場合があるため（§5参照）、`rootPost`・`replies`のどちらにも`skyshareEntry`が付きうる。`findEntryCarrier`は`rootPost`側を優先して返すため、両方に付いている場合はルート投稿側のentryが視覚的区別の対象になる。

## 7. リンク・スレッド全体削除（FR-5対応）

`EntryDeleteConfirmDialog`（「Skyshareリンクを削除」「リンク・Bluesky投稿を削除」「リンク・スレッド全体を削除」の3〜4択）は`EntryCard`・`PostCard`の双方で既に実装済み。

### 7.1 判定ロジックの共有化

`resolveThreadDeleteOption`（`src/lib/entry/resolveThreadDeleteOption.ts`、sourceUriを起点に`getPostThread`でreply chainを取得し、entry所有者自身の後続投稿が実在するかを判定する）・entry削除カスケード（`src/pages/v2/entry.ts`のDELETEハンドラ、`deleteBskyThread:true`）は、Timelineのスレッド構造化ロジック（`buildTimelineThreads`）と共通の`extractOwnedLinearReplyChain`（`specs/entry/backend/design.md §7.3.1`、did一致＋時刻近接による分岐選択、2.2節参照）を使う。これにより、「スレッド全体削除」で実際に削除される投稿は、常にそのentryの`source`から続くメインスレッドの投稿のみになり、サブスレッド（分岐で不採用になった側）が誤って削除されることはない。

### 7.2 `useSkyshareEntryStatus`の拡張（`isResolvingThreadOption`/`showThreadOption`）

- 戻り値に`isResolvingThreadOption: boolean`・`showThreadOption: boolean`を持つ。
- `requestDeleteEntry`は非同期処理を内包し、`resolveThreadDeleteOption(entry.sourceUri)`の結果を待ってから`showThreadOption`を確定し、その後`isDeleteDialogOpen`をtrueにする。
- `confirmDeleteEntry`の第2引数`deleteBskyThread?: boolean`を`deleteEntry` API呼び出しへそのまま渡す。
- `options.onPostDeleted`は`() => void`（4節参照）。

### 7.3 `PostCard`の変更

- `isResolvingThreadOption`・`showThreadOption`を`Loading overlay`表示、および`EntryDeleteConfirmDialog`の`showThreadOption`/`onDeleteThread={() => confirmDeleteEntry(true, true)}`propへ渡す。
- `PostCardEntryActions`の`disabled`propに`isResolvingThreadOption`を追加する（`guestMode || isResolvingThreadOption`）。
- `PostCardProps.onPostDeleted`は`() => void`（4節参照）。

### 7.4 `ThreadCard`側の一覧除去（4節に統合済み）

4節の通り、常に`group.rootPost.uri`一致で除去する。
