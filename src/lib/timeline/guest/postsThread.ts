/**
 * ゲスト表示用のダミーデータのうち、スレッドの投稿と不明な投稿。
 *
 * 処理の趣旨:
 * - スレッドA〜E の root・mid・tail と `guest-unknown` の投稿を、指定言語の文言で返すだけのデータ。
 * - 判断の関数（uri での検索・スレッドの組み立て）は含まない。`posts.ts` に置く。
 */
import { entryAtUri } from "@/lib/atproto/nsid"
import type { Translator } from "@/lib/i18n/translate"
import type { TimelinePost } from "@/lib/timeline/posts"
import {
    GUEST_SAMPLE_ENTRY_PATH,
    SAMPLE_OG_IMAGE_PATH,
    placeholderImage,
} from "./assets"

/**
 * ゲスト表示用のスレッドの投稿と不明な投稿の一覧を、指定言語の文言で組み立てる。
 *
 * Input:
 * - `t`: 表示言語の翻訳関数
 *
 * Output:
 * - スレッドの投稿と `guest-unknown` の一覧（`indexedAt` 降順の並びを保つ）
 */
export const buildGuestThreadPosts = (t: Translator["t"]): TimelinePost[] => {
    const posts: TimelinePost[] = [
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
