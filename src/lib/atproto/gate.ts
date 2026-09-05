/**
 * atproto 返信可能ユーザー設定（`app.bsky.feed.threadgate`）・
 * 引用許可設定（`app.bsky.feed.postgate`）のユーティリティ。
 *
 * 責務と処理概要:
 * - フロント state・localStorage・OpenAPI リクエストボディで共通して使う、
 *   Bluesky公式lexiconのunion型を平坦化した簡略表現 `PostGateValue` を定義する。
 * - `PostGateValue` から実際の threadgate/postgate レコードを組み立てる純粋関数を提供する。
 * - 投稿確定後にレコードを作成する `applyPostGate` を提供する。
 * - 実際に呼び出すメソッドは `com.atproto.repo.createRecord` のみのため、
 *   `AtpAgent` 全体ではなく最小インターフェース型を引数に取る（テストでは軽量なフェイクを渡せる）。
 */

import type { AtpAgent } from "@atproto/api"

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

type GateAgent = {
    com: {
        atproto: {
            repo: {
                createRecord: AtpAgent["com"]["atproto"]["repo"]["createRecord"]
            }
        }
    }
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

/**
 * 投稿確定後にthreadgate/postgateレコードを作成する。
 *
 * 処理の趣旨:
 * - `app.bsky.feed.post` 自体は既に成功済みのため、ここでの失敗で例外を投げると
 *   呼び出し元がリクエスト全体を失敗扱いにしてしまい、ユーザーのリトライにより
 *   同一内容の投稿が重複作成される実害が生じうる。そのため例外を投げず、
 *   失敗フラグを返すのみに留める（呼び出し元でレスポンスの警告フィールドへ反映する）。
 * - threadgate/postgateは独立したレコードのため、`Promise.allSettled` で
 *   互いに影響を与えずに作成を試みる。
 *
 * Input:
 * - `agent`: `com.atproto.repo.createRecord` を持つ認証済み AtpAgent
 * - `did`: 投稿者のDID（レコードのrepoに使う）
 * - `postUri`: 対象投稿のAT-URI
 * - `rkey`: 対象投稿と同じレコードキー（threadgate/postgateはpostと同じrkeyを持つ必要がある）
 * - `gate`: 簡略化された設定値
 *
 * Output:
 * - `{ threadgateFailed, postgateFailed }`: 各レコード作成が失敗したかどうか
 *
 * 例:
 * - 入力: 完全デフォルト（everyone + allowQuote:true）
 * - 出力: `{ threadgateFailed: false, postgateFailed: false }`（createRecordは一度も呼ばれない）
 */
export const applyPostGate = async (
    agent: GateAgent,
    did: string,
    postUri: string,
    rkey: string,
    gate: PostGateValue,
): Promise<{ threadgateFailed: boolean; postgateFailed: boolean }> => {
    const createdAt = new Date().toISOString()
    const threadgateRecord = buildThreadgateRecord(postUri, gate, createdAt)
    const postgateRecord = buildPostgateRecord(postUri, gate, createdAt)

    const [threadgateResult, postgateResult] = await Promise.allSettled([
        threadgateRecord
            ? agent.com.atproto.repo.createRecord({
                  repo: did,
                  collection: "app.bsky.feed.threadgate",
                  rkey,
                  record: threadgateRecord,
              })
            : Promise.resolve(null),
        postgateRecord
            ? agent.com.atproto.repo.createRecord({
                  repo: did,
                  collection: "app.bsky.feed.postgate",
                  rkey,
                  record: postgateRecord,
              })
            : Promise.resolve(null),
    ])

    return {
        threadgateFailed: threadgateResult.status === "rejected",
        postgateFailed: postgateResult.status === "rejected",
    }
}
