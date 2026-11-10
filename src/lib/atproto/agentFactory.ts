/**
 * `AtpAgent` を生成する。
 */

import { AtpAgent } from "@atproto/api"

/**
 * 指定した service に対する AtpAgent を生成する。
 *
 * Input:
 * - `service`: atproto service のエンドポイント URL
 *
 * Output:
 * - 未認証状態の `AtpAgent` インスタンス
 *
 * 例:
 * - 入力: `"https://bsky.social"`
 * - 出力: `new AtpAgent({ service: "https://bsky.social" })`
 */
export const createAtpAgent = (service: string): AtpAgent =>
    new AtpAgent({ service })
