/**
 * ゲストモード（URLクエリパラメータ `?guest`、`@/lib/guestMode` 参照）向けのダミーデータ。
 *
 * 責務と処理概要:
 * - ログイン不要の見た目確認用に、`TimelinePost`/`TimelineSkyshareEntry` と同じ形の
 *   固定データを、表示言語ごとに組み立てて提供する（Timeline/EntryList が未ログイン時の代替表示として使う）。
 * - 実際の Bluesky API を叩かないよう、画像・アバターは data URI の SVG で完結させる。
 * - データは `assets.ts`（資材のパス）・`posts.ts`（投稿とスレッド）・`entries.ts`（Entry と削除範囲）に分ける。
 *   削除範囲の判断（`resolveGuestDeleteScope`）は `@/lib/guestMode` に置き、ここには置かない。
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
 * 処理の趣旨:
 * - SSR/CSRで同じHTMLになる必要があるため（Reactのhydration mismatch回避）、
 *   `Date.now()` 等の実行タイミング依存の値ではなく固定値を使う。
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
