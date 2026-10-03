/**
 * entry削除確認ダイアログで「リンク・Bluesky投稿を削除」の可否・削除件数を判定する
 * ロジック（`specs/entry/frontend/design.md §3.4.1`）。
 * `EntryCard`（entry一覧）・`PostCard`（Timeline一覧、`specs/timeline/design.md §7`）の
 * 双方から共有利用するため`src/lib/entry/`に置く。
 *
 * 責務と処理概要:
 * - 削除予定投稿の一覧表示（`DeletePostListDialog`）用に、取得済みの投稿を`TimelinePost`へ
 *   変換して保持する（追加通信なし）。
 * - `sourceUri`を起点に`app.bsky.feed.getPostThread`（公開API、未認証で呼べる）で
 *   スレッドを取得し、`source`が起点でなければ`legacy`、起点なら自己後続投稿の件数を
 *   数えて`deletable`を返す。判定不能は`unknown`（安全側＝Bluesky投稿の削除を無効化）。
 * - 起点判定（`isThreadRootPost`）・後続投稿の抽出（`extractOwnedLinearReplyChain`）は
 *   サーバ（`resolveDeleteTargets`）と同一の関数を用い、ダイアログの提示内容と
 *   実際の削除挙動を一致させる。
 * - `sourceUri`のrepo（DID）自体がentry所有者のDIDと一致するため、追加のセッション取得は不要。
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
} from "@/lib/entry/posts"
import { parseAtUri } from "@/lib/entry/url"

export type EntryDeleteScope =
    /** sourceが起点。`posts`は削除される自己投稿（古い→新しい順、単発は1件。件数は`posts.length`） */
    | { kind: "deletable"; posts: TimelinePost[] }
    /** sourceが返信投稿（旧実装で作成されたentry） */
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
        // 一覧表示用に変換する。変換不能な投稿（最小要件不足）があると、サーバの削除対象と
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
