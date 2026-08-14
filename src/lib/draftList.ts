/**
 * 下書き一覧表示に必要な最小データに整形するユーティリティ。
 *
 * 責務と処理概要:
 * - GET /v2/drafts のレスポンスを、一覧カード表示と選択時のフォーム注入に必要な形へ変換する。
 */

export type DraftListItem = {
    id: string
    text: string
    updatedAt: string
    labels?: string[]
}

type DraftListApiRecord = {
    id: string
    text?: string
    labels?: string[]
    updatedAt?: string
}

/**
 * 下書きの一覧表示用に API レスポンスを変換する。
 *
 * Input:
 * - `records`: `GET /v2/drafts` の `drafts` 配列
 *
 * Output:
 * - `DraftListItem[]`: 一覧描画と選択処理に使える簡潔な下書き情報
 *
 * 例:
 * - 入力: `[{ id, text: "hello", labels: ["sexual"], updatedAt: "..." }]`
 * - 出力: `[{ id, text: "hello", labels: ["sexual"], updatedAt: "..." }]`
 */
export const normalizeDraftList = (
    records: DraftListApiRecord[] | undefined,
): DraftListItem[] => {
    if (!Array.isArray(records)) {
        return []
    }

    return records
        .filter(record => record && typeof record.id === "string")
        .map(record => ({
            id: record.id,
            text: typeof record.text === "string" ? record.text : "",
            updatedAt: record.updatedAt ?? new Date().toISOString(),
            labels:
                Array.isArray(record.labels) && record.labels.length > 0
                    ? record.labels
                    : undefined,
        }))
}
