/**
 * AtpAgent の生成ユーティリティ。
 *
 * 責務と処理概要:
 * - `new AtpAgent(...)` を薄くラップするだけの関数。単体テストではこのモジュールを
 *   `vi.mock` することで、`AtpAgent` を直接生成しているコード（`bsky/session.ts` や
 *   `bskySessionRefresh` ミドルウェア）にもフェイクエージェントを注入できるようにする。
 * - 他の `src/lib/atproto/*` が「エージェントの一部メソッドだけを最小インターフェースで
 *   受け取る」ことでテスト容易性を確保しているのに対し、こちらは生成そのものを
 *   差し替え可能にする必要がある箇所（＝`locals.agent` 経由でエージェントを受け取らず、
 *   自前で `new AtpAgent(...)` するコード）専用のラッパーである。
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
