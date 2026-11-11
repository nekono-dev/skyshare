/**
 * DPoP に結び付いたアクセストークンで PDS に要求する。
 * - nonce を求める応答には受信 nonce で一度だけ再試行し、nonce は DPoP 状態に保持する。
 * - ミドルウェアと Cron から使うため WebCrypto と fetch のみを使い、トークンや証明をログに出さない。
 */
import {
    type DpopSession,
    createDpopProof,
    isDpopNonceError,
    rememberDpopNonce,
} from "./dpop"

export type DpopFetchInput = {
    /** PDS の URL（オリジンだけを使う） */
    pdsUrl: string
    accessToken: string
    dpop: DpopSession
    /** 現在時刻（UNIX 秒）。証明ごとに読む */
    now: () => number
    fetchImpl?: typeof fetch
}

/**
 * やり直しで同じ本文を送れるよう、`ReadableStream` の本文をバイト列に読み込む。
 * 文字列・バイト列・Blob など、繰り返し送れる本文はそのまま返す。
 */
const replayableBody = async (
    body: RequestInit["body"],
): Promise<RequestInit["body"]> => {
    if (body instanceof ReadableStream) {
        return new Uint8Array(await new Response(body).arrayBuffer())
    }
    return body
}

/**
 * PDS へ DPoP つきで要求する関数を作る。
 *
 * Input: `DpopFetchInput`
 * Output: `(path, init) => Promise<Response>`。`path` は `"/xrpc/..."` の形（クエリを含んでよい）
 *
 * 例:
 * - `const fetchPds = createDpopFetch({ pdsUrl, accessToken, dpop, now: () => nowSec() })`
 * - `await fetchPds("/xrpc/com.atproto.server.getSession")`
 */
export const createDpopFetch = (input: DpopFetchInput) => {
    const fetchImpl = input.fetchImpl ?? fetch
    const origin = new URL(input.pdsUrl).origin
    return async (path: string, init: RequestInit = {}): Promise<Response> => {
        const url = new URL(path, origin).toString()
        const method = (init.method ?? "GET").toUpperCase()
        const body = await replayableBody(init.body)
        let res: Response | null = null
        for (let attempt = 0; attempt < 2; attempt++) {
            const headers = new Headers(init.headers)
            headers.set("authorization", `DPoP ${input.accessToken}`)
            headers.set(
                "dpop",
                await createDpopProof(
                    input.dpop,
                    method,
                    url,
                    input.now(),
                    input.accessToken,
                ),
            )
            res = await fetchImpl(url, { ...init, method, headers, body })
            rememberDpopNonce(input.dpop, url, res)
            if (attempt === 0 && (await isDpopNonceError(res))) continue
            return res
        }
        return res!
    }
}
