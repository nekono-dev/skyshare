/**
 * 認可サーバーへのフォームの要求（PAR・トークン・取消）。
 *
 * 責務と処理概要:
 * - 要求ごとに DPoP の証明とクライアントの証明を付けて送る。
 * - 認可サーバーが nonce を求めたら（`use_dpop_nonce`）、受け取った nonce で1回だけやり直す。
 * - 送るたびに `onRequest` を呼ぶ（Cron の実行で外部への通信の回数を数えるため）。
 *
 * 実装上の制約:
 * - トークンと応答の本文をログに出さない。
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
