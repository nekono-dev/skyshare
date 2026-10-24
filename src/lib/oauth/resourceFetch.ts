/**
 * PDS への、DPoP に結び付けたアクセストークンでの要求。
 *
 * 責務と処理概要:
 * - 要求ごとに `Authorization: DPoP <アクセストークン>` と、アクセストークンの SHA-256（ath）を入れた
 *   DPoP の証明を付けて送る。
 * - PDS が nonce を求めたら（401 の `WWW-Authenticate` に `use_dpop_nonce`）、受け取った nonce で1回だけやり直す。
 * - 受け取った nonce は DPoP の状態に残り、利用側が次のリクエストへ持ち越せる。
 *
 * 実装上の制約:
 * - 全リクエストのミドルウェアと Cron の実行から使うため、atproto のライブラリを読み込まず
 *   WebCrypto と fetch だけを使う。
 * - アクセストークンと証明をログに出さない。
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
