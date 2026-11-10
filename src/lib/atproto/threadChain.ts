/**
 * `app.bsky.feed.getPostThread` の `ThreadViewPost` から、投稿者自身の後続投稿を直線的にたどって抽出する。
 *
 * - 第三者の返信と、その分岐先はたどらない。
 */
import { AppBskyFeedDefs, AppBskyFeedPost } from "@atproto/api"
import type { $Typed } from "@atproto/api"

/**
 * `post.record.createdAt`（ISO 8601 の文字列）をエポックミリ秒に変換する。
 * 欠損・パース不能の場合は `undefined`。
 */
const readPostCreatedAtMs = (
    post: AppBskyFeedDefs.PostView,
): number | undefined => {
    const record = post.record as AppBskyFeedPost.Main | undefined
    if (typeof record?.createdAt !== "string") return undefined
    const ms = new Date(record.createdAt).getTime()
    return Number.isNaN(ms) ? undefined : ms
}

/**
 * `candidates`（2件以上、いずれも `author.did === ownerDid` 一致済み）のうち、`parent` の
 * `record.createdAt` との絶対差が最小のものを1件選ぶ。
 *
 * - 絶対差が同値の候補が複数ある場合は、`candidates`（＝`replies` の並び順）で先に現れた方を選ぶ。
 * - `createdAt` が欠損・パース不能な候補は差を無限大として扱い、有効な候補より後に回す。全候補が無効なら先頭の候補を選ぶ。
 */
const pickClosestByCreatedAt = (
    parent: AppBskyFeedDefs.PostView,
    candidates: AppBskyFeedDefs.ThreadViewPost[],
): AppBskyFeedDefs.ThreadViewPost => {
    const parentMs = readPostCreatedAtMs(parent)
    const diff = (node: AppBskyFeedDefs.ThreadViewPost): number => {
        const ms = readPostCreatedAtMs(node.post)
        if (parentMs === undefined || ms === undefined) {
            return Number.POSITIVE_INFINITY
        }
        return Math.abs(ms - parentMs)
    }
    return candidates.reduce((closest, candidate) =>
        diff(candidate) < diff(closest) ? candidate : closest,
    )
}

/**
 * `threadView`（`source`投稿を起点とするスレッドツリー）から、`ownerDid`自身が
 * 投稿した後続投稿のみを、先頭（`source`自身）から時系列順に直線的に抽出する。
 *
 * - 起点の投稿者が `ownerDid` でなければ空配列を返す。
 * - 各ノードで、`replies` のうち投稿者が `ownerDid` のものだけを候補にする。第三者の返信と、その先の投稿はたどらない（先が `ownerDid` の投稿でも）。
 *   - 候補が0件なら打ち切る。
 *   - 候補が1件なら、`createdAt` の差を見ずにそのまま採用する。
 *   - 候補が2件以上なら、`pickClosestByCreatedAt` で1件を選ぶ。
 * - `maxCount` 件（`source` を含む）に達するか、次のノードが無くなるまで続ける。
 *
 * Input:
 * - `threadView`: `getPostThread`が返す`ThreadViewPost`（`source`投稿を起点とするノード）
 * - `ownerDid`: 辿る対象を絞り込む投稿者のDID
 * - `maxCount`: 抽出する投稿数の上限（`source`自身を含む）
 *
 * Output:
 * - `threadView.post.author.did !== ownerDid`の場合: 空配列
 * - それ以外: `source`から時系列順（古い→新しい）に並んだ`PostView`の配列
 *   （最低1件、`source`自身を含む）
 */
export const extractOwnedLinearReplyChain = (
    threadView: AppBskyFeedDefs.ThreadViewPost,
    ownerDid: string,
    maxCount: number,
): AppBskyFeedDefs.PostView[] => {
    if (threadView.post.author.did !== ownerDid) {
        return []
    }

    const result: AppBskyFeedDefs.PostView[] = [threadView.post]

    let current: AppBskyFeedDefs.ThreadViewPost = threadView
    while (result.length < maxCount) {
        const candidates: AppBskyFeedDefs.ThreadViewPost[] = []
        for (const reply of current.replies ?? []) {
            if (!AppBskyFeedDefs.isThreadViewPost(reply)) {
                continue
            }
            if (reply.post.author.did !== ownerDid) {
                continue
            }
            candidates.push(reply)
        }

        if (candidates.length === 0) {
            break
        }

        const next =
            candidates.length === 1
                ? candidates[0]
                : pickClosestByCreatedAt(current.post, candidates)

        result.push(next.post)
        current = next
    }

    return result
}

