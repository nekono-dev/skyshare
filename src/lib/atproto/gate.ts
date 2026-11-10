/**
 * 返信可否（threadgate）と引用可否（postgate）の設定から、レコードの値を組み立てる。
 *
 * - フロントの state・localStorage・OpenAPI のリクエストで共通に使う簡略表現 `PostGateValue` を定義する（Bluesky の lexicon の union 型を平坦化したもの）。
 * - 実際の書き込み（`com.atproto.repo.applyWrites` による一括の作成）は、投稿本体と skyshare の entry と合わせて `src/lib/entry/createBskyThread.ts` が行う。
 */

export type ReplyAudience = "everyone" | "nobody" | "custom"

/**
 * threadgate・postgate の簡略化された表現。
 *
 * - `replyAudience` が "custom" の場合だけ `allowMentioned`・`allowFollower`・`allowFollowing`・`listUris` が意味を持つ。
 */
export type PostGateValue = {
    replyAudience: ReplyAudience
    allowMentioned: boolean
    allowFollower: boolean
    allowFollowing: boolean
    listUris: string[]
    allowQuote: boolean
}

/**
 * threadgate の `allow` 配列の要素数上限（lexicon の仕様）。
 *
 * - 上限は、`allowMentioned`・`allowFollower`・`allowFollowing` と `listUris` を合わせた件数。超えた分は `buildThreadgateRecord` が切り捨てる。
 */
export const MAX_REPLY_GATE_RULES = 5

export const DEFAULT_POST_GATE_VALUE: PostGateValue = {
    replyAudience: "everyone",
    allowMentioned: false,
    allowFollower: false,
    allowFollowing: false,
    listUris: [],
    allowQuote: true,
}

/**
 * threadgateレコードを組み立てる。
 *
 * - "everyone" は Bluesky 側の既定（`allow` 未指定で誰でも返信可）に任せ、レコードを作らない。
 * - "custom" は mention・follower・following・list の順に積み、上限（`MAX_REPLY_GATE_RULES`）を超えた分は切り捨てる。
 *
 * Input:
 * - `postUri`: 対象投稿のAT-URI
 * - `gate`: 簡略化された設定値
 * - `createdAt`: レコード作成日時（ISO 8601）
 *
 * Output:
 * - レコード不要（everyone）の場合は `null`、それ以外は record オブジェクト
 *
 * 例:
 * - 入力: `{ replyAudience: "nobody", ... }`
 * - 出力: `{ $type: "app.bsky.feed.threadgate", post: postUri, createdAt, allow: [] }`
 */
export const buildThreadgateRecord = (
    postUri: string,
    gate: PostGateValue,
    createdAt: string,
): Record<string, unknown> | null => {
    if (gate.replyAudience === "everyone") return null

    if (gate.replyAudience === "nobody") {
        return {
            $type: "app.bsky.feed.threadgate",
            post: postUri,
            createdAt,
            allow: [],
        }
    }

    // custom: メンション→フォロワー→フォロー中→リストの順に最大5件まで積む
    const allow: Record<string, unknown>[] = []
    if (gate.allowMentioned) {
        allow.push({ $type: "app.bsky.feed.threadgate#mentionRule" })
    }
    if (gate.allowFollower) {
        allow.push({ $type: "app.bsky.feed.threadgate#followerRule" })
    }
    if (gate.allowFollowing) {
        allow.push({ $type: "app.bsky.feed.threadgate#followingRule" })
    }
    for (const list of gate.listUris) {
        if (allow.length >= MAX_REPLY_GATE_RULES) break
        allow.push({ $type: "app.bsky.feed.threadgate#listRule", list })
    }

    return {
        $type: "app.bsky.feed.threadgate",
        post: postUri,
        createdAt,
        allow,
    }
}

/**
 * postgateレコードを組み立てる。
 *
 * - `allowQuote: true` は Bluesky 側の既定（`embeddingRules` 未指定で誰でも引用可）に任せ、レコードを作らない。
 *
 * Input:
 * - `postUri`: 対象投稿のAT-URI
 * - `gate`: 簡略化された設定値
 * - `createdAt`: レコード作成日時（ISO 8601）
 *
 * Output:
 * - レコード不要（allowQuote=true）の場合は `null`、それ以外は record オブジェクト
 *
 * 例:
 * - 入力: `{ allowQuote: false, ... }`
 * - 出力: `{ $type: "app.bsky.feed.postgate", post: postUri, createdAt, embeddingRules: [{ $type: "app.bsky.feed.postgate#disableRule" }] }`
 */
export const buildPostgateRecord = (
    postUri: string,
    gate: PostGateValue,
    createdAt: string,
): Record<string, unknown> | null => {
    if (gate.allowQuote) return null

    return {
        $type: "app.bsky.feed.postgate",
        post: postUri,
        createdAt,
        embeddingRules: [{ $type: "app.bsky.feed.postgate#disableRule" }],
    }
}
