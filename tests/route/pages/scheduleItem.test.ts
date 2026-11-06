// 予約 1 件の API（/v2/schedules/{id} の GET・PUT・DELETE）の特性化テスト（要件 2.2・2.4）。
// 現行の応答（状態コード・本文の形・所有と状態による失敗）を固定する。振る舞いを変えるためのテストではない。
import { env } from "cloudflare:test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { insertSchedule } from "@/lib/schedule/store"
import { TEST_DID, TEST_HANDLE } from "../../fixtures/identities"
import {
    NOW,
    resetScheduleTables,
    seedCredential,
    seedRunningSchedule,
} from "../schedule/support"
import { DELETE, GET, PUT } from "@/pages/v2/schedules/[id]"

/** 別のアカウント（架空。TEST_DID の予約を見られないことを確かめる） */
const OTHER_DID = "did:plc:testfixturebob00000000000"

/** 有効な実行時刻（現在から 1 時間後。PUT の実行時刻は Date.now() を基準に検証される） */
const validRunAt = () => new Date(Date.now() + 3600 * 1000).toISOString()

/** 待機中（既定）の予約の行を 1 件入れる */
const seedRow = (id: string, opts: { did?: string; payload?: unknown } = {}) =>
    insertSchedule(env.DB, {
        id,
        did: opts.did ?? TEST_DID,
        runAt: NOW + 3600,
        payload: JSON.stringify(opts.payload ?? { posts: [{ text: id }] }),
        imageKeys: [],
        now: NOW,
    })

/** 行の状態を D1 から読む（検査用） */
const rowOf = (id: string) =>
    env.DB.prepare(
        "SELECT id, did, status, run_at, payload, image_keys FROM scheduled_posts WHERE id = ?",
    )
        .bind(id)
        .first<{
            id: string
            did: string
            status: string
            run_at: number
            payload: string
            image_keys: string
        }>()

/** 有効な置き換えの入力（multipart。本文 1 件） */
const replaceForm = (text: string) => {
    const form = new FormData()
    form.append("runAt", validRunAt())
    form.append("posts[0][text]", text)
    return form
}

/** GET /v2/schedules/{id} を呼ぶ */
const get = (id: string, opts: { session?: boolean } = {}) => {
    const locals =
        opts.session === false
            ? {}
            : { session: { did: TEST_DID, handle: TEST_HANDLE } }
    return GET({ params: { id }, locals } as never)
}

/** PUT /v2/schedules/{id} を呼ぶ。cookie と session を個別に指定できる */
const put = (
    id: string,
    opts: { body?: FormData; session?: boolean; cookie?: boolean } = {},
) => {
    const headers: Record<string, string> = {}
    if (opts.cookie !== false) headers.cookie = "atp_session=fixture"
    const request = new Request(`https://skyshare.test/v2/schedules/${id}`, {
        method: "PUT",
        headers,
        body: opts.body ?? replaceForm("置き換えた本文"),
    })
    const locals =
        opts.session === false
            ? {}
            : { session: { did: TEST_DID, handle: TEST_HANDLE } }
    return PUT({ params: { id }, request, locals } as never)
}

/** DELETE /v2/schedules/{id} を呼ぶ */
const del = (id: string, opts: { session?: boolean } = {}) => {
    const locals =
        opts.session === false
            ? {}
            : { session: { did: TEST_DID, handle: TEST_HANDLE } }
    return DELETE({ params: { id }, locals } as never)
}

describe("GET /v2/schedules/{id}（特性化）", () => {
    beforeEach(async () => {
        await resetScheduleTables()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns 404 for another account's schedule, without revealing it", async () => {
        await seedRow("item-other", { did: OTHER_DID })
        const res = await get("item-other")
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: "Not Found" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })

    it("returns 404 for a nonexistent id", async () => {
        const res = await get("item-missing")
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: "Not Found" })
    })

    it("returns 409 ScheduleRunning for a running schedule", async () => {
        await seedRunningSchedule({
            id: "item-running",
            payload: { posts: [{ text: "実行中" }] },
        })
        const res = await get("item-running")
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ error: "ScheduleRunning" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })

    it("returns 401 when there is no session", async () => {
        await seedRow("item-nosession")
        const res = await get("item-nosession", { session: false })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
    })

    it("returns 200 with the body and omits facets from each post", async () => {
        await seedRow("item-facets", {
            payload: {
                posts: [
                    {
                        text: "リンク付きの本文",
                        facets: [
                            {
                                index: { byteStart: 0, byteEnd: 4 },
                                features: [
                                    {
                                        $type: "app.bsky.richtext.facet#link",
                                        uri: "https://example.test/",
                                    },
                                ],
                            },
                        ],
                    },
                    { text: "2件目", facets: [] },
                ],
            },
        })

        const res = await get("item-facets")
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")

        const body = (await res.json()) as {
            id: string
            status: string
            runAt: string
            posts: Record<string, unknown>[]
        }
        expect(Object.keys(body).sort()).toEqual([
            "id",
            "posts",
            "runAt",
            "status",
        ])
        expect(body.id).toBe("item-facets")
        expect(body.status).toBe("pending")
        expect(body.runAt).toBe(new Date((NOW + 3600) * 1000).toISOString())
        expect(body.posts).toHaveLength(2)
        for (const post of body.posts) {
            expect(post).not.toHaveProperty("facets")
        }
        expect(body.posts[0]).toEqual({ text: "リンク付きの本文" })
        expect(body.posts[1]).toEqual({ text: "2件目" })
    })
})

