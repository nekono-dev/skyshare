/** ゲスト表示用の投稿一覧とスレッドを組み立てる。 */
import type { ThreadGroup, TimelinePost } from "@/lib/timeline/posts"
import type { Translator } from "@/lib/i18n/translate"
import { buildGuestBasicPosts } from "./postsBasic"
import { buildGuestThreadPosts } from "./postsThread"

/**
 * `posts` から uri で 1 件取り出す。見つからなければ例外にする（ダミーの不整合を早く気付くため）。
 *
 * Input:
 * - `posts`: 投稿の一覧
 * - `uri`: 取り出す投稿の AT URI
 *
 * Output:
 * - 見つかった投稿
 */
export const findGuestPost = (
    posts: readonly TimelinePost[],
    uri: string,
): TimelinePost => {
    const post = posts.find(candidate => candidate.uri === uri)
    if (!post) {
        throw new Error(`guest/posts.ts: post not found: ${uri}`)
    }
    return post
}

/**
 * ゲスト表示用の投稿の一覧を、指定言語の文言で組み立てる。
 *
 * Input:
 * - `t`: 表示言語の翻訳関数
 *
 * Output:
 * - ダミーの投稿の一覧
 */
export const buildGuestPosts = (t: Translator["t"]): TimelinePost[] => {
    return [...buildGuestBasicPosts(t), ...buildGuestThreadPosts(t)]
}

/**
 * ゲスト表示用のスレッド（`threads`）を、投稿の一覧から組み立てる。
 *
 * Input:
 * - `posts`: `buildGuestPosts` の結果
 *
 * Output:
 * - ダミーのスレッドの一覧
 */
export const buildGuestThreads = (
    posts: readonly TimelinePost[],
): ThreadGroup[] => {
    const find = (uri: string) => findGuestPost(posts, uri)
    /**
     * `GET /v2/entries`のスレッド構造化済みレスポンス（`threads`）を模したゲスト表示用データ。
     * バックエンドが`buildTimelineThreads`で確定させる形を、
     * `posts`の実体を再利用してあらかじめ手書きでネストしたもの。
     */
    const threads: ThreadGroup[] = [
        {
            rootPost: find("at://did:plc:guestdemo/app.bsky.feed.post/guest1"),
            replies: [],
        },
        {
            rootPost: find("at://did:plc:guestdemo/app.bsky.feed.post/guest2"),
            replies: [],
        },
        {
            rootPost: find("at://did:plc:guestdemo/app.bsky.feed.post/guest3"),
            replies: [],
        },
        {
            rootPost: find(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-video",
            ),
            replies: [],
        },
        {
            rootPost: find(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-video-unsupported",
            ),
            replies: [],
        },
        {
            rootPost: find(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-multi-image",
            ),
            replies: [],
        },
        {
            rootPost: find(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-rich-text",
            ),
            replies: [],
        },
        {
            rootPost: find(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-a-root",
            ),
            replies: [
                find(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-a-mid",
                ),
                find(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-a-tail",
                ),
            ],
        },
        {
            rootPost: find(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-b-root",
            ),
            replies: [
                find(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-b-tail",
                ),
            ],
        },
        {
            rootPost: find(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-c-root",
            ),
            replies: [
                find(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-c-mid",
                ),
                find(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-c-tail",
                ),
            ],
        },
        {
            rootPost: find(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-root",
            ),
            replies: [
                find(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-mid",
                ),
            ],
        },
        {
            rootPost: find(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-e-root",
            ),
            replies: [
                find(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-e-tail",
                ),
            ],
        },
        {
            rootPost: find(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-unknown",
            ),
            replies: [],
        },
    ]
    return threads
}
