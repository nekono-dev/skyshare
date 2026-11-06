// 予約の作成と一覧の API（/v2/schedules の POST・GET）の特性化テスト（要件 2.2・4.2）。
// 現行の応答（状態コード・本文の形・cache-control）を固定する。振る舞いを変えるためのテストではない。
import { env } from "cloudflare:test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { insertSchedule } from "@/lib/schedule/store"
import { MAX_PENDING_PER_ACCOUNT } from "@/lib/schedule/scheduleLimits"
import { TEST_DID, TEST_HANDLE } from "../../fixtures/identities"
import { NOW, resetScheduleTables, seedCredential } from "../schedule/support"
import { GET, POST } from "@/pages/v2/schedules"

/** 有効な実行時刻（現在から 1 時間後。実行時刻は Date.now() を基準に検証される） */
const validRunAt = () => new Date(Date.now() + 3600 * 1000).toISOString()

/** multipart の予約の入力を作る */
const multipart = (fields: Record<string, string>) => {
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.append(k, v)
    return form
}

/** 有効な予約の入力（本文 1 件） */
const validFields = (): Record<string, string> => ({
    runAt: validRunAt(),
    "posts[0][text]": "予約の本文",
})

/** POST /v2/schedules を呼ぶ。cookie と session を個別に指定できる */
const post = (opts: {
    body?: FormData | string
    contentType?: string | null
    cookie?: string | null
    session?: boolean
}) => {
    const headers: Record<string, string> = {}
    if (opts.cookie !== null)
        headers.cookie = opts.cookie ?? "atp_session=fixture"
    // FormData のときは fetch 側に content-type（境界付き）を任せる
    if (opts.contentType !== undefined && opts.contentType !== null) {
        headers["content-type"] = opts.contentType
    }
    const request = new Request("https://skyshare.test/v2/schedules", {
        method: "POST",
        headers,
        body: opts.body ?? multipart(validFields()),
    })
    const locals =
        opts.session === false
            ? {}
            : { session: { did: TEST_DID, handle: TEST_HANDLE } }
    return POST({ request, locals } as never)
}

/** GET /v2/schedules を呼ぶ。query は URL の検索文字列として渡す */
const get = (query: string, opts: { session?: boolean } = {}) => {
    const url = new URL(`https://skyshare.test/v2/schedules${query}`)
    const locals =
        opts.session === false
            ? {}
            : { session: { did: TEST_DID, handle: TEST_HANDLE } }
    return GET({ url, locals } as never)
}

/** 待機中（既定）の予約の行を 1 件入れる */
const seedRow = (
    id: string,
    opts: { runAt?: number; payload?: unknown; did?: string } = {},
) =>
    insertSchedule(env.DB, {
        id,
        did: opts.did ?? TEST_DID,
        runAt: opts.runAt ?? NOW + 3600,
        payload: JSON.stringify(opts.payload ?? { posts: [{ text: id }] }),
        imageKeys: [],
        now: NOW,
    })

