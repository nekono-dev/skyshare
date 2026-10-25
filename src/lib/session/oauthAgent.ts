/**
 * OAuth のセッションで動く `@atproto/api` のエージェントの生成。
 *
 * 責務と処理概要:
 * - DPoP つきで PDS へ送る要求の関数を、`Agent` の `fetchHandler` として包む。
 *   ハンドラはアプリパスワードのセッションと同じ `agent.com.atproto.*`・`agent.app.bsky.*` を使える。
 *
 * 実装上の制約:
 * - `@atproto/api` を静的に読み込むため、全リクエストで読み込まれる経路（ミドルウェア）からは
 *   OAuth のセッションを再開する時点で動的に読み込む（`oauthSession.ts` の `resumeOAuthSession`）。
 */
import { Agent } from "@atproto/api"

/**
 * DPoP つきの要求で動くエージェントを作る。
 *
 * Input:
 * - `did`: セッションのアカウントの DID（`agent.did` になる）
 * - `fetchHandler`: `"/xrpc/..."` の形のパスを受けて PDS へ送る関数
 *
 * Output: `Agent`
 *
 * 例: `createOAuthAgent(did, createDpopFetch({ pdsUrl, accessToken, dpop, now }))`
 */
export const createOAuthAgent = (
    did: string,
    fetchHandler: (path: string, init?: RequestInit) => Promise<Response>,
): Agent =>
    new Agent({
        did,
        fetchHandler: (url: string, init: RequestInit) =>
            fetchHandler(url, init),
    })
