/**
 * PostForm のメンション/ハッシュタグ候補用に、Bluesky 公開 AppView から候補一覧を取得するユーティリティ。
 *
 * 責務と処理概要:
 * - `searchMentionSuggestions` は `app.bsky.actor.searchActorsTypeahead`（認証不要のプレフィックス検索）を叩く。
 * - `getTrendingTagSuggestions` は `app.bsky.unspecced.getTrendingTopics` を叩く。このAPIにはクエリパラメータが
 *   存在せず、グローバルなトレンド上位のみを返す（プレフィックス検索は不可）。取得結果をTTLキャッシュし、
 *   複数語のトピック等ハッシュタグとして使えない文字列は除外する。プレフィックス絞込は呼び出し側
 *   （`src/components/post/PostForm/suggestHashtags.ts`）が行う。
 * - 注記: `app.bsky.feed.searchPosts`（全文検索＋facet抽出）でハッシュタグのプレフィックス検索を
 *   代替する案を検証したが、`searchActorsTypeahead`/`getTrendingTopics` と異なりブラウザからの
 *   CORS が許可されておらず（`curl`では200になるが実ブラウザの `fetch` では
 *   "No 'Access-Control-Allow-Origin' header is present" で失敗する）、クライアント実行では
 *   利用不可と判明したため採用していない。
 * - どちらも失敗時は例外を投げず空配列（`getTrendingTagSuggestions` は直前キャッシュがあればそれ）を返し、
 *   本文入力・投稿フローをブロックしない。`AbortError` のみ、呼び出し元のシーケンス制御のため再送出する。
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

/**
 * `app.bsky.actor.searchActorsTypeahead` を叩き、メンション候補に必要な形へ整形する。
 *
 * Input:
 * - `query`: 検索プレフィックス（"@"は含まない）
 * - `signal`: 呼び出し元のデバウンス/競合制御用 AbortSignal
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
            { signal: opts?.signal ?? AbortSignal.timeout(SUGGEST_TIMEOUT_MS) },
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
 * 処理の趣旨:
 * - `getTrendingTopics` のトピックには複数語の話題（空白を含む文字列）も混在するため、
 *   `#tag` として本文へ挿入できる形のものだけに絞り込む。
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
 * `app.bsky.unspecced.getTrendingTopics` をTTLキャッシュ付きで取得し、ハッシュタグとして
 * 使える文字列だけに絞って返す。
 *
 * 処理の趣旨:
 * - このAPIはクエリパラメータを持たず、秒単位で結果が変わるものでもないため、モジュールスコープの
 *   TTLキャッシュ（5分）で実ネットワークコールを抑える。
 * - 失敗時は直前のキャッシュがあればそれを使い回し、無ければ空配列を返す（画面をブロックしない）。
 *
 * Input:
 * - `signal`: 呼び出し元の AbortSignal
 *
 * Output:
 * - ハッシュタグ候補（"#"を含まない）の配列
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
            { signal: opts?.signal ?? AbortSignal.timeout(SUGGEST_TIMEOUT_MS) },
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
