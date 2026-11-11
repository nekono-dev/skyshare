/**
 * ログイン不要のゲスト表示で使う投稿・スレッド・Entry の固定データを、表示言語ごとに提供する。
 * 実際の Bluesky API に接続せず、表示確認用のデータを返す。
 * SSR と CSR の描画を一致させるため、日時などの値は固定している。
 */
import type { Locale } from "@/lib/i18n/locale"
import type { Translator } from "@/lib/i18n/translate"
import type {
    ThreadGroup,
    TimelinePost,
    TimelineSkyshareEntry,
} from "@/lib/timeline/posts"
import type { EntryDeleteScope } from "@/lib/timeline/resolveEntryDeleteScope"
import { buildGuestDeleteScopes, buildGuestEntries } from "./entries"
import { buildGuestPosts, buildGuestThreads } from "./posts"

export { GUEST_SAMPLE_ENTRY_PATH } from "./assets"

type GuestDummyData = {
    posts: TimelinePost[]
    threads: ThreadGroup[]
    entries: TimelineSkyshareEntry[]
    deleteScopes: Record<string, EntryDeleteScope>
}

/**
 * ゲスト表示用データを、指定言語の文言で組み立てる。
 *
 * SSR と CSR で同じ HTML にするため、実行時刻に依存する値を使わない。
 *
 * Input:
 * - `t`: 表示言語の翻訳関数
 *
 * Output:
 * - 投稿・スレッド・Entry・削除範囲判定テーブルの一式
 */
const buildGuestDummyData = (t: Translator["t"]): GuestDummyData => {
    const posts = buildGuestPosts(t)
    const threads = buildGuestThreads(posts)
    const deleteScopes = buildGuestDeleteScopes(posts)
    const entries = buildGuestEntries(t)
    return { posts, threads, entries, deleteScopes }
}

// 言語ごとの組み立て結果を使い回す（内容は言語のみに依存する固定データのため、
// モジュール共有しても Workers のリクエスト間で状態が混ざることはない）。
const cache = new Map<Locale, GuestDummyData>()

/**
 * 指定言語のゲスト表示用データを返す（言語ごとに初回のみ組み立てる）。
 *
 * Input:
 * - `translator`: 表示言語の翻訳関数
 *
 * Output:
 * - ゲスト表示用データの一式
 */
export const getGuestDummyData = (translator: Translator): GuestDummyData => {
    const cached = cache.get(translator.locale)
    if (cached) return cached
    const built = buildGuestDummyData(translator.t)
    cache.set(translator.locale, built)
    return built
}