describe("POST /v2/schedules（特性化）", () => {
    beforeEach(async () => {
        await resetScheduleTables()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns 200 with the id and the ISO run time, and stores a pending row", async () => {
        await seedCredential()
        const res = await post({})
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")

        const body = (await res.json()) as { id: string; runAt: string }
        expect(Object.keys(body).sort()).toEqual(["id", "runAt"])
        expect(typeof body.id).toBe("string")
        expect(new Date(body.runAt).toISOString()).toBe(body.runAt)

        const row = await env.DB.prepare(
            "SELECT did, status FROM scheduled_posts WHERE id = ?",
        )
            .bind(body.id)
            .first<{ did: string; status: string }>()
        expect(row).toEqual({ did: TEST_DID, status: "pending" })
    })

    it("returns 400 when the cookie header is missing, even without a session", async () => {
        const res = await post({ cookie: null, session: false })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })

    it("returns 400 when the cookie header is missing with a session", async () => {
        await seedCredential()
        const res = await post({ cookie: null })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 400 when the body is not multipart/form-data", async () => {
        await seedCredential()
        const res = await post({
            body: JSON.stringify({
                posts: [{ text: "x" }],
                runAt: validRunAt(),
            }),
            contentType: "application/json",
        })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 400 when the body does not match the schema (no posts)", async () => {
        await seedCredential()
        const res = await post({ body: multipart({ runAt: validRunAt() }) })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 400 when the run time is less than 5 minutes ahead", async () => {
        await seedCredential()
        const soon = new Date(Date.now() + 60 * 1000).toISOString()
        const res = await post({
            body: multipart({ runAt: soon, "posts[0][text]": "x" }),
        })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 401 when the cookie is present but there is no session", async () => {
        const res = await post({ session: false })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })

    it("returns 409 ScheduleCredentialRequired when no credential is registered", async () => {
        const res = await post({})
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({
            error: "ScheduleCredentialRequired",
        })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })

    it("returns 429 when the account already has the maximum number of pending schedules", async () => {
        await seedCredential()
        for (let i = 0; i < MAX_PENDING_PER_ACCOUNT; i++) {
            await seedRow(`post-fill-${i}`)
        }
        const res = await post({})
        expect(res.status).toBe(429)
        expect(await res.json()).toEqual({ error: "Too Many Requests" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })
})

describe("GET /v2/schedules（特性化）", () => {
    beforeEach(async () => {
        await resetScheduleTables()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns 401 when there is no session", async () => {
        const res = await get("", { session: false })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })

    it.each([
        ["an unknown status", "?status=done"],
        ["a limit above 50", "?limit=51"],
        ["a limit below 1", "?limit=0"],
        ["a non-integer limit", "?limit=1.5"],
        ["an empty cursor", "?cursor="],
        ["an unknown query key", "?foo=1"],
    ])("returns 400 for %s", async (_label, query) => {
        const res = await get(query)
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })

    it("returns 200 with items in run-time order, in the list item shape", async () => {
        await seedRow("get-late", { runAt: NOW + 7200 })
        await seedRow("get-early", {
            runAt: NOW + 3600,
            payload: { posts: [{ text: "先頭の本文" }, { text: "2件目" }] },
        })

        const res = await get("")
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")

        const body = (await res.json()) as Record<string, unknown>
        expect(Object.keys(body)).toEqual(["items"])
        const items = body.items as Record<string, unknown>[]
        expect(items.map(i => i.id)).toEqual(["get-early", "get-late"])
        expect(items[0]).toEqual({
            id: "get-early",
            runAt: new Date((NOW + 3600) * 1000).toISOString(),
            status: "pending",
            postCount: 2,
            preview: "先頭の本文",
            lastError: null,
        })
    })

    it("cuts the preview at 100 characters", async () => {
        await seedRow("get-long", {
            payload: { posts: [{ text: "あ".repeat(150) }] },
        })
        const body = (await (await get("")).json()) as {
            items: { preview: string }[]
        }
        expect(body.items[0]!.preview).toHaveLength(100)
    })

    it("returns an empty items list with no cursor when the account has no schedules", async () => {
        const res = await get("")
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ items: [] })
    })

    it("returns a cursor when there are more items, and the next page continues after it", async () => {
        await seedRow("page-1", { runAt: NOW + 3600 })
        await seedRow("page-2", { runAt: NOW + 7200 })

        const first = (await (await get("?limit=1")).json()) as {
            items: { id: string }[]
            cursor?: string
        }
        expect(first.items.map(i => i.id)).toEqual(["page-1"])
        expect(typeof first.cursor).toBe("string")

        const second = (await (
            await get(`?limit=1&cursor=${encodeURIComponent(first.cursor!)}`)
        ).json()) as { items: { id: string }[]; cursor?: string }
        expect(second.items.map(i => i.id)).toEqual(["page-2"])
        expect(second).not.toHaveProperty("cursor")
    })

    it("filters by status", async () => {
        await seedRow("status-pending")
        const res = await get("?status=failed")
        expect(await res.json()).toEqual({ items: [] })
    })
})
