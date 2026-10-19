import { beforeEach, describe, expect, test, vi } from "vitest"
import type { APIContext } from "astro"
import { createFakeD1 } from "../../helpers/fakeD1"
import { createFakeR2 } from "../../helpers/fakeR2"

const holder = vi.hoisted(() => ({ env: undefined as unknown }))
vi.mock("@/lib/schedule/env", () => ({
    getScheduleEnv: async () => holder.env,
}))

import { DELETE, GET, PUT } from "@/pages/v2/schedules/credential"
import { insertSchedule, saveCredential } from "@/lib/schedule/store"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)))
const DID = "did:plc:aaaa"
const locals = { session: { did: DID }, service: "https://pds.example" }
const call = (h: unknown, init: RequestInit = {}, l: object = locals) =>
    (h as (c: APIContext) => Promise<Response>)({
        request: new Request("http://localhost/v2/schedules/credential/", init),
        locals: l,
    } as unknown as APIContext)

let db: ReturnType<typeof createFakeD1>
beforeEach(() => {
    db = createFakeD1()
    holder.env = {
        DB: db,
        SCHEDULE_IMAGES: createFakeR2(),
        SCHEDULE_ENC_KEY: KEY,
    }
})

describe("/v2/schedules/credential", () => {
    test("schedule-api/AC-11: 登録状態の取得が登録の有無を返す", async () => {
        expect(await (await call(GET)).json()).toEqual({ registered: false })
        await saveCredential(
            db,
            KEY,
            { did: DID, service: "s", token: "TOKEN-VALUE-XYZ" },
            100,
        )
        const body = await (await call(GET)).json()
        expect(body.registered).toBe(true)
        expect(body.updatedAt).toBe(new Date(100_000).toISOString())
        expect(JSON.stringify(body)).not.toContain("TOKEN-VALUE-XYZ")
    })

    test("schedule-api/AC-11: 待機中の予約があると削除は409、ないと成功する", async () => {
        await saveCredential(db, KEY, { did: DID, service: "s", token: "t" }, 1)
        await insertSchedule(db, {
            id: "s1",
            did: DID,
            runAt: 1,
            payload: "{}",
            imageKeys: [],
            now: 0,
        })
        const busy = await call(DELETE)
        expect(busy.status).toBe(409)
        expect((await busy.json()).error).toBe("ScheduleCredentialInUse")
        await db.prepare("DELETE FROM scheduled_posts").run()
        expect((await call(DELETE)).status).toBe(200)
        expect((await (await call(GET)).json()).registered).toBe(false)
    })

    test("schedule-api/AC-14: 未認証は401、不正な本文は400で、キャッシュを禁止する", async () => {
        const unauth = await call(GET, {}, {})
        expect(unauth.status).toBe(401)
        expect(unauth.headers.get("cache-control")).toBe("no-store")
        const bad = await call(PUT, { method: "PUT", body: "{}" })
        expect(bad.status).toBe(400)
        expect(bad.headers.get("cache-control")).toBe("no-store")
    })
})
