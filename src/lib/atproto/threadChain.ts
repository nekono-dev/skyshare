/**
 * `app.bsky.feed.getPostThread`が返す `ThreadViewPost` から、投稿者自身が投稿した
 * 後続投稿のみを直線的に辿って時系列順に抽出する共通ロジック。
 *
 * 責務と処理概要:
 * - entry削除時のスレッド全体削除対象の導出（`specs/entry/backend/design.md §7.4.1`）と、
 *   entry詳細ページのスレッド表示（`specs/entry/frontend/design.md §3.3`）は、
 *   いずれも「第三者の返信、およびその分岐先を除外し、投稿者自身の投稿のみを
 *   直線的に辿る」という同一の抽出規則を要求しているため、この1箇所に実装を集約する。
 */
import { AppBskyFeedDefs } from "@atproto/api"

/**
 * `threadView`（`source`投稿を起点とするスレッドツリー）から、`ownerDid`自身が
 * 投稿した後続投稿のみを、先頭（`source`自身）から時系列順に直線的に抽出する。
 *
 * 処理の趣旨:
 * - 各ノードの`replies`のうち、`post.author.did === ownerDid`に一致する最初の1件のみを
 *   次のノードとして採用し、以降も同じ規則で辿り続ける。第三者の返信、および
 *   第三者の返信で分岐した先（それが仮にownerDid自身の投稿であっても）は含めない。
 * - `maxCount`件に達するか、次のノードが見つからなくなるまで続ける。
 *
 * Input:
 * - `threadView`: `getPostThread`が返す`ThreadViewPost`（`source`投稿を起点とするノード）
 * - `ownerDid`: 辿る対象を絞り込む投稿者のDID
 * - `maxCount`: 抽出する投稿数の上限（`source`自身を含む）
 *
 * Output:
 * - `source`から時系列順（古い→新しい）に並んだ`PostView`の配列（最低1件、`source`自身を含む）
 */
export const extractOwnedLinearReplyChain = (
    threadView: AppBskyFeedDefs.ThreadViewPost,
    ownerDid: string,
    maxCount: number,
): AppBskyFeedDefs.PostView[] => {
    const result: AppBskyFeedDefs.PostView[] = [threadView.post]

    let current: AppBskyFeedDefs.ThreadViewPost = threadView
    while (result.length < maxCount) {
        const replies = current.replies ?? []
        let next: AppBskyFeedDefs.ThreadViewPost | undefined
        for (const reply of replies) {
            if (!AppBskyFeedDefs.isThreadViewPost(reply)) {
                continue
            }
            if (reply.post.author.did !== ownerDid) {
                continue
            }
            next = reply
            break
        }
        if (!next) {
            break
        }
        result.push(next.post)
        current = next
    }

    return result
}
