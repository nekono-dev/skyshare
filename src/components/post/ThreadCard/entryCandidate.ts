/**
 * スレッドグループ内の「事後entry作成ボタンの対象投稿」（FR-3）・
 * 「スレッド由来entryを持つ投稿」（FR-4）を判定するロジック。
 *
 * 責務と処理概要:
 * - `resolvePostCreateEntryTarget`: `specs/timeline/design.md §5.1`。
 * - `findEntryCarrier`: `specs/timeline/design.md §6.1`。
 * - いずれも`ThreadGroup`のみを入力に取る純粋関数で、UI（`ThreadCard`）から分離する。
 */
import type { TimelinePost } from "@/lib/entry/posts"
import type { ThreadGroup } from "@/components/post/Timeline/threadGroup"

/**
 * スレッドグループ内で、事後entry作成ボタンを表示すべき投稿を判定する。
 *
 * Input:
 * - `group`: グルーピング済みの投稿群
 *
 * Output:
 * - 対象投稿（`TimelinePost`）。以下のいずれかに該当する場合は`null`（要件FR-3）:
 *   - 単独投稿（`replies.length === 0`）
 *   - グループ内のいずれかの投稿に既にskyshare entryが紐づいている
 *   - ルート投稿が画像を持つ
 *   - ルート投稿以外に画像を持つ投稿が1件も無い
 *   （複数該当する場合は時系列上最も古いもの＝`replies`の先頭）
 */
export const resolvePostCreateEntryTarget = (
    group: ThreadGroup,
): TimelinePost | null => {
    if (group.replies.length === 0) return null
    const hasAnyEntry =
        !!group.rootPost.skyshareEntry ||
        group.replies.some(post => !!post.skyshareEntry)
    if (hasAnyEntry) return null
    if (group.rootPost.images.length > 0) return null

    return group.replies.find(post => post.images.length > 0) ?? null
}

/**
 * スレッドグループのうち、skyshare entryが紐づく投稿（＝スレッド由来の視覚的区別の
 * 対象）を判定する。
 *
 * Input:
 * - `group`: グルーピング済みの投稿群
 *
 * Output:
 * - entryが紐づく投稿。単独投稿、またはグループ内のどの投稿にもentryが無い場合は`null`
 *   （要件FR-4）。
 */
export const findEntryCarrier = (group: ThreadGroup): TimelinePost | null => {
    if (group.replies.length === 0) return null
    if (group.rootPost.skyshareEntry) return group.rootPost
    return group.replies.find(post => !!post.skyshareEntry) ?? null
}
