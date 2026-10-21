/**
 * atproto リスト参照（`app.bsky.graph.getLists`）のユーティリティ。
 *
 * 責務と処理概要:
 * - 返信可能ユーザー設定（threadgateの`#listRule`）の「リストから選択」UIに使う、
 *   自分自身が所有するBlueskyリスト一覧を取得する。
 * - リストの読み取りは認証不要な公開情報のため、自前バックエンドを経由せず
 *   `publicAtpAgent`（`src/lib/atproto/publicAgent.ts`）でブラウザから直接
 *   Bluesky公開AppViewを叩く（アクセス頻度が高くなる想定のため、自前バックエンドの
 *   負荷を避ける方針。`src/lib/atproto/suggest.ts` のメンション/ハッシュタグ候補と
 *   同じ設計方針）。
 */

import { publicAtpAgent } from "./publicAgent"

export type OwnedList = { uri: string; name: string }

/**
 * 自分自身のBlueskyリスト一覧を取得する。
 *
 * 処理の趣旨:
 * - 返信許可リストとして選べるのは、Bluesky公式アプリと同様にユーザーリスト
 *   （`app.bsky.graph.defs#curatelist`）のみとする。モデレーション用途の
 *   modlist（`#modlist`）は返信許可の対象として不適切なため除外する。
 * - 失敗時の方針: 例外を握りつぶさず呼び出し元へ投げる（呼び出し元の
 *   `PostGateDialog` がローディング/エラー表示を担う）。
 *
 * Input:
 * - `did`: 一覧を取得する対象アカウントのDID
 *
 * Output:
 * - `{ uri, name }[]`（curatelistのみ、最大100件）
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
