/**
 * entry削除時のBluesky投稿削除（`deleteBskyPost:true`）の削除対象を導出する
 * （`specs/entry-api`）。DELETEハンドラのみが呼び出す。
 *
 * 責務と処理概要:
 * - `sourceUri`を起点に`getPostThread`でreply chainを取得し、`source`が返信投稿
 *   （起点でない）なら`notThreadRoot`、既に存在しなければ`sourceGone`を返す。
 * - 起点であれば、呼び出し者自身の後続投稿のみを直線的に辿り（`extractOwnedLinearReplyChain`）、
 *   各投稿の所有者を検証したrkey一覧を返す。
 */
import { AppBskyFeedDefs } from "@atproto/api"
import type { AtpAgent } from "@atproto/api"
import {
    extractOwnedLinearReplyChain,
    isThreadRootPost,
} from "@/lib/atproto/threadChain"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/threadLimit"
import { parseOwnedAtUri } from "@/lib/entry/url"

export type DeleteTargetsResult =
    | { kind: "targets"; rkeys: string[] }
    | { kind: "sourceGone" }
    | { kind: "notThreadRoot" }

/** XRPCエラー`NotFound`（投稿が存在しない）かどうか。 */
const isNotFoundError = (err: unknown): boolean =>
    !!err &&
    typeof err === "object" &&
    (err as { error?: unknown }).error === "NotFound"

/**
 * 削除対象のrkey一覧（`source`自身を先頭とする時系列順）を導出する。
 *
 * Input:
 * - `agent`: 呼び出し者の認証済みagent
 * - `ownerDid`: 呼び出し者のDID
 * - `sourceUri`: entryレコードに記録された`source`のAT URI
 *
 * Output:
 * - `DeleteTargetsResult`。`NotFound`以外の取得失敗は例外を送出する。
 */
export const resolveDeleteTargets = async (
    agent: AtpAgent,
    ownerDid: string,
    sourceUri: string,
): Promise<DeleteTargetsResult> => {
    let res
    try {
        res = await agent.app.bsky.feed.getPostThread({
            uri: sourceUri,
            depth: MAX_THREAD_POST_COUNT,
            parentHeight: 0,
        })
    } catch (err) {
        if (isNotFoundError(err)) return { kind: "sourceGone" }
        throw err
    }

    const thread = res.data.thread
    if (!AppBskyFeedDefs.isThreadViewPost(thread)) {
        if (AppBskyFeedDefs.isNotFoundPost(thread)) {
            return { kind: "sourceGone" }
        }
        throw new Error("unexpected thread view")
    }
    if (!isThreadRootPost(thread.post)) return { kind: "notThreadRoot" }

    const chain = extractOwnedLinearReplyChain(
        thread,
        ownerDid,
        MAX_THREAD_POST_COUNT,
    )
    const rkeys = chain
        .map(post => parseOwnedAtUri(post.uri, "app.bsky.feed.post", ownerDid))
        .filter((parsed): parsed is NonNullable<typeof parsed> => !!parsed)
        .map(parsed => parsed.rkey)
    return { kind: "targets", rkeys }
}
