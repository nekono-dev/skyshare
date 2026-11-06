/**
 * ゲスト表示用のダミーデータのうち、単独の投稿（スレッドに属さない投稿）。
 *
 * 処理の趣旨:
 * - `guest1`〜`guest-rich-text` の投稿を、指定言語の文言で返すだけのデータ。
 * - 判断の関数（uri での検索・スレッドの組み立て）は含まない。`posts.ts` に置く。
 */
import { entryAtUri } from "@/lib/atproto/nsid"
import type { Translator } from "@/lib/i18n/translate"
import type { TimelinePost } from "@/lib/timeline/posts"
import {
    GUEST_SAMPLE_ENTRY_PATH,
    GUEST_VIDEO_PLAYLIST_URL,
    GUEST_VIDEO_POSTER_PATH,
    SAMPLE_OG_IMAGE_PATH,
    placeholderImage,
} from "./assets"
import { buildGuestFacets } from "./postFacets"

/** ゲスト表示の本文のリンクの例に使う外部URL */
const GUEST_RICH_TEXT_URL = "https://example.com/"

/**
 * ゲスト表示用の単独の投稿の一覧を、指定言語の文言で組み立てる。
 *
 * Input:
 * - `t`: 表示言語の翻訳関数
 *
 * Output:
 * - 単独の投稿の一覧（`guest1`〜`guest-rich-text`、この順）
 */
export const buildGuestBasicPosts = (t: Translator["t"]): TimelinePost[] => {
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
    ]
    return posts
}
