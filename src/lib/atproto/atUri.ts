/**
 * AT URI（`at://<repo>/<collection>/<rkey>`）を分解・検証する。
 *
 * - 依存を持たない（正規表現だけで分解する）。
 */

/**
 * at:// URI を repo / collection / rkey へ分解する。
 *
 * Input:
 * - `uri`: at:// URI（`at://{repo}/{collection}/{rkey}` 形式）
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

/**
 * at:// URI を分解した上で、期待する collection・repo（所有者）と一致するか検証する。
 *
 * - クライアントから渡された URI を信用せず、他人のレコードを誤って参照・操作しないよう、collection と repo（DID）を確認する。
 *
 * Input:
 * - `uri`: at:// URI
 * - `expectedCollection`: 期待する collection（例: `app.bsky.feed.post`）
 * - `expectedRepo`: 期待する repo（通常は session の DID）
 *
 * Output:
 * - 成功時: `parseAtUri` と同じ `{ repo, collection, rkey }`
 * - 失敗時（形式不正・collection不一致・repo不一致）: `undefined`
 *
 * 例:
 * - 入力: `parseOwnedAtUri("at://did:plc:abc/app.bsky.feed.post/3lxyz", "app.bsky.feed.post", "did:plc:abc")`
 * - 出力: `{ repo: "did:plc:abc", collection: "app.bsky.feed.post", rkey: "3lxyz" }`
 * - 入力: 同 URI + `expectedRepo: "did:plc:other"`
 * - 出力: `undefined`
 */
export const parseOwnedAtUri = (
    uri: string,
    expectedCollection: string,
    expectedRepo: string,
): { repo: string; collection: string; rkey: string } | undefined => {
    const parsed = parseAtUri(uri)
    if (
        !parsed ||
        parsed.collection !== expectedCollection ||
        parsed.repo !== expectedRepo
    ) {
        return undefined
    }
    return parsed
}
