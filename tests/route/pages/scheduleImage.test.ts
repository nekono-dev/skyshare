/** 予約用画像と認証情報 API の応答を確認する。 */
import { env } from "cloudflare:test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { insertSchedule } from "@/lib/schedule/store"
import { putImages } from "@/lib/schedule/imageStaging"
import { TEST_DID, TEST_HANDLE } from "../../fixtures/identities"
import {
    NOW,
    resetScheduleTables,
    seedCredential,
    seedRunningSchedule,
} from "../schedule/support"
import { GET as GET_IMAGE } from "@/pages/v2/schedules/[id]/images/[index]"
import {
    DELETE as DELETE_CREDENTIAL,
    GET as GET_CREDENTIAL,
} from "@/pages/v2/schedules/credential"

/** 認証情報の既定の値（seedCredential の authorized_at・updated_at は NOW） */
const IDLE_EXPIRY_ISO = new Date((NOW + 30 * 24 * 60 * 60) * 1000).toISOString()

/** 予約の行を 1 件入れる（待機中）。画像のキーは引数で与える */
const seedPending = (id: string, imageKeys: string[] = []) =>
    insertSchedule(env.DB, {
        id,
        did: TEST_DID,
        runAt: NOW + 3600,
        payload: JSON.stringify({ posts: [{ text: id }] }),
        imageKeys,
        now: NOW,
    })

/** 予約の行の状態を失敗に変える（検査用の直接更新） */
const markFailed = (id: string) =>
    env.DB.prepare("UPDATE scheduled_posts SET status = 'failed' WHERE id = ?")
        .bind(id)
        .run()

/** 画像の番号 0 と 1 の内容（MIME も違えて、番号どおりに返ることを確かめる） */
const IMAGE_0 = new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer
const IMAGE_1 = new Uint8Array([9, 8, 7]).buffer as ArrayBuffer

/** 画像を R2 に保管し、保管したキーの配列を返す */
const seedImages = (id: string) =>
    putImages(env.SCHEDULE_IMAGES, TEST_DID, id, "gen1", [
        { bytes: IMAGE_0, mime: "image/png" },
        { bytes: IMAGE_1, mime: "image/jpeg" },
    ])

/** GET /v2/schedules/{id}/images/{index} を呼ぶ */
const getImage = (
    id: string,
    index: string,
    opts: { session?: boolean } = {},
) => {
    const locals =
        opts.session === false
            ? {}
            : { session: { did: TEST_DID, handle: TEST_HANDLE } }
    return GET_IMAGE({ params: { id, index }, locals } as never)
}

/** GET /v2/schedules/credential を呼ぶ */
const getCredential = (opts: { session?: boolean } = {}) => {
    const locals =
        opts.session === false
            ? {}
            : { session: { did: TEST_DID, handle: TEST_HANDLE } }
    return GET_CREDENTIAL({ locals } as never)
}

/** DELETE /v2/schedules/credential を呼ぶ */
const deleteCredential = (opts: { session?: boolean } = {}) => {
    const locals =
        opts.session === false
            ? {}
            : { session: { did: TEST_DID, handle: TEST_HANDLE } }
    return DELETE_CREDENTIAL({ locals } as never)
}

/** 指定のアカウントの予約の行の件数（検査用） */
const countSchedules = async (): Promise<number> => {
    const row = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM scheduled_posts WHERE did = ?",
    )
        .bind(TEST_DID)
        .first<{ n: number }>()
    return row?.n ?? 0
}

/** 指定のアカウントの認証情報の件数（検査用） */
const countCredentials = async (): Promise<number> => {
    const row = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM schedule_credentials WHERE did = ?",
    )
        .bind(TEST_DID)
        .first<{ n: number }>()
    return row?.n ?? 0
}

