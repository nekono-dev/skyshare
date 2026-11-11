/**
 * Provides shared fixtures for scheduled posting tests.
 */
// 認証情報・予約の行を、製品の保管の関数で作り、PDS とトークンの応答は偽の fetch で与える。
import { env } from "cloudflare:test"
import { expect } from "vitest"
import { insertSchedule, saveCredential } from "@/lib/schedule/store"
import {
    serializeCredential,
    type OAuthCredential,
} from "@/lib/schedule/oauth/storedCredential"
import { generateEcJwk } from "@/lib/oauth/jose"
import type { ScheduleRow } from "@/lib/schedule/types"
import { TEST_DID, TEST_KEY_BASE64 } from "../../fixtures/identities"

export const PDS = "https://pds.test"
export const TOKEN_ENDPOINT = "https://bsky.social/oauth/token"
export const NOW = 1_800_000_000

/** 予約の実行に渡す環境（暗号鍵は固定のテスト用の値） */
export const scheduleEnv = () => ({
    DB: env.DB,
    SCHEDULE_IMAGES: env.SCHEDULE_IMAGES,
    SCHEDULE_ENC_KEY: TEST_KEY_BASE64,
})

/** 認証情報（OAuth）を保存する。トークンは暗号化して保管される */
export const seedCredential = async (
    did: string = TEST_DID,
    refreshToken = "refresh-0-fixture",
): Promise<void> => {
    const credential: OAuthCredential = {
        v: 1,
        clientId: "http://localhost",
        refreshToken,
        dpopJwk: await generateEcJwk(),
        issuer: "https://bsky.social",
        tokenEndpoint: TOKEN_ENDPOINT,
    }
    await saveCredential(
        env.DB,
        TEST_KEY_BASE64,
        { did, service: PDS, token: serializeCredential(credential) },
        NOW,
        {
            authorized: true,
        },
    )
}

/** 実行中の行（claim 済み）を一件作る。runAt は現在時刻以前にする */
export const seedRunningSchedule = async (opts: {
    id: string
    payload: unknown
    imageKeys?: string[]
    did?: string
    runAt?: number
    progress?: unknown
    attempts?: number
}): Promise<ScheduleRow> => {
    const did = opts.did ?? TEST_DID
    await insertSchedule(env.DB, {
        id: opts.id,
        did,
        runAt: opts.runAt ?? NOW - 60,
        payload: JSON.stringify(opts.payload),
        imageKeys: opts.imageKeys ?? [],
        now: NOW - 120,
    })
    if (opts.progress !== undefined || opts.attempts !== undefined) {
        await env.DB.prepare(
            "UPDATE scheduled_posts SET progress = COALESCE(?, progress), attempts = COALESCE(?, attempts) WHERE id = ?",
        )
            .bind(
                opts.progress === undefined
                    ? null
                    : JSON.stringify(opts.progress),
                opts.attempts ?? null,
                opts.id,
            )
            .run()
    }
    // 同じファイルの前のテストの行を巻き込まないよう、対象の行だけを実行中にする
    await env.DB.prepare(
        "UPDATE scheduled_posts SET status = 'running' WHERE id = ?",
    )
        .bind(opts.id)
        .run()
    const r = await env.DB.prepare("SELECT * FROM scheduled_posts WHERE id = ?")
        .bind(opts.id)
        .first<Record<string, unknown>>()
    if (!r) throw new Error("expected the schedule row")
    return {
        id: r.id as string,
        did: r.did as string,
        runAt: Number(r.run_at),
        status: "running",
        payload: r.payload as string,
        imageKeys: r.image_keys as string,
        progress: r.progress as string,
        attempts: Number(r.attempts),
        lastError: null,
        updatedAt: Number(r.updated_at),
        finishedAt: null,
    }
}

/** D1 の予約の状態を読む（検査用） */
export const scheduleState = async (id: string) =>
    env.DB.prepare(
        "SELECT status, attempts, last_error, progress FROM scheduled_posts WHERE id = ?",
    )
        .bind(id)
        .first<{
            status: string
            attempts: number
            last_error: string | null
            progress: string
        }>()

type Call = {
    url: string
    body: string | ArrayBuffer | null | undefined
    dpop: string | null
}

/**
 * 偽の PDS とトークンの応答。`overrides` で個別の応答を差し替える。
 * 呼ばれた要求は `calls` に記録する。
 */
export const fakePds = (
    overrides: Partial<Record<string, () => Response>> = {},
) => {
    const calls: Call[] = []
    const reply = (status: number, body?: unknown) =>
        new Response(body === undefined ? null : JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
        })
    const routes: Record<string, () => Response> = {
        [TOKEN_ENDPOINT]: () =>
            reply(200, {
                token_type: "DPoP",
                access_token: "access-fixture",
                refresh_token: "refresh-rotated-fixture",
                sub: TEST_DID,
                expires_in: 3600,
            }),
        [`${PDS}/xrpc/com.atproto.repo.uploadBlob`]: () =>
            reply(200, {
                blob: {
                    $type: "blob",
                    ref: { $link: "bafkfixtureblob" },
                    mimeType: "image/png",
                    size: 4,
                },
            }),
        [`${PDS}/xrpc/com.atproto.repo.putRecord`]: () =>
            reply(200, {
                uri: "at://did:plc:testfixturealice0000000000/app.bsky.feed.post/x",
                cid: "bafkfixturecid",
            }),
        ...overrides,
    }
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const headers = new Headers(init?.headers)
        const body =
            typeof init?.body === "string"
                ? init.body
                : (init?.body as ArrayBuffer | undefined)
        calls.push({ url, body, dpop: headers.get("dpop") })
        const key = Object.keys(routes).find(
            k => url === k || url.startsWith(k + "?"),
        )
        return key ? routes[key]!() : reply(404, { error: "NotFound" })
    }
    return { fetchImpl: fetchImpl as unknown as typeof fetch, calls }
}

/** 記録された要求のうち、指定の XRPC の呼び出し */
export const callsTo = (calls: Call[], nsid: string) =>
    calls.filter(c => c.url.endsWith(`/xrpc/${nsid}`))

export { expect }

/** 予約の表をすべて空にする。各テストの前に呼び、テストどうしの状態を残さない */
export const resetScheduleTables = async (): Promise<void> => {
    for (const table of [
        "scheduled_posts",
        "schedule_credentials",
        "schedule_oauth_states",
    ]) {
        await env.DB.prepare(`DELETE FROM ${table}`).run()
    }
}
