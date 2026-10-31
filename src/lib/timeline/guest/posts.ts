import { entryAtUri } from "@/lib/atproto/nsid"
import type { ThreadGroup, TimelinePost } from "@/lib/timeline/posts"
import type { Translator } from "@/lib/i18n/translate"
import type {
    PostFacet,
    PostFacetFeature,
} from "@/lib/atproto/richTextSegments"
import {
    GUEST_SAMPLE_ENTRY_PATH,
    GUEST_VIDEO_PLAYLIST_URL,
    GUEST_VIDEO_POSTER_PATH,
    SAMPLE_OG_IMAGE_PATH,
    placeholderImage,
} from "./assets"

/**
 * 翻訳後の本文の中の文字列の位置から、facets（UTF-8 のバイト範囲）を組み立てる。
 *
 * 処理の趣旨:
 * - ゲスト表示の本文は表示言語ごとに異なるため、固定のバイト位置を書かずに、
 *   リンクにしたい文字列を本文から探して範囲を求める（`specs/post-rich-text`）。
 *
 * Input:
 * - `text`: 翻訳後の本文
 * - `parts`: リンクにする文字列と、その feature の組
 *
 * Output:
 * - 見つかった文字列の facets（本文に無い文字列は含めない）
 *
 * 例:
 * - 入力: `"見て #a"`, `[{ match: "#a", feature: { $type: "app.bsky.richtext.facet#tag", tag: "a" } }]`
 * - 出力: `[{ index: { byteStart: 7, byteEnd: 9 }, features: [...] }]`
 */
const buildGuestFacets = (
    text: string,
    parts: { match: string; feature: PostFacetFeature }[],
): PostFacet[] => {
    const encoder = new TextEncoder()
    return parts.flatMap(({ match, feature }) => {
        const position = text.indexOf(match)
        if (position < 0) return []
        const byteStart = encoder.encode(text.slice(0, position)).length
        return [
            {
                index: {
                    byteStart,
                    byteEnd: byteStart + encoder.encode(match).length,
                },
                features: [feature],
            },
        ]
    })
}

