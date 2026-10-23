/**
 * 予約投稿の E2E が共通で使う API の差し替え。
 *
 * 責務と処理概要:
 * - セッション・下書き・予約（一覧・作成・内容の取得・置き換え・取消・画像）・制限値・認証情報の
 *   応答を、メモリ上の状態から返す（実アカウントや D1 は不要）。
 * - 呼び出しを `calls` に記録し、各 spec が回数と内容を検証できるようにする。
 */
import type { Page, Request } from "@playwright/test"

export const LIMITS = {
    minLeadSeconds: 300,
    maxLeadSeconds: 14 * 86400,
    maxPending: 5,
    maxImageBytes: 10_000_000,
    maxPosts: 100,
}

/** 認可の開始が返す、認可の画面の URL（テストではこの住所への遷移を差し替える） */
export const AUTHORIZE_URL =
    "https://auth.example/oauth/authorize?client_id=x&request_uri=urn%3Ar%3A1"

/** 1x1 の PNG（予約の画像の取得の応答に使う） */
export const PNG_1PX = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
)

export type ScheduleItem = {
    id: string
    runAt: string
    status: "pending" | "running" | "failed"
    postCount: number
    preview: string
    lastError: string | null
}

export type MockState = {
    registered: boolean
    /** 許可が無効になり、再度の許可が必要（登録ありのまま） */
    reauthRequired?: boolean
    /** 許可の有効期限の目安（ISO 8601） */
    expiresAt?: string
    items: ScheduleItem[]
    /** GET /v2/schedules/{id} の応答（識別子ごと） */
    details: Record<string, unknown>
    /** 予約の作成・置き換えの応答の上書き */
    submitStatus?: number
    submitBody?: object
    delayMs?: number
    /** 認可の完了の結果（省略時は ok。ok なら登録済みになる） */
    completionResult?: string
}

export type Calls = {
    creates: Request[]
    updates: Request[]
    deletes: string[]
    /** 認可の開始（POST /v2/schedules/credential/authorization/）の回数 */
    authorizationStarts: number
    /** 認可の開始に送られた本文（戻り先のパス） */
    authorizationStartBodies: unknown[]
    /** 認可の完了（POST …/authorization/completion/）に送られた本文 */
    authorizationCompletions: unknown[]
    credentialDeletes: number
}

const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
})

/**
 * 予約投稿に関わる API を差し替える。
 *
 * Input: `page`、初期の状態（省略時は登録済み・予約なし）
 * Output: 呼び出しの記録と、テスト中に書き換えられる状態
 */
export const mockScheduleApi = async (
    page: Page,
    initial: Partial<MockState> = {},
): Promise<{ calls: Calls; state: MockState }> => {
    const state: MockState = {
        registered: true,
        items: [],
        details: {},
        ...initial,
    }
    const calls: Calls = {
        creates: [],
        updates: [],
        deletes: [],
        authorizationStarts: 0,
        authorizationStartBodies: [],
        authorizationCompletions: [],
        credentialDeletes: 0,
    }

    await page.route(/\/v2\/bsky\/session\/?$/, route =>
        route.fulfill(
            json({
                accounts: [
                    {
                        did: "did:plc:me",
                        handle: "me.bsky.social",
                        displayName: "Me",
                        isActive: true,
                    },
                ],
            }),
        ),
    )
    await page.route(/\/v2\/bsky\/drafts\/?(\?.*)?$/, route =>
        route.fulfill(json({ drafts: [] })),
    )

    await page.route(/\/v2\/schedules\//, async route => {
        const request = route.request()
        const url = new URL(request.url())
        const path = url.pathname.replace(/\/$/, "")
        const method = request.method()

        if (path === "/v2/schedules/limits") return route.fulfill(json(LIMITS))

        if (path === "/v2/schedules/credential/authorization/completion") {
            calls.authorizationCompletions.push(request.postDataJSON())
            const result = state.completionResult ?? "ok"
            if (result === "ok") {
                state.registered = true
                state.reauthRequired = false
            }
            return route.fulfill(json({ result }))
        }

        if (path === "/v2/schedules/credential/authorization") {
            calls.authorizationStarts += 1
            calls.authorizationStartBodies.push(request.postDataJSON())
            return route.fulfill(json({ url: AUTHORIZE_URL }))
        }

        if (path === "/v2/schedules/credential") {
            if (method === "DELETE") {
                calls.credentialDeletes += 1
                const cancelled = state.items.filter(
                    i => i.status === "pending",
                ).length
                state.items = state.items.filter(i => i.status !== "pending")
                state.registered = false
                return route.fulfill(json({ registered: false, cancelled }))
            }
            return route.fulfill(
                json({
                    registered: state.registered,
                    reauthRequired: state.reauthRequired ?? false,
                    ...(state.expiresAt ? { expiresAt: state.expiresAt } : {}),
                }),
            )
        }

        if (path === "/v2/schedules") {
            if (method === "POST") {
                calls.creates.push(request)
                if (state.delayMs)
                    await new Promise(r => setTimeout(r, state.delayMs))
                return route.fulfill(
                    json(
                        state.submitBody ?? {
                            id: "created-1",
                            runAt: "2027-03-01T10:00:00.000Z",
                        },
                        state.submitStatus ?? 200,
                    ),
                )
            }
            const status = url.searchParams.get("status")
            return route.fulfill(
                json({
                    items: status
                        ? state.items.filter(i => i.status === status)
                        : state.items,
                }),
            )
        }

        const image = path.match(/^\/v2\/schedules\/([^/]+)\/images\/(\d+)$/)
        if (image) {
            return route.fulfill({
                status: 200,
                contentType: "image/png",
                body: PNG_1PX,
            })
        }

        const byId = path.match(/^\/v2\/schedules\/([^/]+)$/)
        if (byId) {
            const id = byId[1]!
            if (method === "DELETE") {
                calls.deletes.push(id)
                state.items = state.items.filter(i => i.id !== id)
                return route.fulfill(json({}))
            }
            if (method === "PUT") {
                calls.updates.push(request)
                return route.fulfill(
                    json(
                        state.submitBody ?? {
                            id,
                            runAt: "2027-03-01T10:00:00.000Z",
                        },
                        state.submitStatus ?? 200,
                    ),
                )
            }
            const detail = state.details[id]
            return detail
                ? route.fulfill(json(detail))
                : route.fulfill(json({ error: "Not Found" }, 404))
        }
        return route.fallback()
    })
    return { calls, state }
}