describe("GET /v2/schedules/{id}/images/{index}", () => {
    beforeEach(async () => {
        await resetScheduleTables()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns 404 when the index is out of range", async () => {
        const keys = await seedImages("img-range")
        await seedPending("img-range", keys)
        const res = await getImage("img-range", "2")
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: "Not Found" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })

    it("returns 409 ScheduleRunning for a running schedule", async () => {
        await seedRunningSchedule({
            id: "img-running",
            payload: { posts: [{ text: "実行中" }] },
        })
        const res = await getImage("img-running", "0")
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ error: "ScheduleRunning" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })

    it("returns 200 with the stored bytes, content-type and no-store for a pending schedule", async () => {
        const keys = await seedImages("img-ok")
        await seedPending("img-ok", keys)
        const res = await getImage("img-ok", "1")
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("image/jpeg")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(
            new Uint8Array(IMAGE_1),
        )
    })

    it("returns 200 with the image of index 0 for a failed schedule", async () => {
        const keys = await seedImages("img-failed")
        await seedPending("img-failed", keys)
        await markFailed("img-failed")
        const res = await getImage("img-failed", "0")
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("image/png")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(new Uint8Array(await res.arrayBuffer())).toEqual(
            new Uint8Array(IMAGE_0),
        )
    })

    it("returns 401 when there is no session", async () => {
        const keys = await seedImages("img-nosession")
        await seedPending("img-nosession", keys)
        const res = await getImage("img-nosession", "0", { session: false })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
    })
})

describe("GET /v2/schedules/credential", () => {
    beforeEach(async () => {
        await resetScheduleTables()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns registered false and the hint cookie when no credential is registered", async () => {
        const res = await getCredential()
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await res.json()).toEqual({
            registered: false,
        })
        expect(res.headers.getSetCookie()).toEqual([
            "skyshare_schedule=%7B%22registered%22%3Afalse%7D; Path=/; Max-Age=604800; SameSite=Lax",
        ])
    })

    it("returns registered true with updatedAt and expiresAt, and the hint cookie carrying the same expiry", async () => {
        await seedCredential()
        const res = await getCredential()
        expect(res.status).toBe(200)
        expect(res.headers.get("cache-control")).toBe("no-store")

        const body = (await res.json()) as Record<string, unknown>
        expect(Object.keys(body).sort()).toEqual([
            "expiresAt",
            "registered",
            "updatedAt",
        ])
        expect(body).toEqual({
            registered: true,
            updatedAt: new Date(NOW * 1000).toISOString(),
            expiresAt: IDLE_EXPIRY_ISO,
        })
        expect(res.headers.getSetCookie()).toEqual([
            "skyshare_schedule=%7B%22registered%22%3Atrue%2C%22expiresAt%22%3A%222027-02-14T08%3A00%3A00.000Z%22%7D; Path=/; Max-Age=604800; SameSite=Lax",
        ])
    })

    it("returns 401 when there is no session", async () => {
        const res = await getCredential({ session: false })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
    })
})

describe("DELETE /v2/schedules/credential", () => {
    beforeEach(async () => {
        await resetScheduleTables()
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns 409 ScheduleRunning and keeps the credential and the waiting schedules", async () => {
        await seedCredential()
        await seedPending("del-waiting")
        await seedRunningSchedule({
            id: "del-running",
            payload: { posts: [{ text: "実行中" }] },
        })
        const res = await deleteCredential()
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ error: "ScheduleRunning" })
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await countCredentials()).toBe(1)
        expect(await countSchedules()).toBe(2)
    })

    it("returns 200 with the cancelled and deletedHistory counts, removes the images, and clears the hint cookie", async () => {
        await seedCredential()
        const pendingKeys = await seedImages("del-pending")
        await seedPending("del-pending", pendingKeys)
        await seedPending("del-pending-2")
        await seedPending("del-failed")
        const failedKeys = await putImages(
            env.SCHEDULE_IMAGES,
            TEST_DID,
            "del-failed",
            "gen2",
            [{ bytes: IMAGE_0, mime: "image/png" }],
        )
        await env.DB.prepare(
            "UPDATE scheduled_posts SET image_keys = ? WHERE id = ?",
        )
            .bind(JSON.stringify(failedKeys), "del-failed")
            .run()
        await markFailed("del-failed")

        const res = await deleteCredential()
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await res.json()).toEqual({
            registered: false,
            cancelled: 2,
            deletedHistory: 1,
        })
        expect(res.headers.getSetCookie()).toEqual([
            "skyshare_schedule=; Path=/; Max-Age=0; SameSite=Lax",
        ])

        expect(await countSchedules()).toBe(0)
        expect(await countCredentials()).toBe(0)
        expect(await env.SCHEDULE_IMAGES.get(pendingKeys[0]!)).toBeNull()
        expect(await env.SCHEDULE_IMAGES.get(failedKeys[0]!)).toBeNull()
    })

    it("returns 401 when there is no session", async () => {
        const res = await deleteCredential({ session: false })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
    })
})
