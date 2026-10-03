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
import type {
    ThreadGroup,
    TimelinePost,
    TimelineSkyshareEntry,
} from "@/lib/entry/posts"
import type { EntryDeleteScope } from "@/lib/entry/resolveEntryDeleteScope"

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
    // 画像6枚の投稿（entry未作成）。カードには先頭4枚のサムネイルと「+2」が表示され、
    // 事後entry作成時に取得する画像は先頭4枚のみになる（specs/multiimage FR-3・FR-5）。
    {
        uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-multi-image",
        cid: "bafyreiguestmultiimage",
        url: "https://bsky.app/profile/guest.demo/post/guest-multi-image",
        indexedAt: "2026-09-05T08:00:00.000Z",
        author: {
            did: "did:plc:guestdemo",
            handle: "guest.demo",
            displayName: "ゲストユーザー",
        },
        text: "画像を6枚添付した投稿の表示です。（サムネイルは先頭4枚＋残り枚数）",
        images: [
            "#ef4444",
            "#f59e0b",
            "#84cc16",
            "#06b6d4",
            "#6366f1",
            "#d946ef",
        ].map((color, index) => ({
            url: placeholderImage(color, `${index + 1}`),
            alt: `サンプル画像${index + 1}`,
            cid: `bafkreiguestmulti${index + 1}`,
        })),
    },
    // 以下、Timelineのスレッドグルーピング表示（specs/timeline）のゲスト確認用。
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
            displayName: "ゲストユーザー",
        },
        text: "スレッドA・3件目です。",
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
            displayName: "ゲストユーザー",
        },
        text: "スレッドA・2件目です。画像付きでentry未作成です。",
        images: [
            {
                url: placeholderImage("#6366f1", "A2"),
                alt: "スレッドAサンプル画像",
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
            displayName: "ゲストユーザー",
        },
        text: "スレッドA・1件目（ルート、画像なし）です。",
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
            displayName: "ゲストユーザー",
        },
        text: "スレッドB・2件目です。",
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
            displayName: "ゲストユーザー",
        },
        text: "スレッドB・1件目（ルート、entry作成済み）です。",
        images: [
            {
                url: placeholderImage("#ef4444", "B1"),
                alt: "スレッドBサンプル画像",
                cid: "bafkreiguestthreadbimg",
            },
        ],
        skyshareEntry: {
            uri: "at://did:plc:guestdemo/dev.nekono.skyshare.entry/guestentrythreadb",
            cid: "bafyreiguestentrythreadb",
            createdAt: "2026-09-03T12:00:00.000Z",
            sourceUri:
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-b-root",
            sourceCid: "bafyreiguestthreadbroot",
            heading: "スレッドBサンプルEntry",
            caption: "ゲスト表示用のスレッド由来ダミーEntryです。",
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
            displayName: "ゲストユーザー",
        },
        text: "スレッドC・3件目です。",
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
            displayName: "ゲストユーザー",
        },
        text: "スレッドC・2件目です。",
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
            displayName: "ゲストユーザー",
        },
        text: "スレッドC・1件目（ルート、画像あり）です。",
        images: [
            {
                url: placeholderImage("#0ea5e9", "C1"),
                alt: "スレッドCサンプル画像",
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
            displayName: "ゲストユーザー",
        },
        text: "スレッドD・2件目です。旧仕様でこの投稿にentryが作成されています。",
        images: [],
        skyshareEntry: {
            uri: "at://did:plc:guestdemo/dev.nekono.skyshare.entry/guestentrythreadd",
            cid: "bafyreiguestentrythreadd",
            createdAt: "2026-09-01T12:05:00.000Z",
            sourceUri:
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-mid",
            sourceCid: "bafyreiguestthreaddmid",
            heading: "スレッドDサンプルEntry",
            caption: "ゲスト表示用の旧仕様ダミーEntryです。",
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
            displayName: "ゲストユーザー",
        },
        text: "スレッドD・1件目（ルート、画像なし）です。",
        images: [],
    },
    // 削除範囲を判定できない場合（Bluesky投稿の状態を確認できない）を再現する単独投稿。
    {
        uri: "at://did:plc:guestdemo/app.bsky.feed.post/guest-unknown",
        cid: "bafyreiguestunknown",
        url: "https://bsky.app/profile/guest.demo/post/guest-unknown",
        indexedAt: "2026-08-31T12:00:00.000Z",
        author: {
            did: "did:plc:guestdemo",
            handle: "guest.demo",
            displayName: "ゲストユーザー",
        },
        text: "Bluesky投稿の状態を確認できない場合の表示確認用の投稿です。",
        images: [],
        skyshareEntry: {
            uri: "at://did:plc:guestdemo/dev.nekono.skyshare.entry/guestentryunknown",
            cid: "bafyreiguestentryunknown",
            createdAt: "2026-08-31T12:00:00.000Z",
            sourceUri:
                "at://did:plc:guestdemo/app.bsky.feed.post/guest-unknown",
            sourceCid: "bafyreiguestunknown",
            heading: "判定不能サンプルEntry",
            caption: "ゲスト表示用の判定不能ダミーEntryです。",
            visualUrl: SAMPLE_OG_IMAGE_PATH,
            webUrl: GUEST_SAMPLE_ENTRY_PATH,
        },
    },
]

