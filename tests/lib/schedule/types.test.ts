import { describe, expect, test } from "vitest"
import { createFakeD1 } from "../../helpers/fakeD1"
import {
    CLAIM_LIMIT,
    MAX_IMAGE_BYTES_PER_SCHEDULE,
    SCHEDULE_STATUSES,
    emptyProgress,
} from "@/lib/schedule/types"

describe("schedule types", () => {
    test("schedule-store/AC-1: 状態は3種で、3種以外の行は保存できない", async () => {
        expect([...SCHEDULE_STATUSES]).toEqual(["pending", "running", "failed"])
        const db = createFakeD1()
        await expect(
            db
                .prepare(
                    "INSERT INTO scheduled_posts (id, did, run_at, status, payload, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                )
                .bind("a", "did:plc:x", 1, "unknown", "{}", 1)
                .run(),
        ).rejects.toThrow()
    })

    test("上限値と空の進捗が仕様どおり", () => {
        expect(CLAIM_LIMIT).toBe(5)
        expect(MAX_IMAGE_BYTES_PER_SCHEDULE).toBe(10_000_000)
        expect(emptyProgress()).toEqual({
            rkeys: [],
            blobs: {},
            created: [],
            gates: 0,
            entryDone: false,
        })
    })
})
