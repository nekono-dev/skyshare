/**
 * Skyshare / Bluesky の URL 生成・解析ユーティリティ群。
 *
 * 責務と処理概要:
 * - 投稿表示用 URL や CDN 画像 URL を生成する。
 * - at:// URI 文字列を repo/collection/rkey に分解する。
 */

import { siteOrigin } from "@/vars"

/**
 * Bluesky Web アプリ上の投稿 URL を生成する。
 *
 * Input:
 * - `handle`: ユーザーの handle または DID
 * - `rkey`: 投稿レコードキー
 *
 * Output:
 * - `https://bsky.app/profile/{handle}/post/{rkey}` 形式の URL
 *
 * 例:
 * - 入力: `("alice.bsky.social", "3lxyz")`
 * - 出力: `"https://bsky.app/profile/alice.bsky.social/post/3lxyz"`
 */
export const bskyPostUrlgen = (handle: string, rkey: string) => {
    return `https://bsky.app/profile/${handle}/post/${rkey}`
}

/**
 * Bluesky CDN の画像 URL を生成する。
 *
 * 処理の趣旨:
 * - `repoDid` と `ref` は `/` 等を含みうるため、URL セグメントとして安全に扱うため `encodeURIComponent` する。
 *
 * Input:
 * - `repoDid`: 画像が属する repo DID
 * - `ref`: Blob 参照値
 *
 * Output:
 * - CDN の feed_fullsize 画像 URL
 *
 * 例:
 * - 入力: `("did:plc:abc", "bafkre...")`
 * - 出力: `"https://cdn.bsky.app/img/feed_fullsize/plain/did%3Aplc%3Aabc/bafkre..."`
 */
export const bskyCdnUrlgen = (repoDid: string, ref: string) => {
    return `https://cdn.bsky.app/img/feed_fullsize/plain/${encodeURIComponent(
        repoDid,
    )}/${encodeURIComponent(ref)}`
}

/**
 * Skyshare 上のエントリページのパスを生成する。
 *
 * 処理の趣旨:
 * - サイト内リンクは常にこのパスを使う。現在表示中のオリジン（dev/本番いずれも）に
 *   対して相対的にリンクできるため、dev サーバ実行時に本番ドメインへ遷移する事故を
 *   構造的に防げる。絶対URLが要る場合（外部サービスへの共有等）のみ `skyshareEntryUrlgen`
 *   でこのパスをラップする。
 *
 * Input:
 * - `handle`: 投稿者 handle
 * - `rkey`: 投稿レコードキー
 *
 * Output:
 * - `/entries/{handle}@{rkey}/` 形式のパス
 *
 * 例:
 * - 入力: `("alice.bsky.social", "3lxyz")`
 * - 出力: `"/entries/alice.bsky.social@3lxyz/"`
 */
export const skyshareEntryPath = (handle: string, rkey: string) => {
    return `/entries/${handle}@${rkey}/`
}

/**
 * Skyshare 上のエントリページ URL（絶対URL）を生成する。
 *
 * 処理の趣旨:
 * - `siteOrigin`（`vars.ts`・本番ドメイン）は本番ドメイン固定のため、この関数が返す URL は
 *   dev サーバ実行時であっても常に本番ドメインを指す。X共有等、外部サービスへ
 *   渡す絶対URLが本当に必要な箇所でのみ使うこと。同一オリジン内のリンクには
 *   `skyshareEntryPath` を直接使う。
 *
 * Input:
 * - `handle`: 投稿者 handle
 * - `rkey`: 投稿レコードキー
 *
 * Output:
 * - `SITE/entries/{handle}@{rkey}/` 形式の URL
 *
 * 例:
 * - 入力: `("alice.bsky.social", "3lxyz")`
 * - 出力: `"https://skyshare.example/entries/alice.bsky.social@3lxyz/"`
 */
export const skyshareEntryUrlgen = (handle: string, rkey: string) => {
    return `${siteOrigin}${skyshareEntryPath(handle, rkey)}`
}

/**
 * blob 参照から CID 文字列を取り出す。取り出せなければ undefined。
 */
export const toCidString = (ref: unknown): string | undefined => {
    if (typeof ref === "string") return ref
    if (ref && typeof ref === "object") {
        const maybeLink = (ref as Record<string, unknown>)["$link"]
        if (typeof maybeLink === "string") return maybeLink
        if (
            typeof (ref as { toString?: () => string }).toString === "function"
        ) {
            const value = (ref as { toString: () => string }).toString()
            if (
                typeof value === "string" &&
                value.length > 0 &&
                value !== "[object Object]"
            ) {
                return value
            }
        }
    }
    return
}

export const blobToCdnUrl = (
    repoDid: string,
    blob?: {
        ref?: unknown
        mimeType?: string
    },
): string | undefined => {
    if (!blob) return
    const ref = toCidString(blob.ref)
    if (!ref) return
    return bskyCdnUrlgen(repoDid, ref)
}
