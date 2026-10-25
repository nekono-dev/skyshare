/**
 * ゲストモード（URLクエリパラメータ `?guest`、`@/lib/guestMode` 参照）向けのダミーデータ。
 *
 * 責務と処理概要:
 * - ログイン不要の見た目確認用に、`TimelinePost`/`TimelineSkyshareEntry` と同じ形の
 *   固定データを、表示言語ごとに組み立てて提供する（Timeline/EntryList が未ログイン時の代替表示として使う）。
 * - 実際の Bluesky API を叩かないよう、画像・アバターは data URI の SVG で完結させる。
 *   ただしEntryのOGP画像（`visualUrl`）はOGP取得ツールがdata URI SVGを画像として
 *   解釈できずリンクカードが生成されないため、`public/materials/`配下に事前生成した
 *   PNG（`SAMPLE_OG_IMAGE_PATH`等）へのパスを使う。
 */
import type {
    ThreadGroup,
    TimelinePost,
    TimelineSkyshareEntry,
} from "@/lib/entry/posts"
import type { EntryDeleteScope } from "@/lib/entry/resolveEntryDeleteScope"
import type { Locale } from "@/lib/i18n/locale"
import { entryAtUri } from "@/lib/atproto/nsid"
import type { Translator } from "@/lib/i18n/translate"
import type {
    PostFacet,
    PostFacetFeature,
} from "@/lib/atproto/richTextSegments"

/**
 * 単色背景 + イニシャル文字の簡易アバター/サムネイル画像を data URI で生成する。
 *
 * Input:
 * - `bg`: 背景色（CSSカラー）
 * - `label`: 中央に描く1〜2文字程度のラベル
 * - `size`: 一辺の px サイズ
 *
 * Output:
 * - `data:image/svg+xml,...` 形式の画像URL
 */
const placeholderImage = (bg: string, label: string): string => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${1200}" height="${630}"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="${Math.floor(630 / 3)}" fill="#fff">${label}</text></svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// sample.astroのOGP画像（og:image/twitter:image）用パス。
// data URI SVGはOGP取得ツールが画像として解釈できずリンクカードが表示されないため、
// `placeholderImage`と同内容をPNG化して`public/materials/`に配置したものを使う。
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

const SAMPLE_OG_IMAGE_PATH = "/materials/sample-og.png"
const SAMPLE_ORPHANED_OG_IMAGE_PATH = "/materials/sample-orphaned-og.png"

// 動画投稿のダミー。poster は静的画像、再生URLは実在しない（再生するとエラー表示になる）。
const GUEST_VIDEO_POSTER_PATH = "/materials/sample-video-poster.png"
const GUEST_VIDEO_PLAYLIST_URL =
    "https://video.bsky.app/watch/did%3Aplc%3Aguestdemo/bafkreiguestvideo/playlist.m3u8"

/**
 * ゲストモードの「Entryを開く」から実際に遷移できるサンプルEntry詳細ページ
 * （`src/pages/entries/sample.astro`）へのパス。
 * バックエンドの実レコードに依存しない静的ページのため、ダミーEntryのAT URIから
 * 通常経路で算出されるパス（存在しないレコードを指してしまう）の代わりにこちらを使う。
 * orphanedなダミーEntryも同じページへ遷移させる（サンプルページは1枚に集約している）。
 */
