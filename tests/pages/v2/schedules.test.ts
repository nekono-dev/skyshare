/**
 * `src/pages/v2/schedules.ts` と `schedules/limits.ts` の統合テスト。
 *
 * - D1 は node:sqlite、R2 は Map のフェイクを `getScheduleEnv` の差し替えで注入する。
 * - ルートが使う `src/lib/schedule/*` は実コードのまま通す。
 */
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { APIContext } from "astro"
import { createFakeD1 } from "../../helpers/fakeD1"
import { createFakeR2 } from "../../helpers/fakeR2"

const holder = vi.hoisted(() => ({ env: undefined as unknown }))
vi.mock("@/lib/schedule/env", () => ({
    getScheduleEnv: async () => holder.env,
}))

import { GET, POST } from "@/pages/v2/schedules"
import { GET as LIMITS } from "@/pages/v2/schedules/limits"
import {
    saveCredential,
    insertSchedule,
    countPending,
    getCredentialStatus,
} from "@/lib/schedule/store"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)))
const DID = "did:plc:aaaa"
const session = { did: DID } as never
const call = (
    h: unknown,
    request: Request,
    locals: object = { session, service: "https://pds" },
) =>
    (h as (c: APIContext) => Promise<Response>)({
        request,
        locals,
        url: new URL(request.url),
    } as unknown as APIContext)

const runAtIn = (seconds: number) =>
    new Date(Date.now() + seconds * 1000).toISOString()

const postRequest = (formData: FormData) =>
    new Request("http://localhost/v2/schedules/", {
        method: "POST",
        headers: { cookie: "sid=1" },
        body: formData,
    })

const textForm = (opts?: { runAt?: string; posts?: number }) => {
    const fd = new FormData()
    for (let i = 0; i < (opts?.posts ?? 1); i++)
        fd.set(`posts[${i}][text]`, `post ${i}`)
    fd.set("runAt", opts?.runAt ?? runAtIn(600))
    return fd
}

let db: ReturnType<typeof createFakeD1>
let r2: ReturnType<typeof createFakeR2>

const withCredential = () =>
    saveCredential(db, KEY, { did: DID, service: "https://pds", token: "t" }, 1)

beforeEach(() => {
    db = createFakeD1()
    r2 = createFakeR2()
    holder.env = { DB: db, SCHEDULE_IMAGES: r2, SCHEDULE_ENC_KEY: KEY }
})

describe("POST /v2/schedules", () => {
    test("schedule-api/AC-1: 投稿が0件または101件は400、画像つき2件のスレッドは作成できる", async () => {
        await withCredential()
        const zero = new FormData()
        zero.set("runAt", runAtIn(600))
        expect((await call(POST, postRequest(zero))).status).toBe(400)
        expect(
            (await call(POST, postRequest(textForm({ posts: 101 })))).status,
        ).toBe(400)

        const fd = textForm({ posts: 2 })
        fd.append("posts[0][images]", new Blob(["x"], { type: "image/png" }))
        fd.set(
            "posts[0][imagesMeta]",
            JSON.stringify([{ width: 10, height: 10 }]),
        )
        fd.append("posts[1][images]", new Blob(["y"], { type: "image/png" }))
        fd.set(
            "posts[1][imagesMeta]",
            JSON.stringify([{ width: 10, height: 10 }]),
        )
        const res = await call(POST, postRequest(fd))
        expect(res.status).toBe(200)
        expect(r2.objects.size).toBe(2)
    })

    test("schedule-api/AC-2: 動画を含む投稿の予約は400で拒否される", async () => {
        await withCredential()
        const fd = textForm()
        fd.set("posts[0][video]", JSON.stringify({ any: "blob" }))
        fd.set("posts[0][videoMeta]", JSON.stringify({ width: 1, height: 1 }))
        expect((await call(POST, postRequest(fd))).status).toBe(400)
        expect(await countPending(db, DID)).toBe(0)
    })

    test("schedule-api/AC-3: 4分後と15日後は400、10分後と14日後は成功する", async () => {
        await withCredential()
        expect(
            (
                await call(
                    POST,
                    postRequest(textForm({ runAt: runAtIn(4 * 60) })),
                )
            ).status,
        ).toBe(400)
        expect(
            (
                await call(
                    POST,
                    postRequest(textForm({ runAt: runAtIn(15 * 86400) })),
                )
            ).status,
        ).toBe(400)
        expect(
            (
                await call(
                    POST,
                    postRequest(textForm({ runAt: runAtIn(10 * 60) })),
                )
            ).status,
        ).toBe(200)
        expect(
            (
                await call(
                    POST,
                    postRequest(textForm({ runAt: runAtIn(14 * 86400 - 5) })),
                )
            ).status,
        ).toBe(200)
    })

    test("schedule-api/AC-4: 認証情報が未登録だと409になり、予約も画像も保存されない", async () => {
        const fd = textForm()
        fd.append("posts[0][images]", new Blob(["x"], { type: "image/png" }))
        fd.set(
            "posts[0][imagesMeta]",
            JSON.stringify([{ width: 1, height: 1 }]),
        )
        const res = await call(POST, postRequest(fd))
        expect(res.status).toBe(409)
        expect((await res.json()).error).toBe("ScheduleCredentialRequired")
        expect(await countPending(db, DID)).toBe(0)
        expect(r2.objects.size).toBe(0)
    })

    test("schedule-api/AC-10: 待機中が5件のアカウントの6件目は、1件の投稿でも3件のスレッドでも429になる", async () => {
        await withCredential()
        // 3件のスレッドも1件と数える
        expect(
            (await call(POST, postRequest(textForm({ posts: 3 })))).status,
        ).toBe(200)
        for (let i = 0; i < 4; i++) {
            expect((await call(POST, postRequest(textForm()))).status).toBe(
                200,
            )
        }
        expect(await countPending(db, DID)).toBe(5)
        expect((await call(POST, postRequest(textForm()))).status).toBe(429)
        expect(
            (await call(POST, postRequest(textForm({ posts: 3 })))).status,
        ).toBe(429)
        expect(await countPending(db, DID)).toBe(5)
    })

    test("作成すると、認証情報の最後の使用の時刻が更新される", async () => {
        await withCredential()
        await call(POST, postRequest(textForm()))
        const status = await getCredentialStatus(db, DID)
        expect(status.updatedAt).toBeGreaterThan(1)
    })

    test("schedule-api/AC-12: 成功すると200と識別子と実行時刻が返る", async () => {
        await withCredential()
        const runAt = runAtIn(600)
        const res = await call(POST, postRequest(textForm({ runAt })))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.id).toBeTruthy()
        expect(body.runAt).toBe(
            new Date(Math.floor(Date.parse(runAt) / 1000) * 1000).toISOString(),
        )
        expect(await countPending(db, DID)).toBe(1)
    })

    test("合計10メガバイトを超える画像は400で拒否される", async () => {
        await withCredential()
        const fd = textForm()
        fd.append(
            "posts[0][images]",
            new Blob([new Uint8Array(6_000_000)], { type: "image/png" }),
        )
        fd.append(
            "posts[0][images]",
            new Blob([new Uint8Array(4_000_001)], { type: "image/png" }),
        )
        fd.set(
            "posts[0][imagesMeta]",
            JSON.stringify([
                { width: 1, height: 1 },
                { width: 1, height: 1 },
            ]),
        )
        expect((await call(POST, postRequest(fd))).status).toBe(400)
        expect(r2.objects.size).toBe(0)
    })

    test("schedule-api/AC-14: 未認証は401、不正な入力は400で、キャッシュを禁止する", async () => {
        const unauth = await call(POST, postRequest(textForm()), {})
        expect(unauth.status).toBe(401)
        expect(unauth.headers.get("cache-control")).toBe("no-store")
        const bad = await call(POST, postRequest(new FormData()))
        expect(bad.status).toBe(400)
        expect(bad.headers.get("cache-control")).toBe("no-store")
    })
})

