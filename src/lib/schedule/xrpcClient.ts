/**
 * 通信回数の予算つきの XRPC クライアント。
 *
 * 責務と処理概要:
 * - 標準の `fetch` だけで PDS の XRPC を呼ぶ（atproto のライブラリを読み込まない）。
 * - 通信のたびに予算を1減らし、予算が尽きたら通信せずに `BudgetExceeded` を返す。
 *   Workers 無料枠は1回の実行で行える外部への通信の回数に上限があるため、その内側に収める。
 * - PDS の応答を、呼び出し側が分岐しやすい `kind` に分類する。
 * - ログには `nsid` と `kind` だけを出力し、トークンと応答の本文は出力しない。
 */

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
    if (budget.remaining <= 0) return { ok: false, kind: "BudgetExceeded" }
    budget.remaining -= 1

    const query = req.params ? `?${new URLSearchParams(req.params)}` : ""
    const headers: Record<string, string> = {}
    if (req.token) headers.authorization = `Bearer ${req.token}`
    let body: BodyInit | undefined
    if (req.body !== undefined) {
        if (isRawBody(req.body)) {
            body = req.body as BodyInit
            headers["content-type"] =
                req.contentType ?? "application/octet-stream"
        } else {
            body = JSON.stringify(req.body)
            headers["content-type"] = "application/json"
        }
    }

    let res: Response
    try {
        res = await fetchImpl(
            `${req.service.replace(/\/+$/, "")}/xrpc/${req.nsid}${query}`,
            { method: req.method, headers, body },
        )
    } catch {
        console.warn(`xrpc ${req.nsid}: Transient (network)`)
        return { ok: false, kind: "Transient" }
    }

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
