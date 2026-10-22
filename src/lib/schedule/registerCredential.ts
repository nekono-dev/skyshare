/**
 * 予約用の認証情報の登録。
 *
 * 責務と処理概要:
 * - アプリパスワードで `com.atproto.server.createSession` を呼び、新しいセッションを得る。
 *   ブラウザのセッションとは独立した系統になるため、互いのトークン更新が干渉しない。
 * - 得たセッションが、現在のセッションと同じアカウントのものであり、かつアプリパスワードで
 *   得たものである（アクセストークンの scope で判定する）ことを確認する。
 * - 更新用トークン（refreshJwt）だけを暗号化して保管する。パスワードとアクセストークンは保管しない。
 *
 * 実装上の制約:
 * - CPU 時間を抑えるため、atproto のライブラリを使わず標準の `fetch` で通信する。
 * - パスワード・トークンをログと例外メッセージに含めない。
 */
import type { D1Database } from "./cfTypes"
import { saveCredential } from "./store"

const APP_PASSWORD_SCOPES = [
    "com.atproto.appPass",
    "com.atproto.appPassPrivileged",
]

const decodeJwtScope = (jwt: string): string | undefined => {
    try {
        const payload = jwt.split(".")[1]
        if (!payload) return undefined
        const b64 = payload.replace(/-/g, "+").replace(/_/g, "/")
        const json = JSON.parse(
            atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")),
        )
        return typeof json.scope === "string" ? json.scope : undefined
    } catch {
        return undefined
    }
}

export type RegisterResult =
    { ok: true } | { ok: false; status: 400 | 401 | 429 | 500 }

export const registerScheduleCredential = async (
    db: D1Database,
    secret: string,
    session: { did: string; service: string },
    password: string,
    now: number,
    fetchImpl: typeof fetch = fetch,
): Promise<RegisterResult> => {
    let res: Response
    try {
        res = await fetchImpl(
            `${session.service.replace(/\/+$/, "")}/xrpc/com.atproto.server.createSession`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ identifier: session.did, password }),
            },
        )
    } catch {
        console.error("registerScheduleCredential: createSession unreachable")
        return { ok: false, status: 500 }
    }

    if (res.status === 429) return { ok: false, status: 429 }
    if (res.status === 401 || res.status === 400)
        return { ok: false, status: 401 }
    if (!res.ok) {
        console.error(`registerScheduleCredential: createSession ${res.status}`)
        return { ok: false, status: 500 }
    }

    let data: { did?: unknown; accessJwt?: unknown; refreshJwt?: unknown }
    try {
        data = await res.json()
    } catch {
        return { ok: false, status: 500 }
    }
    if (
        typeof data.did !== "string" ||
        typeof data.accessJwt !== "string" ||
        typeof data.refreshJwt !== "string"
    ) {
        return { ok: false, status: 500 }
    }

    if (data.did !== session.did) return { ok: false, status: 400 }
    const scope = decodeJwtScope(data.accessJwt)
    if (!scope || !APP_PASSWORD_SCOPES.includes(scope)) {
        return { ok: false, status: 400 }
    }

    try {
        await saveCredential(
            db,
            secret,
            {
                did: session.did,
                service: session.service,
                token: data.refreshJwt,
            },
            now,
        )
    } catch {
        console.error("registerScheduleCredential: save failed")
        return { ok: false, status: 500 }
    }
    return { ok: true }
}
