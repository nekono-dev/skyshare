/**
 * Entry 削除に伴う Bluesky 投稿の削除対象を安全に導出する。
 *
 * - `sourceUri` が返信投稿なら `notThreadRoot`、存在しなければ `sourceGone` を返す。
 * - 起点から呼び出し者自身の直線的な返信だけを辿り、所有者を確認した rkey を返す。
 * - `NotFound` 以外の取得失敗は例外として呼び出し側へ伝える。
 */
import { AppBskyFeedDefs } from "@atproto/api"
import type { Agent } from "@atproto/api"
import {
    extractOwnedLinearReplyChain,
    isThreadRootPost,
} from "@/lib/atproto/threadChain"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/threadLimit"
import { parseOwnedAtUri } from "@/lib/atproto/atUri"

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
    agent: Agent,
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