/**
 * 一覧で取得済みの投稿だけから、`rootUri` を起点とするスレッドの木を組み立てる。
 *
 * - 木に含まれるすべての投稿で、`replyCount`（他人の返信も含む直下の返信の件数）と、`posts` にある直下の子の件数が一致するときだけ木を返す。
 *   1 つでも一致しない場合、または `replyCount` が数値でない場合は `undefined` を返す。
 * - 親子の関係は投稿レコードの `record.reply.parent.uri` で判定する。
 * - 同じ uri の投稿を 2 回たどった場合（循環）は `undefined` を返す。
 *
 * Input:
 * - `rootUri`: 起点の投稿の uri
 * - `posts`: 一覧の投稿を uri で引く表
 *
 * Output:
 * - 確定できる場合: `extractOwnedLinearReplyChain` に渡せる `ThreadViewPost`
 * - 起点が `posts` に無い、または確定できない場合: `undefined`
 */
export const buildThreadViewFromPosts = (
    rootUri: string,
    posts: Map<string, AppBskyFeedDefs.PostView>,
): AppBskyFeedDefs.ThreadViewPost | undefined => {
    const childrenByParent = new Map<string, AppBskyFeedDefs.PostView[]>()
    for (const post of posts.values()) {
        const parentUri = (post.record as AppBskyFeedPost.Main | undefined)
            ?.reply?.parent?.uri
        if (typeof parentUri !== "string") continue
        const children = childrenByParent.get(parentUri) ?? []
        children.push(post)
        childrenByParent.set(parentUri, children)
    }

    const visited = new Set<string>()
    const build = (
        post: AppBskyFeedDefs.PostView,
    ): $Typed<AppBskyFeedDefs.ThreadViewPost> | undefined => {
        if (visited.has(post.uri)) return undefined
        visited.add(post.uri)

        const children = childrenByParent.get(post.uri) ?? []
        if (post.replyCount !== children.length) return undefined

        const replies: $Typed<AppBskyFeedDefs.ThreadViewPost>[] = []
        for (const child of children) {
            const node = build(child)
            if (!node) return undefined
            replies.push(node)
        }
        return {
            $type: "app.bsky.feed.defs#threadViewPost",
            post,
            replies,
        }
    }

    const root = posts.get(rootUri)
    return root ? build(root) : undefined
}

/**
 * 投稿レコードの `record.reply.root`（`app.bsky.feed.post#replyRef` の StrongRef）から、スレッド先頭投稿の uri を取り出す。
 * AppView の `FeedViewPost.reply` は読まない。
 *
 * Input:
 * - `post`: 対象の`PostView`
 *
 * Output:
 * - 返信である場合、そのスレッド先頭投稿のuri。返信でない場合は`undefined`。
 */
export const extractReplyRootUri = (
    post: AppBskyFeedDefs.PostView,
): string | undefined =>
    (post.record as AppBskyFeedPost.Main | undefined)?.reply?.root?.uri

/**
 * AT URI（`at://<did-or-handle>/collection/rkey`）の authority 部分を取り出す。DID とは限らず、handle の場合もある。
 *
 * Input:
 * - `uri`: AT URI文字列
 *
 * Output:
 * - authority部分。`at://`形式でない場合は`undefined`。
 *
 * Example:
 * - `extractRepoDidFromAtUri("at://did:plc:abc/app.bsky.feed.post/1")` → `"did:plc:abc"`
 */
export const extractRepoDidFromAtUri = (uri: string): string | undefined =>
    uri.match(/^at:\/\/([^/]+)/)?.[1]

/**
 * 投稿がスレッドの起点（`record.reply` を持たない投稿）かどうかを判定する。
 *
 * Input:
 * - `post`: 対象の`PostView`
 *
 * Output:
 * - `record`が投稿レコードでない、または`record.reply`を持たない場合は`true`
 */
export const isThreadRootPost = (post: AppBskyFeedDefs.PostView): boolean =>
    !AppBskyFeedPost.isRecord(post.record) || !post.record.reply