export const GUEST_SAMPLE_ENTRY_PATH = `${import.meta.env.SITE}/entries/sample/`

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

    /** `posts`からuriで1件取り出す（`threads`組み立て専用）。 */
    const findGuestPost = (uri: string): TimelinePost => {
        const post = posts.find(candidate => candidate.uri === uri)
        if (!post) {
            throw new Error(`guestDummyPosts.ts: post not found: ${uri}`)
        }
        return post
    }

    /**
     * `GET /v2/entries`のスレッド構造化済みレスポンス（`threads`）を模したゲスト表示用データ。
     * バックエンドが`buildTimelineThreads`で確定させる形（`specs/timeline-api`）を、
     * `posts`の実体を再利用してあらかじめ手書きでネストしたもの。
     */
    const threads: ThreadGroup[] = [
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest1",
            ),
            replies: [],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest2",
            ),
            replies: [],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest3",
            ),
            replies: [],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-video",
            ),
            replies: [],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-video-unsupported",
            ),
            replies: [],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-multi-image",
            ),
            replies: [],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-rich-text",
            ),
            replies: [],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-a-root",
            ),
            replies: [
                findGuestPost(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-a-mid",
                ),
                findGuestPost(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-a-tail",
                ),
            ],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-b-root",
            ),
            replies: [
                findGuestPost(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-b-tail",
                ),
            ],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-c-root",
            ),
            replies: [
                findGuestPost(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-c-mid",
                ),
                findGuestPost(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-c-tail",
                ),
            ],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-root",
            ),
            replies: [
                findGuestPost(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-mid",
                ),
            ],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-e-root",
            ),
            replies: [
                findGuestPost(
                    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-e-tail",
                ),
            ],
        },
        {
            rootPost: findGuestPost(
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-unknown",
            ),
            replies: [],
        },
    ]

    /** `posts`からidでダミー投稿を引く（`deleteScopes`の一覧表示用）。 */
    const guestPost = (id: string): TimelinePost =>
        findGuestPost(`at://did:plc:guestdemo/app.bsky.feed.post/${id}`)

    /**
     * ゲスト表示のEntry削除確認ダイアログが参照する、ダミーentryの`sourceUri`ごとの
     * 削除範囲判定結果（`specs/entry-delete-dialog`）。実際の`getPostThread`は呼ばない。
     */
    const deleteScopes: Record<string, EntryDeleteScope> = {
        "at://did:plc:guestdemo/app.bsky.feed.post/guest2": {
            kind: "deletable",
            posts: [guestPost("guest2")],
        },
        "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-b-root": {
            kind: "deletable",
            posts: [
                guestPost("guest-thread-b-root"),
                guestPost("guest-thread-b-tail"),
            ],
        },
        "at://did:plc:guestdemo/app.bsky.feed.post/guest-rich-text": {
            kind: "deletable",
            posts: [guestPost("guest-rich-text")],
        },
        "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-mid": {
            kind: "legacy",
        },
        "at://did:plc:guestdemo/app.bsky.feed.post/guest-unknown": {
            kind: "unknown",
        },
    }

    const entries: TimelineSkyshareEntry[] = [
        {
            uri: entryAtUri("did:plc:guestdemo", "guestentry1"),
            cid: "bafyreiguestentry1",
            createdAt: "2026-09-06T10:00:00.000Z",
            sourceUri: "at://did:plc:guestdemo/app.bsky.feed.post/guest2",
            sourceCid: "bafyreiguestdemo2",
            heading: t("guest.entry1.heading"),
            caption: t("guest.entry1.caption"),
            visualUrl: SAMPLE_OG_IMAGE_PATH,
            webUrl: GUEST_SAMPLE_ENTRY_PATH,
        },
        {
            uri: entryAtUri("did:plc:guestdemo", "guestentry2"),
            cid: "bafyreiguestentry2",
            createdAt: "2026-09-05T08:00:00.000Z",
            sourceUri: "at://did:plc:guestdemo/app.bsky.feed.post/guest3",
            sourceCid: "bafyreiguestdemo3",
            heading: t("guest.entry2.heading"),
            caption: t("guest.entry2.caption"),
            visualUrl: SAMPLE_ORPHANED_OG_IMAGE_PATH,
            webUrl: GUEST_SAMPLE_ENTRY_PATH,
            orphaned: true,
        },
        // スレッドDの旧entry。返信のカードにはツールバーが無いため、一覧から削除を試せるようにする。
        {
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
    ]

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

/**
 * ゲスト表示用に`sourceUri`から削除範囲を引く。テーブルにないentryは`unknown`。
 *
 * Input:
 * - `sourceUri`: ダミーentryの`source`投稿のAT URI
 * - `translator`: 表示言語の翻訳関数（削除予定投稿の本文を言語に合わせるため）
 *
 * Output:
 * - `EntryDeleteScope`
 */
export const resolveGuestDeleteScope = (
    sourceUri: string,
    translator: Translator,
): EntryDeleteScope =>
    getGuestDummyData(translator).deleteScopes[sourceUri] ?? {
        kind: "unknown",
    }
