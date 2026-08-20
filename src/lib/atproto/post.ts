/**
 * atproto 投稿作成（`app.bsky.feed.post`）のユーティリティ。
 *
 * 責務と処理概要:
 * - AtpAgent の `post` メソッドを呼び出し、テキスト・facets・embed・selfLabel から
 *   `app.bsky.feed.post` レコードを作成する。
 * - 実際に呼び出すメソッドは `post` のみのため、`AtpAgent` 全体ではなく
 *   最小インターフェース型を引数に取る（テストでは軽量なフェイクを渡せる）。
 */

import type { AtpAgent } from "@atproto/api"

type PostAgent = Pick<AtpAgent, "post">

/**
 * atproto へ投稿を作成する。
 *
 * 処理の趣旨:
 * - AtpAgent の post メソッドを呼び出し、app.bsky.feed.post レコードを作成。
 * - selfLabel が指定された場合は com.atproto.label.defs#selfLabels 形式で labels を付与。
 * - 副作用: atproto 外部 API を呼び出して投稿を作成。
 *
 * Input:
 * - `agent`: `post` を持つ認証済み AtpAgent（または同等の最小インターフェース）
 * - `text`: 投稿本文テキスト
 * - `facets`: 検出済みの facets 配列（リンク・mention 情報）
 * - `langs`: 言語タグ配列
 * - `embed`: 埋め込みオブジェクト
 * - `selfLabel`: 自己ラベル値（未指定時は undefined）
 *
 * Output:
 * - { uri: string, cid: string } — 投稿の URI と CID
 *
 * 失敗時の方針:
 * - agent.post が失敗した場合は Error を throw。呼び出し元で catch して 500 を返す。
 *
 * 例:
 * - 入力：agent(Auth済み),text="Hello world",facets=[],langs=["ja"],embed={$type:"..."},selfLabel="sexual"
 * - 出力：{ uri:"at://did:plc:xxx/app.bsky.feed.post/xxxxx",cid:"bafy..." }
 */
export const createBskyPost = async (
    agent: PostAgent,
    text: string,
    facets: any[] | undefined,
    langs: string[] | undefined,
    embed: any,
    selfLabel: string | undefined,
) => {
    // selfLabel が指定されている場合は com.atproto.label.defs#selfLabels 形式に変換する
    const labels = selfLabel
        ? {
              $type: "com.atproto.label.defs#selfLabels",
              values: [{ val: selfLabel }],
          }
        : undefined

    return await agent.post({
        $type: "app.bsky.feed.post",
        text,
        facets: facets ?? undefined,
        langs,
        embed,
        labels,
        via: "Skyshare",
    })
}