/** `GUEST_DUMMY_POSTS`からuriで1件取り出す（`GUEST_DUMMY_THREADS`組み立て専用）。 */
const findGuestPost = (uri: string): TimelinePost => {
    const post = GUEST_DUMMY_POSTS.find(candidate => candidate.uri === uri)
    if (!post) {
        throw new Error(`guestDummyPosts.ts: post not found: ${uri}`)
    }
    return post
}

/**
 * `GET /v2/entries`のスレッド構造化済みレスポンス（`threads`）を模したゲスト表示用データ。
 * バックエンドが`buildTimelineThreads`で確定させる形（`specs/timeline/design.md §1`）を、
 * `GUEST_DUMMY_POSTS`の実体を再利用してあらかじめ手書きでネストしたもの。
 */
export const GUEST_DUMMY_THREADS: ThreadGroup[] = [
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
            "at://did:plc:guestdemo/app.bsky.feed.post/guest-multi-image",
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
            "at://did:plc:guestdemo/app.bsky.feed.post/guest-unknown",
        ),
        replies: [],
    },
]

/** `GUEST_DUMMY_POSTS`からidでダミー投稿を引く（`GUEST_DELETE_SCOPES`の一覧表示用）。 */
const guestPost = (id: string): TimelinePost =>
    findGuestPost(`at://did:plc:guestdemo/app.bsky.feed.post/${id}`)

/**
 * ゲスト表示のEntry削除確認ダイアログが参照する、ダミーentryの`sourceUri`ごとの
 * 削除範囲判定結果（`specs/entry/frontend/design.md §3.4.4`）。実際の`getPostThread`は呼ばない。
 */
export const GUEST_DELETE_SCOPES: Record<string, EntryDeleteScope> = {
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
    "at://did:plc:guestdemo/app.bsky.feed.post/guest-thread-d-mid": {
        kind: "legacy",
    },
    "at://did:plc:guestdemo/app.bsky.feed.post/guest-unknown": {
        kind: "unknown",
    },
}

/**
 * ゲスト表示用に`sourceUri`から削除範囲を引く。テーブルにないentryは`unknown`。
 *
 * Input:
 * - `sourceUri`: ダミーentryの`source`投稿のAT URI
 *
 * Output:
 * - `EntryDeleteScope`
 */
export const resolveGuestDeleteScope = (sourceUri: string): EntryDeleteScope =>
    GUEST_DELETE_SCOPES[sourceUri] ?? { kind: "unknown" }

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
