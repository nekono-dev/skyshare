/**
 * ハッシュタグ候補（トレンド＋ローカル履歴）のマージ・重複排除・プレフィックス絞込。
 *
 * 責務と処理概要:
 * - Bluesky公開APIにはハッシュタグの「#プレフィックス検索」typeahead APIが存在せず、
 *   `app.bsky.unspecced.getTrendingTopics`（クエリ非対応・グローバルなトレンド上位のみ）しかない。
 * - この制約を補うため、このブラウザで過去に自分が使ったタグの履歴
 *   （`src/lib/settings/hashtagHistorySettings.ts`）を優先的に候補へ混ぜる。
 */
import { readHashtagHistory } from "@/lib/settings/hashtagHistorySettings"
import { getTrendingTagSuggestions } from "@/lib/atproto/suggest"

export type HashtagCandidate = { tag: string; source: "history" | "trending" }

const HASHTAG_SUGGEST_LIMIT = 5

/**
 * プレフィックスに一致するハッシュタグ候補を、ローカル履歴優先＋トレンド補完で返す。
 *
 * 処理の趣旨:
 * - 履歴（使用時刻の新しい順）を先に並べ、トレンドは履歴に無いもの（大文字小文字無視で比較）だけを
 *   後ろに追加する。
 *
 * Input:
 * - `prefix`: 絞り込み対象のプレフィックス文字列（"#"は含まない、空文字可）
 * - `signal`: トレンド取得用の AbortSignal
 *
 * Output:
 * - 候補の配列（最大 `HASHTAG_SUGGEST_LIMIT` 件）
 */
export const getHashtagCandidates = async ({
    prefix,
    signal,
}: {
    prefix: string
    signal?: AbortSignal
}): Promise<HashtagCandidate[]> => {
    const lowerPrefix = prefix.toLowerCase()

    const history = readHashtagHistory()
        .filter(e => e.tag.toLowerCase().startsWith(lowerPrefix))
        .map(e => ({ tag: e.tag, source: "history" as const }))

    const trending = (await getTrendingTagSuggestions({ signal }))
        .filter(t => t.tag.toLowerCase().startsWith(lowerPrefix))
        .filter(
            t =>
                !history.some(h => h.tag.toLowerCase() === t.tag.toLowerCase()),
        )
        .map(t => ({ tag: t.tag, source: "trending" as const }))

    return [...history, ...trending].slice(0, HASHTAG_SUGGEST_LIMIT)
}
