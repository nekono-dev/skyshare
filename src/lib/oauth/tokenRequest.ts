/**
 * OAuth 認可サーバーへの PAR・トークン・取消フォーム要求を送る。
 * - nonce 要求には受信 nonce で一度だけ再試行し、各送信前に `onRequest` を呼ぶ。
 * - トークンと応答本文をログに出さない。
 */
import {
    type DpopSession,
    createDpopProof,
    isDpopNonceError,
    rememberDpopNonce,
} from "./dpop"

export type FormRequest = {
    url: string
    /** クライアントの証明を含むフォームの項目。やり直しのたびに作り直す（証明は使い捨て） */
    params: () => Promise<Record<string, string>>
    dpop: DpopSession
    now: number
    fetchImpl: typeof fetch
    /** 送る直前に呼ぶ。偽を返すと送らずに null を返す（通信の予算が尽きたとき） */
    onRequest?: () => boolean
}

/**
 * フォームの要求を送り、応答を返す。nonce の指示には1回だけやり直す。
 *
 * Output: 応答。`onRequest` が送ることを許さなければ null。通信の失敗は例外
 */
export const postForm = async (req: FormRequest): Promise<Response | null> => {
    // Workers の fetch は this が globalThis でないと Illegal invocation になるため、
    // req のメソッドとしてではなく単独の関数として呼ぶ
    const { fetchImpl } = req
    for (let attempt = 0; attempt < 2; attempt++) {
        if (req.onRequest && !req.onRequest()) return null
        const res = await fetchImpl(req.url, {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                accept: "application/json",
                dpop: await createDpopProof(req.dpop, "POST", req.url, req.now),
            },
            body: new URLSearchParams(await req.params()).toString(),
        })
        rememberDpopNonce(req.dpop, req.url, res)
        if (attempt === 0 && (await isDpopNonceError(res))) continue
        return res
    }
    return null
}
