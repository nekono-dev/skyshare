/**
 * Verifies schedule cleanup failures do not change operation results.
 */
// 画像の削除（removeImages）と予約の保存（insertSchedule）を失敗させ、現行の応答と行の状態を固定する。
// 画像の後始末の失敗は予約の操作の結果を変えず、記録だけする。振る舞いを変えるためのテストではない。
import { env } from "cloudflare:test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// 失敗の注入の状態。vi.mock の工場関数はファイルの先頭へ巻き上げられるため、hoisted で作る
const state = vi.hoisted(() => ({
    // true のとき removeImages は reject する
    failRemoveImages: false,
    // true のとき insertSchedule は reject する
    failInsertSchedule: false,
    // removeImages に渡されたキーの配列を、呼ばれた順に記録する
    removeImagesCalls: [] as string[][],
}))

// 画像の削除だけを差し替える。失敗させないときは実物の削除へ委ねる
vi.mock("@/lib/schedule/imageStaging", async () => {
    const actual = await vi.importActual<
        typeof import("@/lib/schedule/imageStaging")
    >("@/lib/schedule/imageStaging")
    return {
        ...actual,
        removeImages: async (
            bucket: Parameters<typeof actual.removeImages>[0],
            keys: string[],
        ) => {
            state.removeImagesCalls.push([...keys])
            if (state.failRemoveImages) {
                throw new Error("R2 delete failed (fixture)")
            }
            return actual.removeImages(bucket, keys)
        },
    }
})

// 予約の保存だけを差し替える。失敗させないときは実物の保存へ委ねる
vi.mock("@/lib/schedule/store", async () => {
    const actual = await vi.importActual<typeof import("@/lib/schedule/store")>(
        "@/lib/schedule/store",
    )
    return {
        ...actual,
        insertSchedule: async (
            db: Parameters<typeof actual.insertSchedule>[0],
            input: Parameters<typeof actual.insertSchedule>[1],
        ) => {
            if (state.failInsertSchedule) {
                throw new Error("D1 insert failed (fixture)")
            }
            return actual.insertSchedule(db, input)
        },
    }
})

import { insertSchedule } from "@/lib/schedule/store"
import { TEST_DID, TEST_HANDLE } from "../../fixtures/identities"
import { NOW, resetScheduleTables, seedCredential } from "../schedule/support"
import { DELETE, PUT } from "@/pages/v2/schedules/[id]"
import { POST } from "@/pages/v2/schedules"

/** 有効な実行時刻（現在から 1 時間後。実行時刻は Date.now() を基準に検証される） */
const validRunAt = () => new Date(Date.now() + 3600 * 1000).toISOString()

/** 有効な入力（本文 1 件・画像なし）の multipart */
const formOf = (text: string) => {
    const form = new FormData()
    form.append("runAt", validRunAt())
    form.append("posts[0][text]", text)
    return form
}

/** 画像のキーを持つ待機中の行を 1 件入れる */
const seedPendingWithImages = (id: string, imageKeys: string[]) =>
    insertSchedule(env.DB, {
        id,
        did: TEST_DID,
        runAt: NOW + 3600,
        payload: JSON.stringify({ posts: [{ text: "元の本文" }] }),
        imageKeys,
        now: NOW,
    })

/** 行の状態を D1 から読む（検査用） */
const rowOf = (id: string) =>
    env.DB.prepare(
        "SELECT run_at, payload, image_keys FROM scheduled_posts WHERE id = ?",
    )
        .bind(id)
        .first<{ run_at: number; payload: string; image_keys: string }>()

/** PUT /v2/schedules/{id} を呼ぶ（認証済み） */
const put = (id: string, text: string) => {
    const request = new Request(`https://skyshare.test/v2/schedules/${id}`, {
        method: "PUT",
        headers: { cookie: "atp_session=fixture" },
        body: formOf(text),
    })
    return PUT({
        params: { id },
        request,
        locals: { session: { did: TEST_DID, handle: TEST_HANDLE } },
    } as never)
}

/** DELETE /v2/schedules/{id} を呼ぶ（認証済み） */
const del = (id: string) =>
    DELETE({
        params: { id },
        locals: { session: { did: TEST_DID, handle: TEST_HANDLE } },
    } as never)

