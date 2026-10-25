import { beforeEach, describe, expect, test, vi } from "vitest"
import type { APIContext } from "astro"
import { createFakeD1 } from "../../helpers/fakeD1"
import { createFakeR2 } from "../../helpers/fakeR2"

const holder = vi.hoisted(() => ({ env: undefined as unknown }))
vi.mock("@/lib/schedule/env", () => ({
    getScheduleEnv: async () => holder.env,
}))

import { DELETE, GET } from "@/pages/v2/schedules/credential"
import {
    claimDueSchedules,
    countPending,
    failSchedule,
    getSchedule,
    insertSchedule,
    markCredentialReauth,
    saveCredential,
    CREDENTIAL_IDLE_SECONDS,
} from "@/lib/schedule/store"
import { putImages } from "@/lib/schedule/imageStaging"

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
        expect(await (await call(GET)).json()).toEqual({
            registered: false,
            reauthRequired: false,
        })
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

    test("schedule-api/AC-23: 登録状態に許可の有効期限の目安が付き、再度の許可が必要なときは登録ありのまま目安を返さない", async () => {
        await saveCredential(
            db,
            KEY,
            { did: DID, service: "s", token: "t" },
            100,
            { authorized: true },
        )
        const body = await (await call(GET)).json()
        expect(body).toMatchObject({ registered: true, reauthRequired: false })
        expect(body.expiresAt).toBe(
            new Date((100 + CREDENTIAL_IDLE_SECONDS) * 1000).toISOString(),
        )
        await markCredentialReauth(db, DID)
        const reauth = await (await call(GET)).json()
        expect(reauth).toMatchObject({ registered: true, reauthRequired: true })
        expect(reauth.expiresAt).toBeUndefined()
    })

    test("schedule-api/AC-11: 削除で待機中と失敗の予約と画像が消え、実行中の予約があると409になる", async () => {
        const r2 = holder.env as {
            SCHEDULE_IMAGES: ReturnType<typeof createFakeR2>
        }
        await saveCredential(db, KEY, { did: DID, service: "s", token: "t" }, 1)
        const keys = await putImages(r2.SCHEDULE_IMAGES, DID, "p1", "g", [
            { bytes: new ArrayBuffer(2), mime: "image/png" },
        ])
        for (const [id, imageKeys] of [
            ["p1", keys],
            ["p2", []],
            ["busy", []],
        ] as const) {
            await insertSchedule(db, {
                id,
                did: DID,
                runAt: id === "busy" ? 1 : 9e9,
                payload: "{}",
                imageKeys: [...imageKeys],
                now: 0,
            })
        }
        // 実行中の予約がある間は、何も消さずに409
        await claimDueSchedules(db, 10, 5)
        const busy = await call(DELETE)
        expect(busy.status).toBe(409)
        expect((await busy.json()).error).toBe("ScheduleRunning")
        expect(await countPending(db, DID)).toBe(2)
        expect((await (await call(GET)).json()).registered).toBe(true)

        // 実行が終われば、待機中の予約と失敗の履歴を削除して認証情報を削除する
        await failSchedule(db, "busy", "InvalidRecord", 11)
        const ok = await call(DELETE)
        expect(ok.status).toBe(200)
        expect(await ok.json()).toEqual({
            registered: false,
            cancelled: 2,
            deletedHistory: 1,
        })
        expect(await countPending(db, DID)).toBe(0)
        expect(r2.SCHEDULE_IMAGES.objects.size).toBe(0)
        expect((await (await call(GET)).json()).registered).toBe(false)
        // 失敗の履歴も残らない
        expect(await getSchedule(db, DID, "busy")).toBeNull()
    })

    test("schedule-api/AC-25: 登録状態の取得がヒント cookie を保存し、削除がヒント cookie を失効させる", async () => {
        const hintOf = (res: Response) =>
            res.headers
                .getSetCookie()
                .find(c => c.startsWith("skyshare_schedule="))!
        const decode = (cookie: string) =>
            JSON.parse(decodeURIComponent(cookie.split(";")[0]!.split("=")[1]!))

        expect(decode(hintOf(await call(GET)))).toEqual({
            registered: false,
            reauthRequired: false,
        })
        await saveCredential(
            db,
            KEY,
            { did: DID, service: "s", token: "t" },
            100,
            { authorized: true },
        )
        const hint = decode(hintOf(await call(GET)))
        expect(hint).toMatchObject({ registered: true, reauthRequired: false })
        expect(hint.expiresAt).toBe(
            new Date((100 + CREDENTIAL_IDLE_SECONDS) * 1000).toISOString(),
        )
        await markCredentialReauth(db, DID)
        expect(decode(hintOf(await call(GET)))).toEqual({
            registered: true,
            reauthRequired: true,
        })

        expect(hintOf(await call(DELETE))).toContain("Max-Age=0")
    })

    test("schedule-api/AC-14: 未認証は401で、キャッシュを禁止する", async () => {
        for (const handler of [GET, DELETE]) {
            const unauth = await call(handler, { method: "GET" }, {})
            expect(unauth.status).toBe(401)
            expect(unauth.headers.get("cache-control")).toBe("no-store")
        }
    })
})
