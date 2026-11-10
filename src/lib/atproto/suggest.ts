/**
 * 公開 AppView から、メンションとハッシュタグの候補を取得する。
 *
 * - 失敗時は例外を投げず空配列を返す。`AbortError` だけは例外のまま投げ直す。
 * - ハッシュタグの候補は `getTrendingTopics` の結果で、クエリを持たずトレンドの上位だけを返す。プレフィックスでは絞り込めない。
 */
import { publicAtpAgent } from "./publicAgent"

export type MentionSuggestion = {
    did: string
    handle: string
    displayName?: string
    avatarUrl?: string
}

const MENTION_SUGGEST_LIMIT = 5
const SUGGEST_TIMEOUT_MS = 5000

/** 呼び出し元の中断信号（あれば）とタイムアウトのどちらか早い方で中断する信号を作る。 */
const withTimeout = (signal?: AbortSignal): AbortSignal => {
    const timeout = AbortSignal.timeout(SUGGEST_TIMEOUT_MS)
    return signal ? AbortSignal.any([signal, timeout]) : timeout
}

/**
 * `app.bsky.actor.searchActorsTypeahead` で、プレフィックスに一致するアカウントを取得する。
 *
 * Input:
 * - `query`: 検索プレフィックス（"@"は含まない）。空文字なら通信せず空配列を返す
 * - `opts.signal`: 呼び出し元の中断信号。5 秒（`SUGGEST_TIMEOUT_MS`）のタイムアウトも常に適用する
 *
 * Output:
 * - 一致したアカウントの配列（最大 `MENTION_SUGGEST_LIMIT` 件）。失敗時は空配列
 *
 * 例:
 * - 入力: `("alice")`
 * - 出力: `[{ did: "did:plc:...", handle: "alice.bsky.social", displayName: "Alice", avatarUrl: "https://..." }]`
 */
export const searchMentionSuggestions = async (
    query: string,
    opts?: { signal?: AbortSignal },
): Promise<MentionSuggestion[]> => {
    if (!query) return []

    try {
        const res = await publicAtpAgent.app.bsky.actor.searchActorsTypeahead(
            { q: query, limit: MENTION_SUGGEST_LIMIT },
            { signal: withTimeout(opts?.signal) },
        )
        return res.data.actors.map(actor => ({
            did: actor.did,
            handle: actor.handle,
            displayName: actor.displayName,
            avatarUrl: actor.avatar,
        }))
    } catch (err) {
        if ((err as Error)?.name === "AbortError") throw err
        console.warn("suggest.ts: failed to search mention suggestions", err)
        return []
    }
}

export type TrendingTagSuggestion = { tag: string }

const TRENDING_CACHE_TTL_MS = 5 * 60 * 1000
let trendingCache: { tags: TrendingTagSuggestion[]; fetchedAt: number } | null =
    null

/**
 * `topic` 文字列が単一のハッシュタグとして妥当かを判定する。
 *
 * - 先頭の `#`・`＃` を除いたあとが、空でなく、空白を含まず、長さが 64 以下のとき妥当とする。ここは UTF-16 長で判定する。`@atproto/api` の検出は、UTF-16 長が 64 を超えたときだけ grapheme（書記素）数で判定する。
 *
 * Input:
 * - `raw`: `topic` 文字列（先頭に "#"/"＃" を含む場合がある）
 *
 * Output:
 * - ハッシュタグとして妥当なら `true`
 */
const isHashtagLikeToken = (raw: string): boolean => {
    const stripped = raw.replace(/^[#＃]/, "").trim()
    return stripped.length > 0 && stripped.length <= 64 && !/\s/.test(stripped)
}

/**
 * `app.bsky.unspecced.getTrendingTopics` の結果を、ハッシュタグとして使える文字列だけに絞って返す。
 *
 * - 結果は 5 分（`TRENDING_CACHE_TTL_MS`）の間モジュールのキャッシュで再利用し、期限内は通信しない。
 * - 取得に失敗したときは、期限切れでも直前のキャッシュを返す。キャッシュも無ければ空配列を返す。
 *
 * Input:
 * - `opts.signal`: 呼び出し元の中断信号。5 秒（`SUGGEST_TIMEOUT_MS`）のタイムアウトも常に適用する
 *
 * Output:
 * - ハッシュタグ候補（"#"を含まず、重複を除いた）の配列。`topics` と `suggested` の両方から集める
 */
export const getTrendingTagSuggestions = async (opts?: {
    signal?: AbortSignal
}): Promise<TrendingTagSuggestion[]> => {
    if (
        trendingCache &&
        Date.now() - trendingCache.fetchedAt < TRENDING_CACHE_TTL_MS
    ) {
        return trendingCache.tags
    }

    try {
        const res = await publicAtpAgent.app.bsky.unspecced.getTrendingTopics(
            { limit: 25 },
            { signal: withTimeout(opts?.signal) },
        )
        const tags = [...res.data.topics, ...res.data.suggested]
            .map(t => t.topic.replace(/^[#＃]/, "").trim())
            .filter(isHashtagLikeToken)
            .filter((tag, i, arr) => arr.indexOf(tag) === i)
            .map(tag => ({ tag }))

        trendingCache = { tags, fetchedAt: Date.now() }
        return tags
    } catch (err) {
        if ((err as Error)?.name === "AbortError") throw err
        console.warn("suggest.ts: failed to fetch trending topics", err)
        return trendingCache?.tags ?? []
    }
}
