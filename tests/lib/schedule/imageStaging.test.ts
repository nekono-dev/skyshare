import type { R2Bucket } from "@/lib/schedule/cfTypes"
import { describe, expect, test } from "vitest"
import { createFakeD1 } from "../../helpers/fakeD1"
import { readFileSync } from "node:fs"
import { getImage, putImages, removeImages } from "@/lib/schedule/imageStaging"
import { createFakeR2 } from "../../helpers/fakeR2"
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
        const keys = await putImages(bucket, "did:plc:a", "s1", "g1", [
            img(10),
            img(20),
        ])
        expect(keys).toEqual([
            "schedules/did:plc:a/s1/g1/0",
            "schedules/did:plc:a/s1/g1/1",
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
            putImages(bucket, "d", "s", "g", [img(6_000_000), img(4_000_001)]),
        ).rejects.toThrow()
        expect(objects.size).toBe(0)
        await expect(
            putImages(bucket, "d", "s", "g", [img(6_000_000), img(4_000_000)]),
        ).resolves.toHaveLength(2)
    })

    test("途中の書き込みに失敗したら、書き込み済みの画像を削除して例外を投げる", async () => {
        const { bucket, objects } = fakeBucket(1)
        await expect(
            putImages(bucket, "d", "s", "g", [img(1), img(1), img(1)]),
        ).rejects.toThrow("put 失敗")
        expect(objects.size).toBe(0)
    })

    test("schedule-store/AC-18: 保管した画像を番号で読み出すと書き込んだバイト列が返り、他のアカウントでは返らない", async () => {
        const bucket = createFakeR2()
        const bytes = new Uint8Array([1, 2, 3]).buffer
        const keys = await putImages(bucket, "did:plc:a", "s1", "g1", [
            { bytes, mime: "image/png" },
        ])
        const got = await getImage(bucket, "did:plc:a", keys, 0)
        expect(got?.mime).toBe("image/png")
        expect(new Uint8Array(got!.bytes)).toEqual(new Uint8Array([1, 2, 3]))
        expect(await getImage(bucket, "did:plc:b", keys, 0)).toBeNull()
        expect(await getImage(bucket, "did:plc:a", keys, 1)).toBeNull()
        expect(await getImage(bucket, "did:plc:a", keys, -1)).toBeNull()
    })

    test("同じ予約でも世代が異なれば、キーが重ならない", async () => {
        const bucket = createFakeR2()
        const a = await putImages(bucket, "d", "s", "g1", [img(1)])
        const b = await putImages(bucket, "d", "s", "g2", [img(1)])
        expect(a[0]).not.toBe(b[0])
        await removeImages(bucket, a)
        expect([...bucket.objects.keys()]).toEqual(b)
    })

    test("schedule-store/AC-19: 画像のバケットに保管から15日で削除するライフサイクルの手順が記載されている", () => {
        const doc = readFileSync("DEVELOP.md", "utf8")
        expect(doc).toMatch(/r2 bucket lifecycle add "\$b" expire-15d --expire-days 15/)
        expect(doc).not.toMatch(/--expire-days 45/)
    })
})
