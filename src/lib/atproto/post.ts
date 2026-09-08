/**
 * atproto 投稿レコード（`app.bsky.feed.post`）のビルダー・検証ユーティリティ。
 *
 * 責務と処理概要:
 * - `app.bsky.feed.post` レコードの値そのもの（$type/text/facets/embed/labels/reply等）を
 *   組み立てる純粋関数を提供する。実際に atproto へ書き込む処理（`com.atproto.repo.applyWrites`
 *   での原子的な複数レコード作成）は `src/lib/entry/createBskyThread.ts` が担う。
 */

import type * as Components from "@/lib/api/schema/common"
import { parseOwnedAtUri } from "@/lib/entry/url"

export const BSKY_POST_COLLECTION = "app.bsky.feed.post"

/**
 * `app.bsky.feed.post` レコードの値を組み立てる（純粋関数、副作用なし）。
 *
 * 処理の趣旨:
 * - selfLabel が指定された場合は com.atproto.label.defs#selfLabels 形式で labels を付与。
 * - `createdAt` は呼び出し元が確定させた値をそのまま使う（`applyWrites`でのcid事前計算
 *   のため、レコード値全体が呼び出しごとに決定的である必要がある）。
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
 * - 入力：text="Hello world",facets=[],langs=["ja"],embed={$type:"..."},selfLabel="sexual",createdAt="2026-01-01T00:00:00.000Z"
 * - 出力：{ $type:"app.bsky.feed.post", text:"Hello world", ..., createdAt:"2026-01-01T00:00:00.000Z", via:"Skyshare" }
 */
export const buildBskyPostRecord = (params: {
    text: string
    facets: Components.CommonFacetsType | undefined
    langs: string[] | undefined
    embed: any
    selfLabel: string | undefined
    reply: Components.CommonReplyRefType | undefined
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
        via: "Skyshare",
    }
}

/**
 * `reply.root`/`reply.parent` の uri が、呼び出しユーザー自身の `app.bsky.feed.post`
 * レコードを指しているか検証する。
 *
 * 処理の趣旨:
 * - スレッド投稿機能はクライアントが申告した root/parent の StrongRef をそのまま
 *   投稿レコードへ渡すため、他人の投稿への不正な reply chain 構築
 *   （なりすまし的なスレッド接続）を防ぐ最終防御として、uri の repo（DID）が
 *   自分自身であることをサーバ側で確認する。
 *
 * Input:
 * - `reply`: リクエストで指定された reply（未指定なら検証不要）
 * - `did`: 呼び出しユーザーの DID（`session.did`）
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
    reply: Components.CommonReplyRefType | undefined,
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