/** POST /v2/schedules を呼ぶ（認証済み・本文 1 件・画像なし） */
const post = () => {
    const request = new Request("https://skyshare.test/v2/schedules", {
        method: "POST",
        headers: { cookie: "atp_session=fixture" },
        body: formOf("予約の本文"),
    })
    return POST({
        request,
        locals: { session: { did: TEST_DID, handle: TEST_HANDLE } },
    } as never)
}

describe("schedule cleanup failures do not change operation results", () => {
    // 記録だけの確認に使う console.error の spy（ログの本文は読まず、呼ばれたことだけを見る）
    let errorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(async () => {
        await resetScheduleTables()
        state.failRemoveImages = false
        state.failInsertSchedule = false
        state.removeImagesCalls = []
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe("PUT /v2/schedules/{id}", () => {
        it("returns 200 with id and runAt, and updates the row, when removeImages rejects", async () => {
            await seedCredential()
            const oldKey = `schedules/${TEST_DID}/cl-put/g0/0`
            await seedPendingWithImages("cl-put", [oldKey])
            state.failRemoveImages = true

            const res = await put("cl-put", "置き換えた本文")
            expect(res.status).toBe(200)
            const body = (await res.json()) as Record<string, unknown>
            expect(Object.keys(body).sort()).toEqual(["id", "runAt"])
            expect(body.id).toBe("cl-put")
            expect(typeof body.runAt).toBe("string")

            // 置き換えの保存は済んでいる（後始末の失敗では巻き戻さない）
            const row = await rowOf("cl-put")
            expect(row?.run_at).toBe(
                Math.floor(new Date(body.runAt as string).getTime() / 1000),
            )
            expect(JSON.parse(row!.payload)).toEqual({
                posts: [{ text: "置き換えた本文" }],
            })
            expect(JSON.parse(row!.image_keys)).toEqual([])

            // 置き換え前の画像の削除を試み、失敗は記録だけしている
            expect(state.removeImagesCalls).toEqual([[oldKey]])
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining("removeImages failed id=cl-put"),
                expect.anything(),
            )
        })
    })

    describe("DELETE /v2/schedules/{id}", () => {
        it("returns 200 with an empty object, and removes the row, when removeImages rejects", async () => {
            await seedCredential()
            const keys = [
                `schedules/${TEST_DID}/cl-del/g0/0`,
                `schedules/${TEST_DID}/cl-del/g0/1`,
            ]
            await seedPendingWithImages("cl-del", keys)
            state.failRemoveImages = true

            const res = await del("cl-del")
            expect(res.status).toBe(200)
            expect(res.headers.get("cache-control")).toBe("no-store")
            expect(await res.json()).toEqual({})

            // 行は消えている（後始末の失敗では消さない操作を戻さない）
            expect(await rowOf("cl-del")).toBeNull()

            // 保管していた画像の削除を試み、失敗は記録だけしている
            expect(state.removeImagesCalls).toEqual([keys])
            expect(errorSpy).toHaveBeenCalledWith(
                "schedules DELETE: removeImages failed",
                expect.anything(),
            )
        })
    })

    describe("POST /v2/schedules", () => {
        it("returns 500 when insertSchedule rejects, and cleans up the staged images", async () => {
            await seedCredential()
            state.failInsertSchedule = true

            const res = await post()
            expect(res.status).toBe(500)
            expect(await res.json()).toEqual({
                error: "Internal Server Error",
            })
            expect(res.headers.get("cache-control")).toBe("no-store")

            // 予約の行は作られていない
            const count = await env.DB.prepare(
                "SELECT COUNT(*) AS n FROM scheduled_posts WHERE did = ?",
            )
                .bind(TEST_DID)
                .first<{ n: number }>()
            expect(count?.n).toBe(0)

            // 画像のない投稿でも、現行は空のキーの配列で削除を呼ぶ
            expect(state.removeImagesCalls).toEqual([[]])
            expect(errorSpy).toHaveBeenCalledWith(
                "schedules POST: insertSchedule failed",
                expect.anything(),
            )
        })
    })
})
