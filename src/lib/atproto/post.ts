/**
 * `app.bsky.feed.post` レコードの値を組み立てる純粋関数と、返信の参照の検証。
 */

import type { BskyFacets, BskyReplyRef } from "@/lib/atproto/recordTypes"
import { parseOwnedAtUri } from "@/lib/atproto/atUri"
import { MAX_THREAD_POST_COUNT } from "./threadLimit"
import { serviceName } from "@/vars"

export const BSKY_POST_COLLECTION = "app.bsky.feed.post"

/**
 * 1 スレッド（reply chain で連結された投稿群）に含められる投稿の最大数（件数）。
 *
 * - 実体は `./threadLimit` にあり、ここでは再エクスポートする。
 */
export { MAX_THREAD_POST_COUNT }

/**
 * `app.bsky.feed.post` レコードの値を組み立てる（副作用なし）。
 *
 * - `selfLabel` が指定されたときだけ、`labels` を `com.atproto.label.defs#selfLabels` の形で付ける。
 * - `createdAt` は引数の値をそのまま使い、現在時刻を読まない。同じ引数からは同じ値が得られる。
 *
 * Input:
 * - `text`: 投稿本文テキスト
 * - `facets`: クライアント側で組み立て済みの facets 配列（リンク・mention・tag 情報）
 * - `langs`: 言語タグ配列
 * - `embed`: 埋め込みオブジェクト
 * - `selfLabel`: 自己ラベル値（未指定時は undefined）
 * - `reply`: スレッド化(reply chain)する場合の root/parent。未指定時は通常投稿
 * - `createdAt`: ISO 8601 の作成日時
 *
 * Output:
 * - `app.bsky.feed.post` レコードの値（`$type`込み）
 *
 * 例:
 * - 入力: `text="Hello world"`, `facets=[]`, `langs=["ja"]`, `embed={ $type: "..." }`, `selfLabel="sexual"`, `createdAt="2026-01-01T00:00:00.000Z"`
 * - 出力: `{ $type: "app.bsky.feed.post", text: "Hello world", ..., createdAt: "2026-01-01T00:00:00.000Z", via: "Skyshare" }`
 */
export const buildBskyPostRecord = (params: {
    text: string
    facets: BskyFacets | undefined
    langs: string[] | undefined
    embed: any
    selfLabel: string | undefined
    reply: BskyReplyRef | undefined
    createdAt: string
}): Record<string, unknown> => {
    const { text, facets, langs, embed, selfLabel, reply, createdAt } = params

    // selfLabel が指定されている場合は com.atproto.label.defs#selfLabels 形式に変換する
    const labels = selfLabel
        ? {
              $type: "com.atproto.label.defs#selfLabels",
              values: [{ val: selfLabel }],
          }
        : undefined

    return {
        $type: BSKY_POST_COLLECTION,
        text,
        facets: facets ?? undefined,
        langs,
        embed,
        labels,
        reply,
        createdAt,
        via: serviceName,
    }
}

/**
 * `reply.root`・`reply.parent` の uri が、`did` の `app.bsky.feed.post` レコードを指しているかを検証する。
 *
 * - `reply` が未指定なら検証せず `true` を返す。
 * - 他人の投稿を返信先にしないため、uri の repo（DID）が `did` と一致するかを確かめる。
 *
 * Input:
 * - `reply`: リクエストで指定された reply（未指定なら検証不要）
 * - `did`: 投稿者本人の DID（`session.did`）
 *
 * Output:
 * - reply が未指定、または root/parent とも自分の投稿を指していれば `true`
 * - root/parent のいずれかが自分以外の投稿・不正な形式の uri を指していれば `false`
 *
 * 例:
 * - 入力: `reply.root.uri`/`reply.parent.uri` がともに `did:plc:abc` 自身の投稿, `did: "did:plc:abc"`
 * - 出力: `true`
 * - 入力: `reply.parent.uri` が他人（`did:plc:other`）の投稿, `did: "did:plc:abc"`
 * - 出力: `false`
 */
export const isReplyRefOwnedBySelf = (
    reply: BskyReplyRef | undefined,
    did: string,
): boolean => {
    if (!reply) return true

    return (
        parseOwnedAtUri(reply.root.uri, BSKY_POST_COLLECTION, did) !==
            undefined &&
        parseOwnedAtUri(reply.parent.uri, BSKY_POST_COLLECTION, did) !==
            undefined
    )
}