describe("PUT /v2/schedules/{id}（特性化）", () => {
    beforeEach(async () => {
        await resetScheduleTables()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns 404 for another account's schedule and leaves that row unchanged", async () => {
        await seedCredential()
        await seedRow("item-put-other", {
            did: OTHER_DID,
            payload: { posts: [{ text: "元の本文" }] },
        })
        const res = await put("item-put-other")
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: "Not Found" })
        expect(res.headers.get("cache-control")).toBe("no-store")

        const row = await rowOf("item-put-other")
        expect(row?.payload).toBe(
            JSON.stringify({ posts: [{ text: "元の本文" }] }),
        )
    })

    it("returns 404 for a nonexistent id", async () => {
        await seedCredential()
        const res = await put("item-put-missing")
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: "Not Found" })
    })

    it("returns 409 ScheduleRunning for a running schedule and does not overwrite it", async () => {
        await seedCredential()
        await seedRunningSchedule({
            id: "item-put-running",
            payload: { posts: [{ text: "実行中の本文" }] },
        })
        const res = await put("item-put-running")
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ error: "ScheduleRunning" })
        expect(res.headers.get("cache-control")).toBe("no-store")

        const row = await rowOf("item-put-running")
        expect(row?.status).toBe("running")
        expect(row?.payload).toBe(
            JSON.stringify({ posts: [{ text: "実行中の本文" }] }),
        )
    })

    it("returns 401 when there is no session", async () => {
        const res = await put("item-put-nosession", { session: false })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
    })

    it("returns 200 with exactly id and runAt, and updates the pending row", async () => {
        await seedCredential()
        await seedRow("item-put-ok", {
            payload: { posts: [{ text: "元の本文" }] },
        })

        const res = await put("item-put-ok", {
            body: replaceForm("置き換えた本文"),
        })
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")

        const body = (await res.json()) as Record<string, unknown>
        expect(Object.keys(body).sort()).toEqual(["id", "runAt"])
        expect(body.id).toBe("item-put-ok")
        expect(typeof body.runAt).toBe("string")
        expect(new Date(body.runAt as string).toISOString()).toBe(body.runAt)

        const row = await rowOf("item-put-ok")
        expect(row?.status).toBe("pending")
        expect(row?.did).toBe(TEST_DID)
        expect(row?.run_at).toBe(
            Math.floor(new Date(body.runAt as string).getTime() / 1000),
        )
        expect(JSON.parse(row!.payload)).toEqual({
            posts: [{ text: "置き換えた本文" }],
        })
        expect(JSON.parse(row!.image_keys)).toEqual([])
    })
})

describe("DELETE /v2/schedules/{id}（特性化）", () => {
    beforeEach(async () => {
        await resetScheduleTables()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns 404 for another account's schedule and keeps that row", async () => {
        await seedRow("item-del-other", { did: OTHER_DID })
        const res = await del("item-del-other")
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: "Not Found" })
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await rowOf("item-del-other")).not.toBeNull()
    })

    it("returns 404 for a nonexistent id", async () => {
        const res = await del("item-del-missing")
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: "Not Found" })
    })

    it("returns 409 ScheduleRunning for a running schedule and keeps the row", async () => {
        await seedRunningSchedule({
            id: "item-del-running",
            payload: { posts: [{ text: "実行中" }] },
        })
        const res = await del("item-del-running")
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ error: "ScheduleRunning" })
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect((await rowOf("item-del-running"))?.status).toBe("running")
    })

    it("returns 401 when there is no session", async () => {
        await seedRow("item-del-nosession")
        const res = await del("item-del-nosession", { session: false })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
    })

    it("returns 200 with an empty object and removes the row", async () => {
        await seedRow("item-del-ok")
        const res = await del("item-del-ok")
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await res.json()).toEqual({})
        expect(await rowOf("item-del-ok")).toBeNull()
    })
})
