/**
 * AT URI の解析（atproto の共通部品）。
 *
 * 責務と処理概要:
 * - `at://<repo>/<collection>/<rkey>` を分解する。所有者と収集の一致を判定する関数を含む。
 * - 投稿・Entry・タイムラインのいずれからも使うため、atproto に置く（entry は atproto を参照する）。
 *
 * 実装上の制約:
 * - 依存を持たない（正規表現だけで分解する）。
 */

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

/**
 * at:// URI を分解した上で、期待する collection・repo（所有者）と一致するか検証する。
 *
 * 処理の趣旨:
 * - クライアントから渡された URI をそのまま信用せず、コレクション種別と
 *   repo（DID）が期待通りであることを確認してから他人のレコードを誤って
 *   参照・操作しないようにする。
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
