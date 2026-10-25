/**
 * Timeline一覧（`GET /v2/entries`）が返す投稿一覧を、バックエンド側で権威的に
 * スレッド（`ThreadGroup`）へグルーピングする。
 *
 * 責務と処理概要:
 * - `app.bsky.feed.getAuthorFeed`が自分自身のスレッドを構成する投稿の一部
 *   （中間・後続を問わず任意件数）を一覧レスポンスから欠落させる場合がある
 *   （既知のAppView側の挙動）。この欠落に依存せず正しいスレッド構造を返すため、
 *   `replyCount`や投稿レコード自体の`record.reply`をシグナルに、該当スレッドを
 *   `app.bsky.feed.getPostThread`で直接・権威的に取得し直す（`specs/timeline-api`）。
 * - 表示対象は「自分起点スレッド」（プロトコルルートが自分の投稿）のメインスレッド
 *   （`extractOwnedLinearReplyChain`が選ぶ唯一の直線的投稿列）のみ。他者起点スレッド
 *   （他人の投稿への返信から始まるもの）と、分岐で採用されなかったサブスレッドは
 *   Timelineに一切含めない（FR-1）。状態は保持せず、呼び出しのたびに再評価する。
 * - フロントエンドはこの結果（`ThreadGroup[]`）をそのまま描画するだけでよく、
 *   reply chainの再構築を行わない（NFR-4）。
 * - Workers無料枠のCPU時間を抑えるため、`getAuthorFeed`の結果だけでスレッドの構成を確定
 *   できる場合は`getPostThread`を呼ばない（`buildThreadViewFromPosts`）。skyshare entryの
 *   付与はスレッドの確定後に、表示する投稿の日時の範囲だけを取得して行う
 *   （`resolveEntryRangeStartMs` / `attachSkyshareEntries`）。
 */
import { AppBskyFeedDefs } from "@atproto/api"
import type { Agent } from "@atproto/api"
import {
    buildThreadViewFromPosts,
    extractOwnedLinearReplyChain,
    extractRepoDidFromAtUri,
    extractReplyRootUri,
} from "@/lib/atproto/threadChain"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/threadLimit"
import {
    normalizePostViewToTimelinePost,
    normalizeTimelinePost,
} from "@/lib/entry/posts"
import type {
    ThreadGroup,
    TimelinePost,
    TimelineSkyshareEntry,
} from "@/lib/entry/posts"

/**
 * entryの取得範囲の始点に持たせるマージン（ミリ秒）。
 * entryの`createdAt`は派生元の投稿のindexedAtより前にならないはずだが、端末の時計のずれや
 * 反映の遅れで数秒〜数分前後しうるため、十分に広い1日を取る。
 */
export const ENTRY_RANGE_MARGIN_MS = 24 * 60 * 60 * 1000

/**
 * `feed`（`getAuthorFeed`の生レスポンス）から`ThreadGroup[]`を構築する。
 *
 * 処理の趣旨:
 * 1. 各投稿を正規化し、プロトコルルートuri（`record.reply.root`、無ければ自分自身）を
 *    併記する。ルートが他人のrepoの投稿（他者起点スレッド）は解決対象にしない。
 * 2. 自分起点のルートごとにメインスレッドを解決する。ルートが`feed`にあり、各投稿の
 *    `replyCount`が`feed`内の子の件数と一致するなら、`feed`だけで木を組む（NFR-4）。
 *    確定できないルートは`getPostThread`で取得する（`Promise.all`で並行、1 rootの失敗は
 *    他に影響させない）。どちらも`extractOwnedLinearReplyChain`で系統を選ぶ。
 * 3. 解決済みメインスレッドのルートが`feed`に現れない場合（ルートのみ一覧から欠落）、
 *    ルートのindexedAtに基づいて新しい順を保ったまま挿入する（NFR-3）。
 * 4. `feed`の出現順で`ThreadGroup[]`を組み立てる。他者起点スレッド・サブスレッドは
 *    出力しない。getPostThread失敗時、自分がルートの投稿は単独投稿として表示する
 *    （欠落より過表示の方が実害が小さいため）。
 *
 * Input:
 * - `agent`: 認証済みAtpAgent
 * - `did`: セッション本人のDID
 * - `feed`: `fetchOwnAuthorFeed`が返す自分の投稿のみのFeedViewPost配列
 *
 * Output:
 * - `ThreadGroup[]`。`feed`の出現順（新しい順）を維持する。`skyshareEntry`は付与しない
 *   （`attachSkyshareEntries`で付与する）。
 *
 * Example:
 * - feed=[B(返信, root=A), A] → `[{ rootPost: A, replies: [B] }]`
 */
