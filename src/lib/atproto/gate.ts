/**
 * atproto 返信可能ユーザー設定（`app.bsky.feed.threadgate`）・
 * 引用許可設定（`app.bsky.feed.postgate`）のユーティリティ。
 *
 * 責務と処理概要:
 * - フロント state・localStorage・OpenAPI リクエストボディで共通して使う、
 *   Bluesky公式lexiconのunion型を平坦化した簡略表現 `PostGateValue` を定義する。
 * - `PostGateValue` から実際の threadgate/postgate レコードの値を組み立てる純粋関数を提供する。
 *   実際に atproto へ書き込む処理（`com.atproto.repo.applyWrites`での原子的な作成）は
 *   `src/lib/entry/createBskyThread.ts` が、投稿本体・skyshare entryと合わせて担う。
 */

export type ReplyAudience = "everyone" | "nobody" | "custom"

/**
 * threadgate/postgateの簡略化された表現。
 *
 * 想定する入力形状:
 * - `replyAudience` が "custom" の場合のみ `allowMentioned`/`allowFollower`/
 *   `allowFollowing`/`listUris` が意味を持つ。
 */
export type PostGateValue = {
    replyAudience: ReplyAudience
    allowMentioned: boolean
    allowFollower: boolean
    allowFollowing: boolean
    listUris: string[]
    allowQuote: boolean
}

/** threadgate `allow` 配列の要素数上限（lexicon仕様） */
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
 * 処理の趣旨:
 * - "everyone" の場合、Bluesky側の既定動作（allow未指定=誰でも返信可能）に委ねるため
 *   レコード自体を作らず null を返す。
 * - "nobody" の場合、allow を空配列にして誰も返信できないようにする。
 * - "custom" の場合、mention→follower→following→listの順にunion要素を積み、
 *   lexicon仕様の上限（`MAX_REPLY_GATE_RULES`）を超えないよう防御的にclampする。
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
 * 処理の趣旨:
 * - 引用/embedを許可する場合（`allowQuote: true`）は、Bluesky側の既定動作
 *   （embeddingRules未指定=誰でも引用可能）に委ねるためレコード自体を作らず null を返す。
 * - 許可しない場合、`#disableRule` を含む embeddingRules を設定する。
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
