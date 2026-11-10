/**
 * atproto のプロフィールから、投稿者の表示名を解決する。
 */

import type { Agent } from "@atproto/api"

type ProfileAgent = Pick<Agent, "getProfile">

/**
 * 投稿者の表示名を解決する。
 *
 * - `getProfile` の `displayName` を返す。値が偽（空文字・`undefined`）のときは `fallbackHandle` を返す。
 *
 * Input:
 * - `agent`: `getProfile` を持つ認証済み Agent（または同等の最小インターフェース）
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
