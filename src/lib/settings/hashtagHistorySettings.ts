/**
 * 投稿時に自分が使ったハッシュタグの履歴を localStorage で管理するユーティリティ。
 *
 * 責務と処理概要:
 * - PostForm のハッシュタグ候補（`src/components/post/PostForm/suggestHashtags.ts`）に、
 *   Bluesky公開APIのグローバルなトレンド一覧（`app.bsky.unspecced.getTrendingTopics`）だけでは
 *   出せない「このブラウザで過去に自分が使ったタグ」を補うために使う。
 * - SSR/プライベートモードなどで localStorage が利用不可でも安全に既定値へフォールバックする
 *   （`src/lib/settings/shareSettings.ts` と同じ方針）。
 */

const HASHTAG_HISTORY_KEY = "hashtagHistory"
const HASHTAG_HISTORY_MAX = 50

export type HashtagHistoryEntry = { tag: string; lastUsedAt: number }

/**
 * localStorageから使用済みハッシュタグ履歴を読み取る。
 *
 * Input:
 * - なし
 *
 * Output:
 * - 使用時刻が新しい順の履歴配列。未設定/読み取り失敗時は空配列
 */
export const readHashtagHistory = (): HashtagHistoryEntry[] => {
    if (typeof window === "undefined") return []

    try {
        const raw = window.localStorage.getItem(HASHTAG_HISTORY_KEY)
        if (!raw) return []

        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []

        return parsed
            .filter(
                (e): e is HashtagHistoryEntry =>
                    e &&
                    typeof e === "object" &&
                    typeof e.tag === "string" &&
                    typeof e.lastUsedAt === "number",
            )
            .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    } catch {
        return []
    }
}

/**
 * 投稿確定時に呼び、使用したハッシュタグを履歴へ追記する。
 *
 * 処理の趣旨:
 * - 同一タグ(大文字小文字を無視)は最新の表記・時刻で1件にまとめ、新しい順で先頭から
 *   `HASHTAG_HISTORY_MAX` 件までに切り詰める。
 * - localStorage書き込み失敗時はUI動作を優先し、例外を握りつぶす。
 *
 * Input:
 * - `tags`: 投稿本文から検出したハッシュタグ配列("#"を含まない)
 *
 * Output:
 * - なし
 */
export const addHashtagsToHistory = (tags: string[]): void => {
    if (typeof window === "undefined" || tags.length === 0) return

    try {
        const now = Date.now()
        const existing = readHashtagHistory()
        const merged = [
            ...tags.map(tag => ({ tag, lastUsedAt: now })),
            ...existing,
        ]

        const deduped: HashtagHistoryEntry[] = []
        const seen = new Set<string>()
        for (const entry of merged) {
            const key = entry.tag.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            deduped.push(entry)
        }

        window.localStorage.setItem(
            HASHTAG_HISTORY_KEY,
            JSON.stringify(deduped.slice(0, HASHTAG_HISTORY_MAX)),
        )
    } catch {
        // 保存失敗時はUI動作を優先し、例外を握りつぶす
    }
}

/**
 * Timeline読み込み時の初回候補seed用: 履歴が空の場合のみ、使用数順に並んだタグ配列を
 * 履歴として書き込む。
 *
 * 処理の趣旨:
 * - 既に履歴がある場合（＝過去にこのブラウザで投稿してタグが記録済み）は、その履歴を優先し
 *   一切上書きしない。localStorageにキー自体が存在してもparse結果が空配列なら「履歴なし」
 *   として扱う（`readHashtagHistory` が空配列を返すため、この判定で自然にカバーされる）。
 * - `tags` は使用数の多い順（降順）で渡される想定。`readHashtagHistory` が `lastUsedAt` 降順で
 *   ソートして返す仕組みをそのまま使い、使用数順を再現するための降順ダミー時刻を振って保存する。
 *
 * Input:
 * - `tags`: 使用数降順のタグ配列("#"を含まない)
 *
 * Output:
 * - なし
 */
export const seedHashtagHistoryFromRankedTags = (tags: string[]): void => {
    if (typeof window === "undefined" || tags.length === 0) return
    if (readHashtagHistory().length > 0) return

    try {
        const now = Date.now()
        const entries: HashtagHistoryEntry[] = tags
            .slice(0, HASHTAG_HISTORY_MAX)
            .map((tag, index) => ({ tag, lastUsedAt: now - index }))

        window.localStorage.setItem(
            HASHTAG_HISTORY_KEY,
            JSON.stringify(entries),
        )
    } catch {
        // 保存失敗時はUI動作を優先し、例外を握りつぶす
    }
}
