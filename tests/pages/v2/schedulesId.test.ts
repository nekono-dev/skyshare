import { beforeEach, describe, expect, test, vi } from "vitest"
import type { APIContext } from "astro"
import { createFakeD1 } from "../../helpers/fakeD1"
import { createFakeR2 } from "../../helpers/fakeR2"

const holder = vi.hoisted(() => ({ env: undefined as unknown }))
vi.mock("@/lib/schedule/env", () => ({
    getScheduleEnv: async () => holder.env,
}))

import { DELETE, GET, PUT } from "@/pages/v2/schedules/[id]"
import { GET as GET_IMAGE } from "@/pages/v2/schedules/[id]/images/[index]"
import { POST } from "@/pages/v2/schedules"
import {
    claimDueSchedules,
    failSchedule,
    getSchedule,
    insertSchedule,
    loadCredential,
    saveCredential,
} from "@/lib/schedule/store"
import { putImages } from "@/lib/schedule/imageStaging"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)))
const DID = "did:plc:aaaa"
const del = (id: string, locals: object = { session: { did: DID } }) =>
    (DELETE as unknown as (c: APIContext) => Promise<Response>)({
        params: { id },
        locals,
        request: new Request(`http://localhost/v2/schedules/${id}/`, {
            method: "DELETE",
        }),
    } as unknown as APIContext)

let db: ReturnType<typeof createFakeD1>
let r2: ReturnType<typeof createFakeR2>

const add = async (id: string, did = DID, withImage = false) => {
    const keys = withImage
        ? await putImages(r2, did, id, "g", [
              { bytes: new ArrayBuffer(3), mime: "image/png" },
          ])
        : []
    await insertSchedule(db, {
        id,
        did,
        runAt: 1,
        payload: "{}",
        imageKeys: keys,
        now: 0,
    })
}

beforeEach(async () => {
    db = createFakeD1()
    r2 = createFakeR2()
    holder.env = { DB: db, SCHEDULE_IMAGES: r2, SCHEDULE_ENC_KEY: KEY }
    await saveCredential(db, KEY, { did: DID, service: "s", token: "t" }, 1)
})

describe("DELETE /v2/schedules/{id}", () => {
    test("schedule-api/AC-9: 待機中の予約の取消で画像も削除され、認証情報は残る", async () => {
        await add("s1", DID, true)
        expect(r2.objects.size).toBe(1)
        const res = await del("s1")
        expect(res.status).toBe(200)
        expect(await getSchedule(db, DID, "s1")).toBeNull()
        expect(r2.objects.size).toBe(0)
        expect(await loadCredential(db, KEY, DID)).not.toBeNull()
    })

    test("schedule-api/AC-9: 投稿済みの予約の削除は成功し、実行中の予約の削除は409になる", async () => {
        await add("done")
        await add("busy")
        await claimDueSchedules(db, 10, 5)
        await failSchedule(db, "done", "InvalidRecord", 11)
        expect((await del("done")).status).toBe(200)
        const busy = await del("busy")
        expect(busy.status).toBe(409)
        expect((await busy.json()).error).toBe("ScheduleRunning")
        expect(await getSchedule(db, DID, "busy")).not.toBeNull()
    })

    test("schedule-api/AC-14: 他人の予約は404、未認証は401で、キャッシュを禁止する", async () => {
        await add("other", "did:plc:other")
        const res = await del("other")
        expect(res.status).toBe(404)
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await getSchedule(db, "did:plc:other", "other")).not.toBeNull()
        expect((await del("x", {})).status).toBe(401)
    })
})

// ---------------------------------------------------------------------------
// 内容の取得と置き換え（GET・PUT /v2/schedules/{id}）
// ---------------------------------------------------------------------------

type Handler = (c: APIContext) => Promise<Response>
const runAtIn = (seconds: number) =>
    new Date(Date.now() + seconds * 1000).toISOString()

/** 画像1枚つきの2件のスレッドの予約の入力（作成と置き換えで共通） */
const threadForm = (opts: { runAt?: string; text?: string; image?: string }) => {
    const fd = new FormData()
    fd.set("posts[0][text]", opts.text ?? "first")
    fd.append("posts[0][langs]", "ja")
    fd.append(
        "posts[0][images]",
        new Blob([opts.image ?? "IMG-A"], { type: "image/png" }),
    )
    fd.set(
        "posts[0][imagesMeta]",
        JSON.stringify([{ width: 10, height: 20, alt: "代替" }]),
    )
    fd.set("posts[1][text]", "second")
    fd.set("runAt", opts.runAt ?? runAtIn(3600))
    return fd
}

const create = async (fd: FormData): Promise<string> => {
    const res = await (POST as unknown as Handler)({
        request: new Request("http://localhost/v2/schedules/", {
            method: "POST",
            headers: { cookie: "sid=1" },
            body: fd,
        }),
        locals: { session: { did: DID } },
    } as unknown as APIContext)
    expect(res.status).toBe(200)
    return (await res.json()).id
}

const getDetail = (id: string, did = DID) =>
    (GET as unknown as Handler)({
        params: { id },
        locals: { session: { did } },
        request: new Request(`http://localhost/v2/schedules/${id}/`),
    } as unknown as APIContext)

