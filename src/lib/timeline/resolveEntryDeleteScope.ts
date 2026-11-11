/**
 * Entry 削除確認で、Bluesky 投稿を削除できるかと対象範囲を判定する。
 * 判定不能な場合は安全側に倒し、投稿削除を無効にする情報を返す。
 * - 未認証で呼べる公開 API `app.bsky.feed.getPostThread` を使い、セッションを追加取得しない。
 * - サーバと同じスレッド起点・投稿列判定を使い、表示内容と削除対象を一致させる。
 */
import { AppBskyFeedDefs } from "@atproto/api"
import { publicAtpAgent } from "@/lib/atproto/publicAgent"
import {
    extractOwnedLinearReplyChain,
    isThreadRootPost,
} from "@/lib/atproto/threadChain"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/threadLimit"
import {
    normalizePostViewToTimelinePost,
    type TimelinePost,
} from "@/lib/timeline/posts"
import { parseAtUri } from "@/lib/atproto/atUri"

export type EntryDeleteScope =
    /** sourceが起点。`posts`は削除される自己投稿（古い→新しい順、単発は1件。件数は`posts.length`） */
    | { kind: "deletable"; posts: TimelinePost[] }
    /** source がスレッド返信に紐づく Entry */
    | { kind: "legacy" }
    /** 判定不能 */
    | { kind: "unknown" }

/**
 * `sourceUri`が指すBluesky投稿を起点とする削除範囲を判定する。
 *
 * Input:
 * - `sourceUri`: entryの`source`投稿のAT URI
 *
 * Output:
 * - `EntryDeleteScope`。不正なURI・取得失敗・想定外のthread形式は`unknown`
 */
export const resolveEntryDeleteScope = async (
    sourceUri: string,
): Promise<EntryDeleteScope> => {
    // sourceUri の repo DID は Entry 所有者の DID と一致するため、追加のセッション取得は不要。
    const parsedSourceUri = parseAtUri(sourceUri)
    if (!parsedSourceUri) return { kind: "unknown" }

    try {
        const res = await publicAtpAgent.app.bsky.feed.getPostThread({
            uri: sourceUri,
            depth: MAX_THREAD_POST_COUNT,
            parentHeight: 0,
        })
        const thread = res.data.thread
        if (!AppBskyFeedDefs.isThreadViewPost(thread)) {
            return { kind: "unknown" }
        }
        if (!isThreadRootPost(thread.post)) return { kind: "legacy" }

        const chain = extractOwnedLinearReplyChain(
            thread,
            parsedSourceUri.repo,
            MAX_THREAD_POST_COUNT,
        )
        // 一覧表示用に変換する。変換不能な投稿（最小要件を満たさないもの）があると、サーバの削除対象と
        // 一覧がずれるため、安全側で判定不能にする。
        const posts: TimelinePost[] = []
        for (const post of chain) {
            const normalized = normalizePostViewToTimelinePost(post)
            if (!normalized) return { kind: "unknown" }
            posts.push(normalized)
        }
        return { kind: "deletable", posts }
    } catch (err) {
        console.error("resolveEntryDeleteScope: failed", err)
        return { kind: "unknown" }
    }
}
