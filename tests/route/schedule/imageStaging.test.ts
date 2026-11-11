/**
 * Verifies ownership and cleanup of staged schedule images.
 */
import { env } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import type { R2Bucket } from "@/lib/platform/cfTypes"
import { getImage, putImages, removeImages } from "@/lib/schedule/imageStaging"
import { MAX_IMAGE_BYTES_PER_SCHEDULE } from "@/lib/schedule/types"
import { TEST_DID } from "../../fixtures/identities"

const OTHER_DID = "did:plc:testfixturebob00000000000000"
const bytes = (n: number) => new Uint8Array(n).fill(1).buffer as ArrayBuffer

describe("schedule image staging (cleanup)", () => {
    it("stores each image under the owner's key and reads it back", async () => {
        const keys = await putImages(
            env.SCHEDULE_IMAGES,
            TEST_DID,
            "sched-1",
            "gen1",
            [{ bytes: bytes(4), mime: "image/png" }],
        )
        expect(keys).toEqual([`schedules/${TEST_DID}/sched-1/gen1/0`])
        expect(
            await getImage(env.SCHEDULE_IMAGES, TEST_DID, keys, 0),
        ).toMatchObject({ mime: "image/png" })
    })

    it("refuses images over the per-schedule limit before writing anything", async () => {
        await expect(
            putImages(env.SCHEDULE_IMAGES, TEST_DID, "sched-2", "gen1", [
                {
                    bytes: bytes(MAX_IMAGE_BYTES_PER_SCHEDULE + 1),
                    mime: "image/png",
                },
            ]),
        ).rejects.toThrow("total image size exceeds the limit")
        expect(
            await env.SCHEDULE_IMAGES.get(
                `schedules/${TEST_DID}/sched-2/gen1/0`,
            ),
        ).toBeNull()
    })

    it("removes the images already written when a later write fails, and rethrows the failure", async () => {
        let writes = 0
        const failingOnSecond = {
            put: async (
                key: string,
                value: ArrayBuffer,
                options: Parameters<R2Bucket["put"]>[2],
            ) => {
                writes++
                if (writes === 2) throw new Error("r2 put failed")
                return env.SCHEDULE_IMAGES.put(key, value, options)
            },
            delete: (keys: string[]) => env.SCHEDULE_IMAGES.delete(keys),
        } as unknown as R2Bucket
        await expect(
            putImages(failingOnSecond, TEST_DID, "sched-3", "gen1", [
                { bytes: bytes(4), mime: "image/png" },
                { bytes: bytes(4), mime: "image/png" },
            ]),
        ).rejects.toThrow("r2 put failed")
        expect(
            await env.SCHEDULE_IMAGES.get(
                `schedules/${TEST_DID}/sched-3/gen1/0`,
            ),
        ).toBeNull()
    })

    it("does nothing when there are no keys to remove", async () => {
        await expect(
            removeImages(env.SCHEDULE_IMAGES, []),
        ).resolves.toBeUndefined()
    })

    it("returns null for an image key that belongs to another account, so one account cannot read another's image", async () => {
        const keys = await putImages(
            env.SCHEDULE_IMAGES,
            OTHER_DID,
            "sched-4",
            "gen1",
            [{ bytes: bytes(4), mime: "image/png" }],
        )
        expect(
            await getImage(env.SCHEDULE_IMAGES, TEST_DID, keys, 0),
        ).toBeNull()
    })

    it("returns null for an index that has no key", async () => {
        expect(await getImage(env.SCHEDULE_IMAGES, TEST_DID, [], 0)).toBeNull()
    })
})

describe("schedule image staging (reads)", () => {
    it("returns null for a non-integer index", async () => {
        const keys = await putImages(
            env.SCHEDULE_IMAGES,
            TEST_DID,
            "sched-5",
            "gen1",
            [{ bytes: bytes(4), mime: "image/png" }],
        )
        expect(
            await getImage(env.SCHEDULE_IMAGES, TEST_DID, keys, 0.5),
        ).toBeNull()
    })

    it("returns null when the key is listed but the object is missing", async () => {
        expect(
            await getImage(
                env.SCHEDULE_IMAGES,
                TEST_DID,
                [`schedules/${TEST_DID}/sched-6/gen1/0`],
                0,
            ),
        ).toBeNull()
    })

    it("falls back to a generic type when the stored object has no content type", async () => {
        const key = `schedules/${TEST_DID}/sched-7/gen1/0`
        await env.SCHEDULE_IMAGES.put(key, bytes(4))
        expect(
            await getImage(env.SCHEDULE_IMAGES, TEST_DID, [key], 0),
        ).toMatchObject({ mime: "application/octet-stream" })
    })
})