const getImageOf = (id: string, index: string, did = DID) =>
    (GET_IMAGE as unknown as Handler)({
        params: { id, index },
        locals: { session: { did } },
        request: new Request(`http://localhost/v2/schedules/${id}/images/${index}/`),
    } as unknown as APIContext)

const put = (id: string, fd: FormData) =>
    (PUT as unknown as Handler)({
        params: { id },
        locals: { session: { did: DID } },
        request: new Request(`http://localhost/v2/schedules/${id}/`, {
            method: "PUT",
            headers: { cookie: "sid=1" },
            body: fd,
        }),
    } as unknown as APIContext)

describe("GET /v2/schedules/{id}", () => {
    test("schedule-api/AC-18: 画像つきの待機中の予約の内容と画像の番号が返り、番号で取得した画像が作成時と一致する", async () => {
        const id = await create(threadForm({}))
        const res = await getDetail(id)
        expect(res.status).toBe(200)
        expect(res.headers.get("cache-control")).toBe("no-store")
        const detail = await res.json()
        expect(detail.posts).toHaveLength(2)
        expect(detail.posts[0]).toMatchObject({
            text: "first",
            langs: ["ja"],
            images: [0],
            imagesMeta: [{ width: 10, height: 20, alt: "代替" }],
        })
        expect(detail.posts[0].facets).toBeUndefined()
        const image = await getImageOf(id, "0")
        expect(image.status).toBe(200)
        expect(image.headers.get("content-type")).toBe("image/png")
        expect(image.headers.get("cache-control")).toBe("no-store")
        expect(await image.text()).toBe("IMG-A")
        expect((await getImageOf(id, "1")).status).toBe(404)
    })

    test("schedule-api/AC-19: 他人の予約と、待機中でも失敗でもない予約の内容の取得は404になる", async () => {
        const id = await create(threadForm({}))
        expect((await getDetail(id, "did:plc:other")).status).toBe(404)
        expect((await getImageOf(id, "0", "did:plc:other")).status).toBe(404)
        await db
            .prepare("UPDATE scheduled_posts SET status = 'posted' WHERE id = ?")
            .bind(id)
            .run()
        expect((await getDetail(id)).status).toBe(404)
        expect((await getImageOf(id, "0")).status).toBe(404)
    })

    test("失敗した予約は内容と画像を取得でき、状態は failed になる", async () => {
        const id = await create(threadForm({}))
        await db
            .prepare("UPDATE scheduled_posts SET status = 'failed' WHERE id = ?")
            .bind(id)
            .run()
        const res = await getDetail(id)
        expect(res.status).toBe(200)
        expect((await res.json()).status).toBe("failed")
        expect((await getImageOf(id, "0")).status).toBe(200)
        // 失敗した予約は置き換えられない（書き戻した内容は新規に送る）
        expect((await put(id, threadForm({}))).status).toBe(404)
    })

    test("実行中の予約の内容の取得は409になる", async () => {
        const id = await create(threadForm({}))
        await db
            .prepare("UPDATE scheduled_posts SET status = 'running' WHERE id = ?")
            .bind(id)
            .run()
        const res = await getDetail(id)
        expect(res.status).toBe(409)
        expect((await res.json()).error).toBe("ScheduleRunning")
    })
})

describe("PUT /v2/schedules/{id}", () => {
    test("schedule-api/AC-20: 置き換えると新しい内容と実行時刻で取得でき、置き換え前の画像が削除される", async () => {
        const id = await create(threadForm({}))
        const before = [...r2.objects.keys()]
        const runAt = runAtIn(7200)
        const res = await put(id, threadForm({ runAt, text: "edited", image: "IMG-B" }))
        expect(res.status).toBe(200)
        const detail = await (await getDetail(id)).json()
        expect(detail.posts[0].text).toBe("edited")
        expect(detail.runAt).toBe(
            new Date(Math.floor(Date.parse(runAt) / 1000) * 1000).toISOString(),
        )
        expect(await (await getImageOf(id, "0")).text()).toBe("IMG-B")
        for (const key of before) expect(r2.objects.has(key)).toBe(false)
        expect(r2.objects.size).toBe(1)
    })

    test("schedule-api/AC-21: 実行中の予約の置き換えは409、範囲外の実行時刻は400になり、内容が変わらない", async () => {
        const id = await create(threadForm({}))
        const tooLate = await put(id, threadForm({ runAt: runAtIn(15 * 86400), text: "x" }))
        expect(tooLate.status).toBe(400)
        expect((await (await getDetail(id)).json()).posts[0].text).toBe("first")
        expect(r2.objects.size).toBe(1)

        await db
            .prepare("UPDATE scheduled_posts SET status = 'running' WHERE id = ?")
            .bind(id)
            .run()
        const busy = await put(id, threadForm({ text: "y" }))
        expect(busy.status).toBe(409)
        expect((await busy.json()).error).toBe("ScheduleRunning")
        const row = await getSchedule(db, DID, id)
        expect(JSON.parse(row!.payload).posts[0].text).toBe("first")
        expect(r2.objects.size).toBe(1)
    })

    test("置き換えでは待機中の件数の上限を数えない", async () => {
        const id = await create(threadForm({}))
        for (let i = 0; i < 4; i++) await create(threadForm({}))
        expect((await put(id, threadForm({ text: "z" }))).status).toBe(200)
    })
})
