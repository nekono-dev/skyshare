/** ゲスト表示用の Entry と削除確認データを組み立てる。 */
import type { EntryDeleteScope } from "@/lib/timeline/resolveEntryDeleteScope"
import type { TimelinePost, TimelineSkyshareEntry } from "@/lib/timeline/posts"
import type { Translator } from "@/lib/i18n/translate"
import { entryAtUri } from "@/lib/atproto/nsid"
import {
    GUEST_SAMPLE_ENTRY_PATH,
    SAMPLE_OG_IMAGE_PATH,
    SAMPLE_ORPHANED_OG_IMAGE_PATH,
} from "./assets"
import { findGuestPost } from "./posts"

/**
 * ゲスト表示のEntry削除確認ダイアログが参照する、ダミーentryの`sourceUri`ごとの
 * 削除範囲判定テーブルを、投稿の一覧から組み立てる。
 *
 * Input:
 * - `posts`: `buildGuestPosts` の結果
 *
 * Output:
 * - `sourceUri` → 削除範囲（実際の `getPostThread` は呼ばない）
 */
export const buildGuestDeleteScopes = (
    posts: readonly TimelinePost[],
): Record<string, EntryDeleteScope> => {
    /** `posts`からidでダミー投稿を引く（`deleteScopes`の一覧表示用）。 */
    const guestPost = (id: string): TimelinePost =>
        findGuestPost(posts, `at://did:plc:guestdemo/app.bsky.feed.post/${id}`)

    /**
     * ゲスト表示のEntry削除確認ダイアログが参照する、ダミーentryの`sourceUri`ごとの
     * 削除範囲判定結果。実際の`getPostThread`は呼ばない。
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
    return deleteScopes
}

/**
 * ゲスト表示用のEntry（動画を含む）を、指定言語の文言で組み立てる。
 *
 * Input:
 * - `t`: 表示言語の翻訳関数
 *
 * Output:
 * - ダミーのEntryの一覧
 */
export const buildGuestEntries = (
    t: Translator["t"],
): TimelineSkyshareEntry[] => {
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
        // 返信のカードにはツールバーが無いため、返信に紐づくEntryは一覧から削除を試せるようにする。
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
    return entries
}
