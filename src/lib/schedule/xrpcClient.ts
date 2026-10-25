/**
 * 通信回数の予算つきの XRPC クライアント。
 *
 * 責務と処理概要:
 * - 標準の `fetch` だけで PDS の XRPC を呼ぶ（atproto のライブラリを読み込まない）。
 * - 通信のたびに予算を1減らし、予算が尽きたら通信せずに `BudgetExceeded` を返す。
 *   Workers 無料枠は1回の実行で行える外部への通信の回数に上限があるため、その内側に収める。
 * - OAuth のアクセストークン（DPoP に結び付いたもの）で呼ぶときは、要求ごとに DPoP の証明を付け、
 *   PDS が nonce を求めたら（401 の `use_dpop_nonce`）受け取った nonce で1回だけやり直す。
 *   やり直しも通信の回数に数える。
 * - PDS の応答を、呼び出し側が分岐しやすい `kind` に分類する。
 * - ログには `nsid` と `kind` だけを出力し、トークンと応答の本文は出力しない。
 */
import {
    type DpopSession,
    createDpopProof,
    isDpopNonceError,
    rememberDpopNonce,
} from "@/lib/oauth/dpop"

export type Budget = {
    remaining: number
    /** PDS からレート制限の応答を受けたら真になる。以降の通信を止める判断に使う */
    rateLimited: boolean
}

export type XrpcFailureKind =
    "BudgetExceeded" | "RateLimited" | "Auth" | "Invalid" | "Transient"

export type XrpcResult =
    { ok: true; json: any } | { ok: false; kind: XrpcFailureKind }

export type XrpcRequest = {
    service: string
    nsid: string
    method: "GET" | "POST"
    token?: string
    /** OAuth のアクセストークンと DPoP の鍵。指定すると `token` の代わりに使う */
    dpop?: { session: DpopSession; accessToken: string }
    params?: Record<string, string>
    body?: unknown
    contentType?: string
}

export const createBudget = (limit: number): Budget => ({
    remaining: limit,
    rateLimited: false,
})

const AUTH_ERRORS = ["ExpiredToken", "InvalidToken", "AuthenticationRequired"]

const isRawBody = (body: unknown): body is ArrayBuffer | Uint8Array =>
    body instanceof ArrayBuffer || body instanceof Uint8Array

export const callXrpc = async (
    budget: Budget,
    req: XrpcRequest,
    fetchImpl: typeof fetch = fetch,
): Promise<XrpcResult> => {
    const query = req.params ? `?${new URLSearchParams(req.params)}` : ""
    const url = `${req.service.replace(/\/+$/, "")}/xrpc/${req.nsid}${query}`
    let body: BodyInit | undefined
    let contentType: string | undefined
    if (req.body !== undefined) {
        if (isRawBody(req.body)) {
            body = req.body as BodyInit
            contentType = req.contentType ?? "application/octet-stream"
        } else {
            body = JSON.stringify(req.body)
            contentType = "application/json"
        }
    }

    let res: Response | undefined
    // DPoP の nonce を求められたときだけ、2回目を送る
    for (let attempt = 0; attempt < 2; attempt++) {
        if (budget.remaining <= 0) return { ok: false, kind: "BudgetExceeded" }
        budget.remaining -= 1
        const headers: Record<string, string> = {}
        if (contentType) headers["content-type"] = contentType
        if (req.dpop) {
            headers.authorization = `DPoP ${req.dpop.accessToken}`
            headers.dpop = await createDpopProof(
                req.dpop.session,
                req.method,
                url,
                Math.floor(Date.now() / 1000),
                req.dpop.accessToken,
            )
        } else if (req.token) {
            headers.authorization = `Bearer ${req.token}`
        }
        try {
            res = await fetchImpl(url, { method: req.method, headers, body })
        } catch {
            console.warn(`xrpc ${req.nsid}: Transient (network)`)
            return { ok: false, kind: "Transient" }
        }
        if (!req.dpop) break
        rememberDpopNonce(req.dpop.session, url, res)
        if (attempt === 0 && (await isDpopNonceError(res))) continue
        break
    }
    if (!res) return { ok: false, kind: "Transient" }

    if (res.ok) {
        try {
            return { ok: true, json: await res.json() }
        } catch {
            return { ok: true, json: {} }
        }
    }

    let code: string | undefined
    try {
        code = ((await res.json()) as { error?: string }).error
    } catch {
        // 本文が JSON でない応答は、ステータスだけで分類する
    }

    let kind: XrpcFailureKind
    if (res.status === 429) {
        kind = "RateLimited"
        budget.rateLimited = true
    } else if (res.status === 401 || (code && AUTH_ERRORS.includes(code))) {
        kind = "Auth"
    } else if (res.status >= 500) {
        kind = "Transient"
    } else {
        kind = "Invalid"
    }
    console.warn(`xrpc ${req.nsid}: ${kind} (${res.status})`)
    return { ok: false, kind }
}
