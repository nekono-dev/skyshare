import type { D1Database } from "@/lib/schedule/cfTypes"
import { describe, expect, test } from "vitest"
import { createFakeD1 } from "../../helpers/fakeD1"
import {
    claimDueSchedules,
    countPending,
    deleteSchedule,
    finishSchedule,
    getSchedule,
    insertSchedule,
    listSchedules,
    purgeFinished,
    releaseSchedule,
    requeueStale,
    saveProgress,
} from "@/lib/schedule/store"
import { emptyProgress } from "@/lib/schedule/types"

const A = "did:plc:aaaa"
const B = "did:plc:bbbb"

const add = (db: D1Database, id: string, runAt: number, did = A, now = 0) =>
    insertSchedule(db, {
        id,
        did,
        runAt,
        payload: "{}",
        imageKeys: [],
        now,
    })

describe("schedule store", () => {
    test("schedule-store/AC-1: 新規の予約は待機として保存される", async () => {
        const db = createFakeD1()
        await add(db, "s1", 100)
        const row = await getSchedule(db, A, "s1")
        expect(row?.status).toBe("pending")
        expect(row?.attempts).toBe(0)
    })

    test("schedule-store/AC-2: 別のアカウントの予約は取得・一覧・削除できない", async () => {
        const db = createFakeD1()
        await add(db, "s1", 100, A)
        expect(await getSchedule(db, B, "s1")).toBeNull()
        expect((await listSchedules(db, B, { limit: 10 })).items).toHaveLength(
            0,
        )
        expect(await deleteSchedule(db, B, "s1")).toBeNull()
        expect(await getSchedule(db, A, "s1")).not.toBeNull()
    })

    test("schedule-store/AC-3: 到来した予約を早い順に指定件数だけ実行中にする", async () => {
        const db = createFakeD1()
        await add(db, "s3", 30)
        await add(db, "s1", 10)
        await add(db, "s2", 20)
        await add(db, "later", 9999)
        const claimed = await claimDueSchedules(db, 100, 2)
        expect(claimed.map(r => r.id)).toEqual(["s1", "s2"])
        expect(claimed.every(r => r.status === "running")).toBe(true)
        expect((await getSchedule(db, A, "s3"))?.status).toBe("pending")
        expect((await getSchedule(db, A, "later"))?.status).toBe("pending")
    })

    test("schedule-store/AC-4: 同じ予約を2回続けて取り出さない", async () => {
        const db = createFakeD1()
        await add(db, "s1", 10)
        expect(await claimDueSchedules(db, 100, 5)).toHaveLength(1)
        expect(await claimDueSchedules(db, 100, 5)).toHaveLength(0)
    })

    test("schedule-store/AC-8: 保存した進捗が取り出し直しても返る", async () => {
        const db = createFakeD1()
        await add(db, "s1", 10)
        await claimDueSchedules(db, 100, 5)
        const progress = { ...emptyProgress(), rkeys: ["a", "b"], gates: 1 }
        expect(await saveProgress(db, "s1", progress, 101)).toBe(true)
        await releaseSchedule(db, "s1", false, 102)
        const again = await claimDueSchedules(db, 200, 5)
        expect(JSON.parse(again[0]!.progress)).toEqual(progress)
    })

    test("schedule-store/AC-8: 実行中でない予約への進捗の保存は false を返す", async () => {
        const db = createFakeD1()
        await add(db, "s1", 10)
        expect(await saveProgress(db, "s1", emptyProgress(), 5)).toBe(false)
    })

    test("schedule-store/AC-9: 指定の時間を超えた実行中の予約だけ待機に戻る", async () => {
        const db = createFakeD1()
        await add(db, "old", 1)
        await add(db, "fresh", 2)
        await claimDueSchedules(db, 100, 5)
        await saveProgress(db, "fresh", emptyProgress(), 650)
        expect(await requeueStale(db, 701, 600)).toBe(1)
        expect((await getSchedule(db, A, "old"))?.status).toBe("pending")
        expect((await getSchedule(db, A, "old"))?.attempts).toBe(1)
        expect((await getSchedule(db, A, "fresh"))?.status).toBe("running")
    })

    test("schedule-store/AC-10: 終了から7日を超えた投稿済みと失敗だけが削除される", async () => {
        const db = createFakeD1()
        const week = 7 * 24 * 60 * 60
        await add(db, "posted-old", 1)
        await add(db, "failed-old", 2)
        await add(db, "posted-new", 3)
        await add(db, "pending", 4)
        await claimDueSchedules(db, 10, 3)
        await finishSchedule(
            db,
            "posted-old",
            { status: "posted", resultUri: "at://x" },
            100,
        )
        await finishSchedule(
            db,
            "failed-old",
            { status: "failed", lastError: "E" },
            100,
        )
        await finishSchedule(db, "posted-new", { status: "posted" }, 100 + week)
        const purged = await purgeFinished(db, 100 + week + 1, week)
        expect(purged.map(r => r.id).sort()).toEqual([
            "failed-old",
            "posted-old",
        ])
        expect(await getSchedule(db, A, "posted-new")).not.toBeNull()
        expect(await getSchedule(db, A, "pending")).not.toBeNull()
    })

    test("schedule-store/AC-11: 1回の取り出しは5件まで", async () => {
        const db = createFakeD1()
        for (let i = 0; i < 6; i++) await add(db, `s${i}`, i)
        expect(await claimDueSchedules(db, 100, 99)).toHaveLength(5)
    })

    test("schedule-store/AC-13: 予約1件の保存と取得の問い合わせは3回以内", async () => {
        const db = createFakeD1()
        const before = db.queryCount
        await add(db, "s1", 10)
        await getSchedule(db, A, "s1")
        expect(db.queryCount - before).toBeLessThanOrEqual(3)
    })

    test("schedule-store/AC-14: 戻すと進捗が保たれ、回数は指定のときだけ増える", async () => {
        const db = createFakeD1()
        await add(db, "s1", 1)
        await claimDueSchedules(db, 10, 5)
        await saveProgress(db, "s1", { ...emptyProgress(), gates: 2 }, 11)
        await releaseSchedule(db, "s1", false, 12)
        expect((await getSchedule(db, A, "s1"))?.attempts).toBe(0)
        await claimDueSchedules(db, 20, 5)
        await releaseSchedule(db, "s1", true, 21)
        const row = await getSchedule(db, A, "s1")
        expect(row?.attempts).toBe(1)
        expect(row?.status).toBe("pending")
        expect(JSON.parse(row!.progress).gates).toBe(2)
    })

    test("実行中の予約は削除されず、待機中の件数と一覧のカーソルが働く", async () => {
        const db = createFakeD1()
        await add(db, "s1", 1)
        await add(db, "s2", 2)
        await add(db, "s3", 3)
        expect(await countPending(db, A)).toBe(3)
        const p1 = await listSchedules(db, A, { limit: 2 })
        expect(p1.items.map(r => r.id)).toEqual(["s1", "s2"])
        const p2 = await listSchedules(db, A, { limit: 2, cursor: p1.cursor })
        expect(p2.items.map(r => r.id)).toEqual(["s3"])
        expect(p2.cursor).toBeUndefined()
        await claimDueSchedules(db, 10, 1)
        expect(await deleteSchedule(db, A, "s1")).toBeNull()
        expect(await getSchedule(db, A, "s1")).not.toBeNull()
        expect(
            (await listSchedules(db, A, { limit: 10, status: "pending" }))
                .items,
        ).toHaveLength(2)
    })
})
