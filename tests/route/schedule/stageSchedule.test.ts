/**
 * Verifies schedule validation and staging behavior.
 */
import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import { insertSchedule, markCredentialReauth } from "@/lib/schedule/store"
import { parseScheduleBody, stageSchedule } from "@/lib/schedule/stageSchedule"
import { MAX_PENDING_PER_ACCOUNT } from "@/lib/schedule/scheduleLimits"
import { TEST_DID } from "../../fixtures/identities"
import {
    NOW,
    scheduleEnv,
    seedCredential,
    resetScheduleTables,
} from "./support"

const body = (runAtOffsetSeconds: number) =>
    ({
        posts: [{ text: "予約の本文" }],
        runAt: new Date((NOW + runAtOffsetSeconds) * 1000).toISOString(),
    }) as never

describe("stageSchedule (acceptance)", () => {
    beforeEach(async () => {
        await resetScheduleTables()
    })

    it("rejects a run time that is in the past, without storing anything", async () => {
        await seedCredential()
        const result = await stageSchedule(
            scheduleEnv(),
            TEST_DID,
            "st-past",
            body(-3600),
            NOW,
            { countPending: true },
        )
        expect(result).toEqual({ ok: false, status: 400 })
    })

    it("requires a registered credential (409 ScheduleCredentialRequired) for an owner with none", async () => {
        const result = await stageSchedule(
            scheduleEnv(),
            "did:plc:testfixturenocred000000000",
            "st-nocred",
            body(3600),
            NOW,
            { countPending: true },
        )
        expect(result).toEqual({
            ok: false,
            status: 409,
            error: "ScheduleCredentialRequired",
        })
    })

    it("asks for re-authorization (409 ScheduleReauthRequired) once the credential is marked for it", async () => {
        await seedCredential()
        await markCredentialReauth(env.DB, TEST_DID)
        const result = await stageSchedule(
            scheduleEnv(),
            TEST_DID,
            "st-reauth",
            body(3600),
            NOW,
            { countPending: true },
        )
        expect(result).toEqual({
            ok: false,
            status: 409,
            error: "ScheduleReauthRequired",
        })
    })

    it("refuses a new schedule once the account has reached the pending limit (429)", async () => {
        await seedCredential()
        for (let i = 0; i < MAX_PENDING_PER_ACCOUNT; i++) {
            await insertSchedule(env.DB, {
                id: `st-fill-${i}`,
                did: TEST_DID,
                runAt: NOW + 3600,
                payload: "{}",
                imageKeys: [],
                now: NOW,
            })
        }
        const result = await stageSchedule(
            scheduleEnv(),
            TEST_DID,
            "st-over",
            body(3600),
            NOW,
            { countPending: true },
        )
        expect(result).toEqual({ ok: false, status: 429 })
    })

    it("stores the payload and returns the image keys for a valid schedule", async () => {
        await seedCredential()
        const result = await stageSchedule(
            scheduleEnv(),
            TEST_DID,
            "st-ok",
            body(3600),
            NOW,
            { countPending: true },
        )
        if (!result.ok) throw new Error("expected success")
        expect(result.runAt).toBe(NOW + 3600)
        expect(JSON.parse(result.payload).posts[0].text).toBe("予約の本文")
        expect(result.imageKeys).toEqual([])
    })
})

describe("stageSchedule (images and failures)", () => {
    it("stores the attached images under the owner's keys and returns their keys", async () => {
        await seedCredential()
        const image = new Blob([new Uint8Array([1, 2, 3, 4])], {
            type: "image/png",
        })
        const result = await stageSchedule(
            scheduleEnv(),
            TEST_DID,
            "st-img",
            {
                posts: [{ text: "画像", images: [image] }],
                runAt: new Date((NOW + 3600) * 1000).toISOString(),
            } as never,
            NOW,
            { countPending: true },
        )
        if (!result.ok) throw new Error("expected success")
        expect(result.imageKeys).toHaveLength(1)
        expect(
            result.imageKeys[0]!.startsWith(`schedules/${TEST_DID}/st-img/`),
        ).toBe(true)
        expect(
            await env.SCHEDULE_IMAGES.get(result.imageKeys[0]!),
        ).not.toBeNull()
    })

    it("refuses images over the per-schedule size limit (400)", async () => {
        await seedCredential()
        const huge = new Blob([new Uint8Array(10_000_001)], {
            type: "image/png",
        })
        const result = await stageSchedule(
            scheduleEnv(),
            TEST_DID,
            "st-huge",
            {
                posts: [{ text: "大", images: [huge] }],
                runAt: new Date((NOW + 3600) * 1000).toISOString(),
            } as never,
            NOW,
            { countPending: true },
        )
        expect(result).toEqual({ ok: false, status: 400 })
    })

    it("reports a storage failure as 500 and stores nothing", async () => {
        await seedCredential()
        const brokenBucket = {
            put: async () => {
                throw new Error("r2 unavailable")
            },
            delete: async () => undefined,
        }
        const result = await stageSchedule(
            { ...scheduleEnv(), SCHEDULE_IMAGES: brokenBucket as never },
            TEST_DID,
            "st-r2",
            {
                posts: [
                    {
                        text: "x",
                        images: [
                            new Blob([new Uint8Array([1])], {
                                type: "image/png",
                            }),
                        ],
                    },
                ],
                runAt: new Date((NOW + 3600) * 1000).toISOString(),
            } as never,
            NOW,
            { countPending: true },
        )
        expect(result).toEqual({ ok: false, status: 500 })
    })
})

describe("parseScheduleBody (request form)", () => {
    const RUN_AT = new Date((NOW + 3600) * 1000).toISOString()
    const multipart = (fields: Record<string, string | File>) => {
        const form = new FormData()
        for (const [k, v] of Object.entries(fields)) form.append(k, v)
        return new Request("https://skyshare.test/v2/schedules", {
            method: "POST",
            body: form,
        })
    }

    it("returns null for a request that is not multipart form data", async () => {
        const request = new Request("https://skyshare.test/v2/schedules", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ posts: [{ text: "x" }], runAt: RUN_AT }),
        })
        expect(await parseScheduleBody(request, TEST_DID)).toBeNull()
    })

    it("parses a valid multipart schedule into the request body", async () => {
        const body = await parseScheduleBody(
            multipart({ runAt: RUN_AT, "posts[0][text]": "予約" }),
            TEST_DID,
        )
        expect(body?.posts[0]?.text).toBe("予約")
    })

    it("returns null when the run time is missing", async () => {
        expect(
            await parseScheduleBody(
                multipart({ "posts[0][text]": "予約" }),
                TEST_DID,
            ),
        ).toBeNull()
    })

    it("returns null for an entry without a visual image", async () => {
        expect(
            await parseScheduleBody(
                multipart({
                    runAt: RUN_AT,
                    "posts[0][text]": "x",
                    createEntry: "true",
                }),
                TEST_DID,
            ),
        ).toBeNull()
    })

    it("returns null when the reply points into another account's thread", async () => {
        const foreign = {
            root: {
                uri: "at://did:plc:testfixturebob00000000000000/app.bsky.feed.post/1",
                cid: "c",
            },
            parent: {
                uri: "at://did:plc:testfixturebob00000000000000/app.bsky.feed.post/1",
                cid: "c",
            },
        }
        expect(
            await parseScheduleBody(
                multipart({
                    runAt: RUN_AT,
                    "posts[0][text]": "x",
                    reply: JSON.stringify(foreign),
                }),
                TEST_DID,
            ),
        ).toBeNull()
    })
})