/** ゲスト表示の本文のリンクの例に使う外部URL */
const GUEST_RICH_TEXT_URL = "https://example.com/"

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
    const posts: TimelinePost[] = [
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest1",
            cid: "bafyreiguestdemo1",
            url: "https://bsky.app/profile/guest.demo/post/guest1",
            indexedAt: "2026-09-06T12:30:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.post1.text"),
            images: [],
        },
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest2",
            cid: "bafyreiguestdemo2",
            url: "https://bsky.app/profile/guest.demo/post/guest2",
            indexedAt: "2026-09-06T10:00:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.post2.text"),
            images: [
                {
                    url: placeholderImage("#f97316", t("guest.imageLabel")),
                    alt: t("guest.sampleImageAlt"),
                    cid: "bafkreiguestimage1",
                },
            ],
            skyshareEntry: {
                uri: entryAtUri("did:plc:guestdemo", "guestentry1"),
                cid: "bafyreiguestentry1",
                createdAt: "2026-09-06T10:00:00.000Z",
                sourceUri: "at://did:plc:guestdemo/app.bsky.feed.post/guest2",
                sourceCid: "bafyreiguestdemo2",
                heading: t("guest.entry1.heading"),
                caption: t("guest.entry1.postCaption"),
                visualUrl: SAMPLE_OG_IMAGE_PATH,
                webUrl: GUEST_SAMPLE_ENTRY_PATH,
            },
        },
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest3",
            cid: "bafyreiguestdemo3",
            url: "https://bsky.app/profile/guest.demo/post/guest3",
            indexedAt: "2026-09-05T09:00:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.post3.text"),
            images: [
                {
                    url: placeholderImage("#10b981", "Sample"),
                    alt: t("guest.sampleImage2Alt"),
                    cid: "bafkreiguestimage2",
                },
            ],
        },
        // 動画投稿（entry未作成）。Timelineでは poster サムネイルと再生ボタンを表示し、再生はしない。
        // 動画は事後entry作成の対象になる（グレーアウトしない）。
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-video",
            cid: "bafyreiguestvideo",
            url: "https://bsky.app/profile/guest.demo/post/guest-video",
            indexedAt: "2026-09-05T08:30:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.video.text"),
            images: [],
            video: {
                cid: "bafkreiguestvideo",
                playlistUrl: GUEST_VIDEO_PLAYLIST_URL,
                thumbnailUrl: GUEST_VIDEO_POSTER_PATH,
                alt: t("guest.video.alt"),
                aspectRatio: { width: 16, height: 9 },
            },
        },
        // 利用不可の動画（引用投稿に添付された動画）。poster を暗くして再生不可を明示し、
        // entry作成の対象外（グレーアウト）になる。
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-video-unsupported",
            cid: "bafyreiguestvideounsupported",
            url: "https://bsky.app/profile/guest.demo/post/guest-video-unsupported",
            indexedAt: "2026-09-05T08:15:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.videoUnsupported.text"),
            images: [],
            unsupportedVideo: {
                cid: "bafkreiguestvideounsupported",
                playlistUrl: GUEST_VIDEO_PLAYLIST_URL,
                thumbnailUrl: GUEST_VIDEO_POSTER_PATH,
                alt: t("guest.video.alt"),
                aspectRatio: { width: 16, height: 9 },
            },
        },
        // 画像6枚の投稿（entry未作成）。カードには全6枚が横スクロールのサムネイルで表示され、
        // 事後entry作成時に取得する画像は先頭4枚のみになる（specs/entry-visual）。
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-multi-image",
            cid: "bafyreiguestmultiimage",
            url: "https://bsky.app/profile/guest.demo/post/guest-multi-image",
            indexedAt: "2026-09-05T08:00:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.multi.text"),
            images: [
                "#ef4444",
                "#f59e0b",
                "#84cc16",
                "#06b6d4",
                "#6366f1",
                "#d946ef",
            ].map((color, index) => ({
                url: placeholderImage(color, `${index + 1}`),
                alt: t("guest.sampleImageN", { index: index + 1 }),
                cid: `bafkreiguestmulti${index + 1}`,
            })),
        },
        // 以下、Timelineのスレッドグルーピング表示（specs/timeline-api）のゲスト確認用。
        // 本文にハッシュタグ・メンション・URLを持ち、entry作成済みの投稿
        // （本文のリンク表示 `specs/post-rich-text` と、共有文のURLの除去 `specs/link-card-priority` の確認用）。
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-rich-text",
            cid: "bafyreiguestrichtext",
            url: "https://bsky.app/profile/guest.demo/post/guest-rich-text",
            indexedAt: "2026-09-04T18:00:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.richText.text", { url: GUEST_RICH_TEXT_URL }),
            facets: buildGuestFacets(
                t("guest.richText.text", { url: GUEST_RICH_TEXT_URL }),
                [
                    {
                        match: "#skyshare",
                        feature: {
                            $type: "app.bsky.richtext.facet#tag",
                            tag: "skyshare",
                        },
                    },
                    {
                        match: "@guest.demo",
                        feature: {
                            $type: "app.bsky.richtext.facet#mention",
                            did: "did:plc:guestdemo",
                        },
                    },
                    {
                        match: GUEST_RICH_TEXT_URL,
                        feature: {
                            $type: "app.bsky.richtext.facet#link",
                            uri: GUEST_RICH_TEXT_URL,
                        },
                    },
                ],
            ),
            images: [
                {
                    url: placeholderImage("#0ea5e9", t("guest.imageLabel")),
                    alt: t("guest.sampleImageAlt"),
                    cid: "bafkreiguestrichtextimg",
                },
            ],
            skyshareEntry: {
                uri: entryAtUri("did:plc:guestdemo", "guestentryrichtext"),
                cid: "bafyreiguestentryrichtext",
                createdAt: "2026-09-04T18:00:00.000Z",
                sourceUri:
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-rich-text",
                sourceCid: "bafyreiguestrichtext",
                heading: t("guest.richText.entryHeading"),
                caption: t("guest.richText.entryHeading"),
                visualUrl: SAMPLE_OG_IMAGE_PATH,
                webUrl: GUEST_SAMPLE_ENTRY_PATH,
            },
        },
        // スレッドA: entry未作成、ルート投稿(guest-thread-a-root)は画像を持たないが
        // 中間segment(guest-thread-a-mid)が画像を持つケース。事後entry作成ボタンは
        // ルート投稿のカードに表示され、Visualはguest-thread-a-midの画像から生成される
        // （FR-3、ボタンは常にルートのカードに表示・Visualはルートに最も近い画像投稿から）。
        // 配列は indexedAt 降順（新しい順）を維持する。
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-a-tail",
            cid: "bafyreiguestthreadatail",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-a-tail",
            indexedAt: "2026-09-04T12:10:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadA.tailText"),
            images: [],
        },
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-a-mid",
            cid: "bafyreiguestthreadamid",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-a-mid",
            indexedAt: "2026-09-04T12:05:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadA.midText"),
            images: [
                {
                    url: placeholderImage("#6366f1", "A2"),
                    alt: t("guest.threadA.imageAlt"),
                    cid: "bafkreiguestthreadaimg",
                },
            ],
        },
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-a-root",
            cid: "bafyreiguestthreadaroot",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-a-root",
            indexedAt: "2026-09-04T12:00:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadA.rootText"),
            images: [],
        },
        // スレッドB: ルート投稿に既にentryが紐づき、後続投稿があるケース
        // （一覧上のスレッド由来バッジ表示確認、FR-4）。
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-b-tail",
            cid: "bafyreiguestthreadbtail",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-b-tail",
            indexedAt: "2026-09-03T12:05:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadB.tailText"),
            images: [],
        },
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-b-root",
            cid: "bafyreiguestthreadbroot",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-b-root",
            indexedAt: "2026-09-03T12:00:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadB.rootText"),
            images: [
                {
                    url: placeholderImage("#ef4444", "B1"),
                    alt: t("guest.threadB.imageAlt"),
                    cid: "bafkreiguestthreadbimg",
                },
            ],
            skyshareEntry: {
                uri: entryAtUri("did:plc:guestdemo", "guestentrythreadb"),
                cid: "bafyreiguestentrythreadb",
                createdAt: "2026-09-03T12:00:00.000Z",
                sourceUri:
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-b-root",
                sourceCid: "bafyreiguestthreadbroot",
                heading: t("guest.threadB.entryHeading"),
                caption: t("guest.threadB.entryCaption"),
                visualUrl: SAMPLE_OG_IMAGE_PATH,
                webUrl: GUEST_SAMPLE_ENTRY_PATH,
            },
        },
        // スレッドC: ルート投稿(guest-thread-c-root)自身が画像を持ち、entry未作成のケース
        // （Visualがルート自身の画像から生成される正常系、FR-3）。
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-c-tail",
            cid: "bafyreiguestthreadctail",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-c-tail",
            indexedAt: "2026-09-02T12:10:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadC.tailText"),
            images: [],
        },
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-c-mid",
            cid: "bafyreiguestthreadcmid",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-c-mid",
            indexedAt: "2026-09-02T12:05:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadC.midText"),
            images: [],
        },
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-c-root",
            cid: "bafyreiguestthreadcroot",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-c-root",
            indexedAt: "2026-09-02T12:00:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadC.rootText"),
            images: [
                {
                    url: placeholderImage("#0ea5e9", "C1"),
                    alt: t("guest.threadC.imageAlt"),
                    cid: "bafkreiguestthreadcimg",
                },
            ],
        },
        // スレッドD: 旧実装で作成されたentry（スレッドの返信側にだけentryが付く）を再現する。
        // ルートは画像を持たないため、事後entry作成ボタンの表示条件には影響しない。
        // 削除確認ダイアログでは「リンク・Bluesky投稿を削除」が無効化される（FR-5）。
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-mid",
            cid: "bafyreiguestthreaddmid",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-d-mid",
            indexedAt: "2026-09-01T12:05:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadD.midText"),
            images: [],
            skyshareEntry: {
                uri: entryAtUri("did:plc:guestdemo", "guestentrythreadd"),
                cid: "bafyreiguestentrythreadd",
                createdAt: "2026-09-01T12:05:00.000Z",
                sourceUri:
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-mid",
                sourceCid: "bafyreiguestthreaddmid",
                heading: t("guest.threadD.entryHeading"),
                caption: t("guest.threadD.entryCaption"),
                visualUrl: SAMPLE_OG_IMAGE_PATH,
                webUrl: GUEST_SAMPLE_ENTRY_PATH,
            },
        },
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-root",
            cid: "bafyreiguestthreaddroot",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-d-root",
            indexedAt: "2026-09-01T12:00:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadD.rootText"),
            images: [],
        },
        // 削除範囲を判定できない場合（Bluesky投稿の状態を確認できない）を再現する単独投稿。
        // スレッドE: どの投稿も画像・動画・entryを持たないケース
        // （スレッド全体のグレーアウト、`specs/timeline`）。
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-e-tail",
            cid: "bafyreiguestthreadetail",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-e-tail",
            indexedAt: "2026-08-31T12:05:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadE.tailText"),
            images: [],
        },
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-e-root",
            cid: "bafyreiguestthreaderoot",
            url: "https://bsky.app/profile/guest.demo/post/guest-thread-e-root",
            indexedAt: "2026-08-31T12:00:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.threadE.rootText"),
            images: [],
        },
        {
            uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-unknown",
            cid: "bafyreiguestunknown",
            url: "https://bsky.app/profile/guest.demo/post/guest-unknown",
            indexedAt: "2026-08-31T12:00:00.000Z",
            author: {
                did: "did:plc:guestdemo",
                handle: "guest.demo",
                displayName: t("guest.userName"),
            },
            text: t("guest.unknown.text"),
            images: [],
            skyshareEntry: {
                uri: entryAtUri("did:plc:guestdemo", "guestentryunknown"),
                cid: "bafyreiguestentryunknown",
                createdAt: "2026-08-31T12:00:00.000Z",
                sourceUri:
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-unknown",
                sourceCid: "bafyreiguestunknown",
                heading: t("guest.unknown.entryHeading"),
                caption: t("guest.unknown.entryCaption"),
                visualUrl: SAMPLE_OG_IMAGE_PATH,
                webUrl: GUEST_SAMPLE_ENTRY_PATH,
            },
        },
    ]
    return posts
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
     * バックエンドが`buildTimelineThreads`で確定させる形（`specs/timeline-api`）を、
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
