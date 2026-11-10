/**
 * 自分が所有する Bluesky のリスト一覧を取得する（threadgate の `#listRule` の「リストから選択」で使う）。
 *
 * - リストの読み取りは認証不要の公開情報のため、自前のバックエンドを経由せず `publicAtpAgent` でブラウザから Bluesky の公開 AppView を直接呼ぶ（アクセスが多くなるため、バックエンドの負荷を避ける）。
 * - 同じ方針の `src/lib/atproto/suggest.ts`（メンション・ハッシュタグの候補）と揃えている。
 */

import { publicAtpAgent } from "./publicAgent"

export type OwnedList = { uri: string; name: string }

/**
 * 自分自身のBlueskyリスト一覧を取得する。
 *
 * - 返信許可に選べるのは、Bluesky 公式アプリと同じくユーザーリスト（`app.bsky.graph.defs#curatelist`）だけ。モデレーション用の modlist（`#modlist`）は返信許可の対象として不適切なため除外する。
 * - 取得するのは先頭 100 件（`limit: 100`）だけで、ページングはしない。その中から curatelist だけを返す。
 * - 失敗時の方針: 例外を握りつぶさず呼び出し元へ投げる（呼び出し元の `PostGateDialog` がローディング・エラー表示を担う）。
 *
 * Input:
 * - `did`: 一覧を取得する対象アカウントの DID
 *
 * Output:
 * - `{ uri, name }[]`（curatelist のみ）
 *
 * 例:
 * - 入力: did="did:plc:abc"（curatelist 1件、modlist 1件を所有）
 * - 出力: curatelistの1件のみを含む配列
 */
export const getOwnLists = async (did: string): Promise<OwnedList[]> => {
    const res = await publicAtpAgent.app.bsky.graph.getLists({
        actor: did,
        limit: 100,
    })
    return res.data.lists
        .filter(list => list.purpose === "app.bsky.graph.defs#curatelist")
        .map(list => ({ uri: list.uri, name: list.name }))
}
