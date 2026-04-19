/**
 * Skyshare / Bluesky の URL 生成・解析ユーティリティ群。
 *
 * 責務と処理概要:
 * - 投稿表示用 URL や CDN 画像 URL を生成する。
 * - at:// URI 文字列を repo/collection/rkey に分解する。
 */

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
 * Skyshare 上のエントリページ URL を生成する。
 *
 * Input:
 * - `handle`: 投稿者 handle
 * - `rkey`: 投稿レコードキー
 *
 * Output:
 * - `SITE/entries/{handle}@{rkey}` 形式の URL
 *
 * 例:
 * - 入力: `("alice.bsky.social", "3lxyz")`
 * - 出力: `"https://skyshare.example/entries/alice.bsky.social@3lxyz"`
 */
export const skyshareEntryUrlgen = (handle: string, rkey: string) => {
    return `${import.meta.env.SITE}/entries/${handle}@${rkey}`
}

/**
 * at:// URI を repo / collection / rkey へ分解する。
 *
 * 想定する入力形状(最小要件):
 * - `uri` は `at://{repo}/{collection}/{rkey}` 形式の文字列
 *
 * 処理の趣旨:
 * - 正規表現で 3 セグメントを厳密に抽出し、形式不一致は `undefined` を返す。
 *
 * Input:
 * - `uri`: at:// URI
 *
 * Output:
 * - 成功時: `{ repo, collection, rkey }`
 * - 失敗時: `undefined`
 *
 * 例:
 * - 入力: `"at://did:plc:abc/app.bsky.feed.post/3lxyz"`
 * - 出力: `{ repo: "did:plc:abc", collection: "app.bsky.feed.post", rkey: "3lxyz" }`
 */
export const parseAtUri = (
    uri: string,
): { repo: string; collection: string; rkey: string } | undefined => {
    const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/?#]+)$/)
    if (!match) return
    return { repo: match[1], collection: match[2], rkey: match[3] }
}
