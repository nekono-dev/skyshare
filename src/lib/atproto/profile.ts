/**
 * atproto プロフィール参照のユーティリティ。
 *
 * 責務と処理概要:
 * - skyshare entry の作成時に投稿者の表示名を取得する。
 * - 実際に呼び出すメソッドは `getProfile` のみのため、`AtpAgent` 全体ではなく
 *   最小インターフェース型を引数に取る（テストでは軽量なフェイクを渡せる）。
 */

import type { AtpAgent } from "@atproto/api"

type ProfileAgent = Pick<AtpAgent, "getProfile">

/**
 * 投稿者の表示名を解決する。
 *
 * 処理の趣旨:
 * - `getProfile` の `displayName` を優先し、未設定（空文字/undefined）なら
 *   handle をフォールバックとして採用する。
 *
 * Input:
 * - `agent`: `getProfile` を持つ認証済み AtpAgent（または同等の最小インターフェース）
 * - `did`: 対象アカウントの DID
 * - `fallbackHandle`: displayName が無い場合に使う handle
 *
 * Output:
 * - 表示名として利用する文字列
 *
 * 例:
 * - 入力: displayName="Alice" → 出力: "Alice"
 * - 入力: displayName="" → 出力: fallbackHandle
 */
export const resolveDisplayName = async (
    agent: ProfileAgent,
    did: string,
    fallbackHandle: string,
): Promise<string> => {
    const res = await agent.getProfile({ actor: did })
    return res.data.displayName || fallbackHandle
}