export const buildTimelineThreads = async (
    agent: Agent,
    did: string,
    feed: AppBskyFeedDefs.FeedViewPost[],
): Promise<ThreadGroup[]> => {
    type Entry = { post: TimelinePost; protocolRootUri: string }
    const feedPostViews = new Map<string, AppBskyFeedDefs.PostView>()
    const normalizedByUri = new Map<string, Entry>()
    const order: string[] = []
    const rootsNeedingResolution = new Set<string>()

    for (const item of feed) {
        const normalized = normalizeTimelinePost(item)
        if (!normalized) continue
        feedPostViews.set(normalized.uri, item.post)
        const protocolRootUri = extractReplyRootUri(item.post) ?? normalized.uri
        normalizedByUri.set(normalized.uri, {
            post: normalized,
            protocolRootUri,
        })
        order.push(normalized.uri)

        // 他者起点スレッドは解決不要（無駄なgetPostThread呼び出しを避ける）
        if (extractRepoDidFromAtUri(protocolRootUri) !== did) continue
        const hasReplies = (item.post.replyCount ?? 0) > 0
        const isReply = protocolRootUri !== normalized.uri
        if (hasReplies || isReply) rootsNeedingResolution.add(protocolRootUri)
    }

    type Resolved = {
        rootPost: TimelinePost
        repliesByUri: Map<string, TimelinePost>
    }
    const resolvedThreads = new Map<string, Resolved>()

    // 解決した系統（起点から順の`PostView`）を`Resolved`へ変換して登録する。
    const registerChain = (
        rootUri: string,
        chain: AppBskyFeedDefs.PostView[],
    ): boolean => {
        // 通常発生しないフェイルセーフ（解決対象は自分起点のみ）
        if (chain.length === 0) return false
        const rootPost = normalizePostViewToTimelinePost(chain[0])
        if (!rootPost) return false

        const repliesByUri = new Map<string, TimelinePost>()
        for (const post of chain.slice(1)) {
            const normalized = normalizePostViewToTimelinePost(post)
            if (normalized) repliesByUri.set(normalized.uri, normalized)
        }
        resolvedThreads.set(rootUri, { rootPost, repliesByUri })
        return true
    }

    // feedだけで構成を確定できるルートはgetPostThreadを省く（NFR-4）。
    const rootsNeedingFetch: string[] = []
    for (const rootUri of rootsNeedingResolution) {
        const view = buildThreadViewFromPosts(rootUri, feedPostViews)
        const chain = view
            ? extractOwnedLinearReplyChain(view, did, MAX_THREAD_POST_COUNT)
            : []
        if (!registerChain(rootUri, chain)) rootsNeedingFetch.push(rootUri)
    }

    await Promise.all(
        rootsNeedingFetch.map(async rootUri => {
            try {
                const threadRes = await agent.app.bsky.feed.getPostThread({
                    uri: rootUri,
                    depth: MAX_THREAD_POST_COUNT,
                })
                if (!AppBskyFeedDefs.isThreadViewPost(threadRes.data.thread)) {
                    return
                }

                registerChain(
                    rootUri,
                    extractOwnedLinearReplyChain(
                        threadRes.data.thread,
                        did,
                        MAX_THREAD_POST_COUNT,
                    ),
                )
            } catch (err) {
                console.error(
                    "timelineThreads.ts: failed to resolve thread",
                    rootUri,
                    err,
                )
            }
        }),
    )

    // ルート自体がfeedから欠落しているメインスレッドを、indexedAt降順を保って挿入する。
    for (const [rootUri, resolved] of resolvedThreads) {
        if (normalizedByUri.has(rootUri)) continue
        normalizedByUri.set(rootUri, {
            post: resolved.rootPost,
            protocolRootUri: rootUri,
        })
        const rootMs = new Date(resolved.rootPost.indexedAt).getTime()
        const insertAt = order.findIndex(
            uri =>
                new Date(normalizedByUri.get(uri)!.post.indexedAt).getTime() <
                rootMs,
        )
        if (insertAt === -1) order.push(rootUri)
        else order.splice(insertAt, 0, rootUri)
    }

    const threads: ThreadGroup[] = []
    const emittedRoots = new Set<string>()
    for (const uri of order) {
        const entry = normalizedByUri.get(uri)!
        // 他者起点スレッド：非表示
        if (extractRepoDidFromAtUri(entry.protocolRootUri) !== did) continue

        const resolved = resolvedThreads.get(entry.protocolRootUri)
        if (
            resolved &&
            (resolved.rootPost.uri === uri || resolved.repliesByUri.has(uri))
        ) {
            if (emittedRoots.has(entry.protocolRootUri)) continue
            emittedRoots.add(entry.protocolRootUri)
            const replies = [...resolved.repliesByUri.values()].sort(
                (a, b) =>
                    new Date(a.indexedAt).getTime() -
                    new Date(b.indexedAt).getTime(),
            )
            threads.push({ rootPost: resolved.rootPost, replies })
            continue
        }

        // フォールバック: 自分がプロトコルルートなのに未解決（getPostThread失敗等）
        if (entry.protocolRootUri === uri) {
            threads.push({ rootPost: entry.post, replies: [] })
        }
        // それ以外（サブスレッド）は表示しない
    }

    return threads
}

