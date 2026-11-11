/**
 * スレッドグループ内で、Entry の画像取得元と Entry が紐づく投稿を判定する。
 */
import {
    hasEntryMedia,
    type ThreadGroup,
    type TimelinePost,
} from "@/lib/timeline/posts"

/**
 * スレッドグループ内で、事後entry作成のVisual（カバー画像）を取得すべき投稿を
 * 判定する。ボタン自体は常にルート投稿のカードに表示し、中間投稿のカードに
 * ボタンが表示されることはない（`ThreadCard`側の責務）。作成されるentryの
 * 作成されるentryの`source`は、ここで返す投稿とは独立に常にルート投稿とする
 * （`ThreadCard`が`entrySourcePost`として明示送信する。サーバは`source`を
 * 自動解決しない）。
 *
 * Input:
 * - `group`: グルーピング済みの投稿群
 *
 * Output:
 * - Visual取得元の投稿。以下のいずれかに該当する場合は`null`（ボタン非表示）:
 *   - 単独投稿（`replies.length === 0`。単独投稿は既存の独立ロジックで処理する）
 *   - ルート・repliesのいずれも画像・動画（再生可能な動画。`hasEntryMedia`）を持たない
 * - ルートが画像を持てばルート自身、持たなければrepliesのうちルートに最も近い
 *   （時系列上最も古い）画像投稿を返す。
 *
 * ルート投稿・replies側にskyshare entryが紐づいているかどうかはこの判定に影響しない。
 * 判定がentryの有無（props由来で削除後も更新されない）に依存すると、ルートのentry削除後に
 * 作成ボタンが復帰しないため、entryの有無は`useSkyshareEntryStatus`の`display`に一任する。
 * 後続投稿の既存Entryとルート投稿の新規Entryは、同じスレッド内に共存しうる。
 */
export const resolveEntryVisualSourcePost = (
    group: ThreadGroup,
): TimelinePost | null => {
    if (group.replies.length === 0) return null
    if (hasEntryMedia(group.rootPost)) return group.rootPost

    return group.replies.find(hasEntryMedia) ?? null
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
 */
export const findEntryCarrier = (group: ThreadGroup): TimelinePost | null => {
    if (group.replies.length === 0) return null
    if (group.rootPost.skyshareEntry) return group.rootPost
    return group.replies.find(post => !!post.skyshareEntry) ?? null
}