describe("GET /v2/schedules", () => {
    const get = (qs = "", locals?: object) =>
        call(GET, new Request(`http://localhost/v2/schedules/${qs}`), locals)

    test("schedule-api/AC-8: 他のアカウントの予約は含まれず、状態で絞り込まれ、続きがあればカーソルが返る", async () => {
        await insertSchedule(db, {
            id: "a1",
            did: DID,
            runAt: 1,
            payload: JSON.stringify({
                posts: [{ text: "x".repeat(150) }, { text: "y" }],
            }),
            imageKeys: [],
            now: 0,
        })
        await insertSchedule(db, {
            id: "a2",
            did: DID,
            runAt: 2,
            payload: JSON.stringify({ posts: [{ text: "b" }] }),
            imageKeys: [],
            now: 0,
        })
        await insertSchedule(db, {
            id: "a3",
            did: DID,
            runAt: 3,
            payload: JSON.stringify({ posts: [{ text: "c" }] }),
            imageKeys: [],
            now: 0,
        })
        await insertSchedule(db, {
            id: "z1",
            did: "did:plc:other",
            runAt: 0,
            payload: "{}",
            imageKeys: [],
            now: 0,
        })

        const p1 = await (await get("?limit=2")).json()
        expect(p1.items.map((i: { id: string }) => i.id)).toEqual(["a1", "a2"])
        expect(p1.items[0].preview).toHaveLength(100)
        expect(p1.items[0].postCount).toBe(2)
        expect(p1.cursor).toBeTruthy()
        const p2 = await (
            await get(`?limit=2&cursor=${encodeURIComponent(p1.cursor)}`)
        ).json()
        expect(p2.items.map((i: { id: string }) => i.id)).toEqual(["a3"])
        expect(p2.cursor).toBeUndefined()
        const none = await (await get("?status=posted")).json()
        expect(none.items).toHaveLength(0)
    })

    test("schedule-api/AC-14: 未認証は401、不正なクエリは400", async () => {
        expect((await get("", {})).status).toBe(401)
        expect((await get("?limit=0")).status).toBe(400)
        expect((await get("?status=unknown")).status).toBe(400)
    })
})

describe("GET /v2/schedules/limits", () => {
    test("schedule-api/AC-17: 制限値を返し、未認証では401になる", async () => {
        const ok = await call(
            LIMITS,
            new Request("http://localhost/v2/schedules/limits/"),
        )
        expect(ok.status).toBe(200)
        expect(await ok.json()).toEqual({
            minLeadSeconds: 300,
            maxLeadSeconds: 1209600,
            maxPending: 5,
            maxImageBytes: 10000000,
            maxPosts: 100,
        })
        expect(
            (
                await call(
                    LIMITS,
                    new Request("http://localhost/v2/schedules/limits/"),
                    {},
                )
            ).status,
        ).toBe(401)
    })
})