/**
 * 確定したスレッドグループに含まれる投稿の日時から、entryを取得する範囲の始点を求める。
 *
 * 処理の趣旨:
 * - entryは派生元の投稿が存在してから作られるため、表示する投稿のいちばん古い
 *   `indexedAt`より前に作られたentryは、表示する投稿のどれにも紐づかない。
 * - 補完で取得した起点が一覧より古い場合も含めるため、`feed`ではなく確定後の
 *   スレッドグループの全投稿（起点と後続）から求める。
 *
 * Input:
 * - `threads`: `buildTimelineThreads`の結果
 *
 * Output:
 * - 最小の`indexedAt`から`ENTRY_RANGE_MARGIN_MS`を引いたエポックミリ秒。
 *   日時の読める投稿が無い場合は`undefined`（entryを取得しない）。
 */
export const resolveEntryRangeStartMs = (
    threads: ThreadGroup[],
): number | undefined => {
    let oldest: number | undefined
    for (const thread of threads) {
        for (const post of [thread.rootPost, ...thread.replies]) {
            const ms = Date.parse(post.indexedAt)
            if (Number.isNaN(ms)) continue
            if (oldest === undefined || ms < oldest) oldest = ms
        }
    }
    return oldest === undefined ? undefined : oldest - ENTRY_RANGE_MARGIN_MS
}

/**
 * スレッドグループの各投稿へ、`source.uri`が一致するskyshare entryを付与する。
 *
 * Input:
 * - `threads`: `buildTimelineThreads`の結果
 * - `entriesBySourceUri`: `source.uri`をキーにしたskyshare entryのMap
 *
 * Output:
 * - 起点と後続の全投稿へ`skyshareEntry`を付けた新しい`ThreadGroup[]`（入力は変更しない）。
 *   一致するentryが無い投稿は`skyshareEntry`を持たない。
 */
export const attachSkyshareEntries = (
    threads: ThreadGroup[],
    entriesBySourceUri: Map<string, TimelineSkyshareEntry>,
): ThreadGroup[] => {
    const attach = (post: TimelinePost): TimelinePost => ({
        ...post,
        skyshareEntry: entriesBySourceUri.get(post.uri),
    })
    return threads.map(thread => ({
        rootPost: attach(thread.rootPost),
        replies: thread.replies.map(reply => attach(reply)),
    }))
}
