/**
 * ゲストモード（URLクエリパラメータ `?guest`、`@/lib/guestMode` 参照）向けのダミーデータ。
 *
 * 責務と処理概要:
 * - ログイン不要の見た目確認用に、`TimelinePost`/`TimelineSkyshareEntry` と同じ形の
 *   固定データを提供する（Timeline/EntryList が未ログイン時の代替表示として使う）。
 * - 実際の Bluesky API を叩かないよう、画像・アバターは data URI の SVG で完結させる。
 *   ただしEntryのOGP画像（`visualUrl`）はOGP取得ツールがdata URI SVGを画像として
 *   解釈できずリンクカードが生成されないため、`public/materials/`配下に事前生成した
 *   PNG（`SAMPLE_OG_IMAGE_PATH`等）へのパスを使う。
 */
import type { TimelinePost, TimelineSkyshareEntry } from "@/lib/entry/posts"

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

// sample.astro/sample-orphaned.astroのOGP画像（og:image/twitter:image）用パス。
// data URI SVGはOGP取得ツールが画像として解釈できずリンクカードが表示されないため、
// `placeholderImage`と同内容をPNG化して`public/materials/`に配置したものを使う。
const SAMPLE_OG_IMAGE_PATH = "/materials/sample-og.png"
const SAMPLE_ORPHANED_OG_IMAGE_PATH = "/materials/sample-orphaned-og.png"

/**
 * ゲストモードの「Entryを開く」から実際に遷移できるサンプルEntry詳細ページ
 * （`src/pages/entries/sample.astro`/`sample-orphaned.astro`）へのパス。
 * バックエンドの実レコードに依存しない静的ページのため、ダミーEntryのAT URIから
 * 通常経路で算出されるパス（存在しないレコードを指してしまう）の代わりにこちらを使う。
 * 元投稿の有無（orphaned）はクエリパラメータではなく専用ページで表す。
 */
export const GUEST_SAMPLE_ENTRY_PATH = `${import.meta.env.SITE}/entries/sample/`
export const GUEST_SAMPLE_ENTRY_ORPHANED_PATH = `${import.meta.env.SITE}/entries/sample-orphaned/`

// SSR/CSRで同じHTMLになる必要があるため（Reactのhydration mismatch回避）、
// `Date.now()` 等の実行タイミング依存の値ではなく固定値を使う。
export const GUEST_DUMMY_POSTS: TimelinePost[] = [
    {
        uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest1",
        cid: "bafyreiguestdemo1",
        url: "https://bsky.app/profile/guest.demo/post/guest1",
        indexedAt: "2026-09-06T12:30:00.000Z",
        author: {
            did: "did:plc:guestdemo",
            handle: "guest.demo",
            displayName: "ゲストユーザー",
        },
        text: "これはゲスト用デモ表示のサンプル投稿です。",
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
            displayName: "ゲストユーザー",
        },
        text: "画像投稿で、URL発行を行った際の表示です。（共有ボタンやポップアップボタンで再度他SNSへ投稿可能）",
        images: [
            {
                url: placeholderImage("#f97316", "画像"),
                alt: "サンプル画像",
                cid: "bafkreiguestimage1",
            },
        ],
        skyshareEntry: {
            uri: "at://did:plc:guestdemo/dev.nekono.skyshare.entry/guestentry1",
            cid: "bafyreiguestentry1",
            createdAt: "2026-09-06T10:00:00.000Z",
            sourceUri: "at://did:plc:guestdemo/app.bsky.feed.post/guest2",
            sourceCid: "bafyreiguestdemo2",
            heading: "サンプルEntry",
            caption: "ゲスト表示用のダミーEntryです。",
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
            displayName: "ゲストユーザー",
        },
        text: "画像投稿で、URL発行をしなかった場合の表示です。（あとからSkyshare Entry作成可能）",
        images: [
            {
                url: placeholderImage("#10b981", "Sample"),
                alt: "サンプル画像2",
                cid: "bafkreiguestimage2",
            },
        ],
    },
]

export const GUEST_DUMMY_ENTRIES: TimelineSkyshareEntry[] = [
    {
        uri: "at://did:plc:guestdemo/dev.nekono.skyshare.entry/guestentry1",
        cid: "bafyreiguestentry1",
        createdAt: "2026-09-06T10:00:00.000Z",
        sourceUri: "at://did:plc:guestdemo/app.bsky.feed.post/guest2",
        sourceCid: "bafyreiguestdemo2",
        heading: "サンプルEntry",
        caption:
            "画像投稿で、URL発行を行った際の表示です。（共有ボタンやポップアップボタンで再度他SNSへ投稿可能）",
        visualUrl: SAMPLE_OG_IMAGE_PATH,
        webUrl: GUEST_SAMPLE_ENTRY_PATH,
    },
    {
        uri: "at://did:plc:guestdemo/dev.nekono.skyshare.entry/guestentry2",
        cid: "bafyreiguestentry2",
        createdAt: "2026-09-05T08:00:00.000Z",
        sourceUri: "at://did:plc:guestdemo/app.bsky.feed.post/guest3",
        sourceCid: "bafyreiguestdemo3",
        heading: "元投稿削除済みのサンプル",
        caption:
            "紐づくBluesky投稿が削除された状態のサンプルです。Skyshare Entryが削除されない限りはURL参照可能です。",
        visualUrl: SAMPLE_ORPHANED_OG_IMAGE_PATH,
        webUrl: GUEST_SAMPLE_ENTRY_ORPHANED_PATH,
        orphaned: true,
    },
]
