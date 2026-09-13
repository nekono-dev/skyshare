/**
 * Timeline一覧（`GET /v2/entries`の`posts`、`indexedAt`降順）を、reply chainで連結された
 * 投稿群ごとにグルーピングするクライアント側ロジック。
 *
 * 責務と処理概要:
 * - `replyParentUri`（timeline Phase1でバックエンドが付与）を辿り、直線的に連結された
 *   投稿を1つの`ThreadGroup`にまとめる（`specs/timeline/design.md §3`）。
 * - 一覧内に存在しない投稿（ページング境界の外、または他人の投稿）への参照は連結しない
 *   （無理に遡って取得しない、要件FR-1）。
 */
import type { TimelinePost } from "@/lib/entry/posts"

export type ThreadGroup = {
    id: string
    rootPost: TimelinePost
    replies: TimelinePost[]
}

/**
 * `items`をreply chainでグルーピングする。
 *
 * Input:
 * - `items`: `indexedAt`降順（新しい順）に並んだ投稿一覧
 *
 * Output:
 * - `ThreadGroup[]`。1件のみのグループ（`replies.length === 0`）は単独投稿を表す。
 */
export const groupIntoThreads = (items: TimelinePost[]): ThreadGroup[] => {
    const byUri = new Map(items.map(item => [item.uri, item]))
    const consumed = new Set<string>()
    const groups: ThreadGroup[] = []

    for (const item of items) {
        if (consumed.has(item.uri)) continue

        // itemを起点に、まだ消費されていない子（自分より新しい返信）を辿って
        // チェーンの末尾（最新側）を探す。
        let tail = item
        while (true) {
            const child = items.find(
                candidate =>
                    !consumed.has(candidate.uri) &&
                    candidate.replyParentUri === tail.uri,
            )
            if (!child) break
            consumed.add(child.uri)
            tail = child
        }

        // itemからrootに向かって親を辿る（親が一覧内かつ未消費の場合のみ連結する）。
        const chain: TimelinePost[] = [item]
        let current = item
        while (
            current.replyParentUri &&
            byUri.has(current.replyParentUri) &&
            !consumed.has(current.replyParentUri)
        ) {
            const parent = byUri.get(current.replyParentUri)!
            chain.unshift(parent)
            consumed.add(parent.uri)
            current = parent
        }

        consumed.add(item.uri)
        groups.push({
            id: chain[0].uri,
            rootPost: chain[0],
            replies: chain.slice(1),
        })
    }

    return groups
}
