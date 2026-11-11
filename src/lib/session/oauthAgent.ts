/**
 * DPoP 付き PDS 要求を送る atproto エージェントを作る。
 *
 * - `@atproto/api` は全リクエスト経路から静的に読み込まず、OAuth セッション再開時に動的に読み込む。
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
