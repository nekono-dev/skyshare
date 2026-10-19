import type { R2Bucket } from "@/lib/schedule/cfTypes"
import { describe, expect, test } from "vitest"
import { createFakeD1 } from "../../helpers/fakeD1"
import { putImages, removeImages } from "@/lib/schedule/imageStaging"
import { deleteSchedule, insertSchedule } from "@/lib/schedule/store"

const fakeBucket = (failAt?: number) => {
    const objects = new Map<string, ArrayBuffer>()
    let n = 0
    const bucket = {
        put: async (key: string, value: ArrayBuffer) => {
            if (failAt !== undefined && n++ === failAt)
                throw new Error("put 失敗")
            objects.set(key, value)
        },
        delete: async (keys: string | string[]) => {
            for (const k of Array.isArray(keys) ? keys : [keys])
                objects.delete(k)
        },
    } as unknown as R2Bucket
    return { bucket, objects }
}

const img = (bytes: number) => ({
    bytes: new ArrayBuffer(bytes),
    mime: "image/jpeg",
})

describe("imageStaging", () => {
    test("schedule-store/AC-7: 予約を削除すると画像がすべて削除される", async () => {
        const db = createFakeD1()
        const { bucket, objects } = fakeBucket()
        const keys = await putImages(bucket, "did:plc:a", "s1", [
            img(10),
            img(20),
        ])
        expect(keys).toEqual([
            "schedules/did:plc:a/s1/0",
            "schedules/did:plc:a/s1/1",
        ])
        await insertSchedule(db, {
            id: "s1",
            did: "did:plc:a",
            runAt: 1,
            payload: "{}",
            imageKeys: keys,
            now: 0,
        })
        const deleted = await deleteSchedule(db, "did:plc:a", "s1")
        await removeImages(bucket, JSON.parse(deleted!.imageKeys))
        expect(objects.size).toBe(0)
    })

    test("schedule-store/AC-11: 合計10メガバイトを超える保管は何も書かずに拒否される", async () => {
        const { bucket, objects } = fakeBucket()
        await expect(
            putImages(bucket, "d", "s", [img(6_000_000), img(4_000_001)]),
        ).rejects.toThrow()
        expect(objects.size).toBe(0)
        await expect(
            putImages(bucket, "d", "s", [img(6_000_000), img(4_000_000)]),
        ).resolves.toHaveLength(2)
    })

    test("途中の書き込みに失敗したら、書き込み済みの画像を削除して例外を投げる", async () => {
        const { bucket, objects } = fakeBucket(1)
        await expect(
            putImages(bucket, "d", "s", [img(1), img(1), img(1)]),
        ).rejects.toThrow("put 失敗")
        expect(objects.size).toBe(0)
    })
})
