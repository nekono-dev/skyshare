import { beforeEach, describe, expect, test, vi } from "vitest"
import type { APIContext } from "astro"
import { createFakeD1 } from "../../helpers/fakeD1"
import { createFakeR2 } from "../../helpers/fakeR2"

const holder = vi.hoisted(() => ({ env: undefined as unknown }))
vi.mock("@/lib/schedule/env", () => ({
    getScheduleEnv: async () => holder.env,
}))

import { DELETE } from "@/pages/v2/schedules/[id]"
import {
    claimDueSchedules,
    finishSchedule,
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
        ? await putImages(r2, did, id, [
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
    test("schedule-api/AC-9: 待機中の予約の取消で画像も削除され、不要になった認証情報も削除される", async () => {
        await add("s1", DID, true)
        expect(r2.objects.size).toBe(1)
        const res = await del("s1")
        expect(res.status).toBe(200)
        expect(await getSchedule(db, DID, "s1")).toBeNull()
        expect(r2.objects.size).toBe(0)
        expect(await loadCredential(db, KEY, DID)).toBeNull()
    })

    test("schedule-api/AC-9: 投稿済みの予約の削除は成功し、実行中の予約の削除は409になる", async () => {
        await add("done")
        await add("busy")
        await claimDueSchedules(db, 10, 5)
        await finishSchedule(db, "done", { status: "posted" }, 11)
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
