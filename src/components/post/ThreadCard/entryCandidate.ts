/**
 * スレッドグループ内の「事後entry作成のVisual取得元投稿」（FR-3）・
 * 「スレッド由来entryを持つ投稿」（FR-4）を判定するロジック。
 *
 * 責務と処理概要:
 * - `resolveEntryVisualSourcePost`: `specs/timeline`。
 * - `findEntryCarrier`: `specs/timeline`。
 * - いずれも`ThreadGroup`のみを入力に取る純粋関数で、UI（`ThreadCard`）から分離する。
 */
import {
    hasEntryMedia,
    type ThreadGroup,
    type TimelinePost,
} from "@/lib/entry/posts"

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
 * - Visual取得元の投稿。以下のいずれかに該当する場合は`null`（要件FR-3、ボタン非表示）:
 *   - 単独投稿（`replies.length === 0`。単独投稿は既存の独立ロジックで処理する）
 *   - ルート・repliesのいずれも画像・動画（再生可能な動画。`hasEntryMedia`）を持たない
 * - ルートが画像を持てばルート自身、持たなければrepliesのうちルートに最も近い
 *   （時系列上最も古い）画像投稿を返す。
 *
 * ルート投稿・replies側にskyshare entryが紐づいているかどうかはこの判定に影響しない。
 * 判定がentryの有無（props由来で削除後も更新されない）に依存すると、ルートのentry削除後に
 * 作成ボタンが復帰しないため、entryの有無は`useSkyshareEntryStatus`の`display`に一任する。
 * 本機能の実装前に、スレッド中間の投稿を対象にentryが作成されていたケースが
 * これに該当しうるが、その場合でもルート投稿自身がentryを持たない限りルート
 * 投稿を起点とする新規entry作成を許可する（1スレッドグループ内に、後続投稿の
 * 既存entryとルート投稿の新規entryが共存しうる。要件FR-3）。
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
 *   （要件FR-4）。
 */
export const findEntryCarrier = (group: ThreadGroup): TimelinePost | null => {
    if (group.replies.length === 0) return null
    if (group.rootPost.skyshareEntry) return group.rootPost
    return group.replies.find(post => !!post.skyshareEntry) ?? null
}
