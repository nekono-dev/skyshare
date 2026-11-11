/**
 * 下書き API のレコードを一覧表示向けのデータへ正規化する。
 * `posts` が複数件の場合は、スレッド形式の下書きを表す。
 */

export type DraftListPost = {
    text: string
    labels?: string[]
}

export type DraftListItem = {
    id: string
    posts: DraftListPost[]
    updatedAt: string
}

type DraftListApiRecord = {
    id: string
    posts?: { text?: string; labels?: string[] }[]
    updatedAt?: string
}

/**
 * 下書きの一覧表示用に API レスポンスを変換する。
 *
 * Input:
 * - `records`: `GET /v2/bsky/drafts` の `drafts` 配列
 *
 * Output:
 * - `DraftListItem[]`: 一覧描画と選択処理に使える簡潔な下書き情報
 *
 * 例:
 * - 入力: `[{ id, posts: [{ text: "hello", labels: ["sexual"] }], updatedAt: "..." }]`
 * - 出力: `[{ id, posts: [{ text: "hello", labels: ["sexual"] }], updatedAt: "..." }]`
 */
export const normalizeDraftList = (
    records: DraftListApiRecord[] | undefined,
): DraftListItem[] => {
    if (!Array.isArray(records)) {
        return []
    }

    return records
        .filter(
            record =>
                record &&
                typeof record.id === "string" &&
                Array.isArray(record.posts) &&
                record.posts.length > 0,
        )
        .map(record => ({
            id: record.id,
            posts: (record.posts ?? []).map(post => ({
                text: typeof post.text === "string" ? post.text : "",
                labels:
                    Array.isArray(post.labels) && post.labels.length > 0
                        ? post.labels
                        : undefined,
            })),
            updatedAt: record.updatedAt ?? new Date().toISOString(),
        }))
}
