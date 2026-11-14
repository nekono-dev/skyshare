/** 予約投稿の定期実行と後片付けを確認する。 */
import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import { CREDENTIAL_IDLE_SECONDS, insertSchedule } from "@/lib/schedule/store"
import {
    HOUSEKEEPING_MINUTE_OF_DAY_UTC,
    isHousekeepingTime,
    runHousekeeping,
    runScheduledPosts,
} from "@/lib/schedule/runner"
import {
    fakePds,
    NOW,
    PDS,
    scheduleEnv,
    scheduleState,
    seedCredential,
    resetScheduleTables,
} from "./support"

const queue = async (
    id: string,
    runAt: number,
    opts: { did?: string; status?: string; updatedAt?: number } = {},
) => {
    await insertSchedule(env.DB, {
        id,
        did: opts.did ?? "did:plc:testfixturealice0000000000",
        runAt,
        payload: JSON.stringify({ posts: [{ text: id }] }),
        imageKeys: [],
        now: NOW - 300,
    })
    if (opts.status || opts.updatedAt !== undefined) {
        await env.DB.prepare(
            "UPDATE scheduled_posts SET status = COALESCE(?, status), updated_at = COALESCE(?, updated_at) WHERE id = ?",
        )
            .bind(opts.status ?? null, opts.updatedAt ?? null, id)
            .run()
    }
}

describe("runScheduledPosts", () => {
    beforeEach(async () => {
        await resetScheduleTables()
    })

    it("does nothing when the encryption key is not configured, so pending schedules stay queued", async () => {
        await seedCredential()
        await queue("r-nokey", NOW - 60)
        await runScheduledPosts(
            { ...scheduleEnv(), SCHEDULE_ENC_KEY: "" },
            NOW,
            fakePds().fetchImpl,
        )
        expect((await scheduleState("r-nokey"))?.status).toBe("pending")
    })

    it("runs only the schedules whose run time has come", async () => {
        await seedCredential()
        await queue("r-due", NOW - 60)
        await queue("r-future", NOW + 3600)
        await runScheduledPosts(scheduleEnv(), NOW, fakePds().fetchImpl)
        expect(await scheduleState("r-due")).toBeNull()
        expect((await scheduleState("r-future"))?.status).toBe("pending")
    })

    it("requeues a schedule left running by an interrupted run, counting that attempt, before it runs again", async () => {
        await seedCredential()
        // 十分に古い「実行中」の行は、中断された実行の残りとみなし、待機へ戻す
        // 実行の内容は空の投稿にして、再キュー後の実行が分類された失敗になるようにする（投稿は作られない）
        await insertSchedule(env.DB, {
            id: "r-stale",
            did: "did:plc:testfixturealice0000000000",
            runAt: NOW - 60,
            payload: JSON.stringify({ posts: [] }),
            imageKeys: [],
            now: NOW - 300,
        })
        await env.DB.prepare(
            "UPDATE scheduled_posts SET status = 'running', updated_at = ? WHERE id = 'r-stale'",
        )
            .bind(NOW - 3600)
            .run()
        await runScheduledPosts(scheduleEnv(), NOW, fakePds().fetchImpl)
        const state = await scheduleState("r-stale")
        expect(state?.last_error).toBe("InvalidRecord")
        expect(state?.attempts).toBe(1)
    })
})

describe("runScheduledPosts: budget and housekeeping", () => {
    it("stops after a rate limit and releases the remaining due schedules without counting attempts", async () => {
        await seedCredential()
        await queue("r-rl-1", NOW - 120)
        await queue("r-rl-2", NOW - 60)
        const { fetchImpl } = fakePds({
            [`${PDS}/xrpc/com.atproto.repo.putRecord`]: () =>
                new Response("{}", { status: 429 }),
        })
        await runScheduledPosts(scheduleEnv(), NOW, fetchImpl)
        for (const id of ["r-rl-1", "r-rl-2"]) {
            const state = await scheduleState(id)
            expect(state?.status).toBe("pending")
            expect(state?.attempts).toBe(0)
        }
    })
})

describe("runHousekeeping", () => {
    it("deletes idle credentials but keeps credentials with pending schedules", async () => {
        await resetScheduleTables()
        const old = NOW - CREDENTIAL_IDLE_SECONDS - 1
        await seedCredential("did:plc:testfixturealice0000000000")
        await seedCredential("did:plc:testfixturebob0000000000")
        await env.DB.prepare(
            "UPDATE schedule_credentials SET updated_at = ? WHERE did IN (?, ?)",
        )
            .bind(
                old,
                "did:plc:testfixturealice0000000000",
                "did:plc:testfixturebob0000000000",
            )
            .run()
        await queue("h-active-credential", NOW + 3600, {
            did: "did:plc:testfixturebob0000000000",
        })
        await runHousekeeping(scheduleEnv(), NOW)
        const idle = await env.DB.prepare(
            "SELECT did FROM schedule_credentials WHERE did = ?",
        )
            .bind("did:plc:testfixturealice0000000000")
            .first()
        const active = await env.DB.prepare(
            "SELECT did FROM schedule_credentials WHERE did = ?",
        )
            .bind("did:plc:testfixturebob0000000000")
            .first()
        expect(idle).toBeNull()
        expect(active).not.toBeNull()
    })

    it("removes finished schedules past retention together with their staged images", async () => {
        const key = "schedules/did/old/gen/0"
        await env.SCHEDULE_IMAGES.put(key, new Uint8Array([1]))
        await insertSchedule(env.DB, {
            id: "h-old",
            did: "did:plc:testfixturealice0000000000",
            runAt: NOW - 900000,
            payload: "{}",
            imageKeys: [key],
            now: NOW,
        })
        await env.DB.prepare(
            "UPDATE scheduled_posts SET status = 'failed', finished_at = ? WHERE id = 'h-old'",
        )
            .bind(NOW - 8 * 24 * 3600)
            .run()
        await runHousekeeping(scheduleEnv(), NOW)
        expect(await scheduleState("h-old")).toBeNull()
        expect(await env.SCHEDULE_IMAGES.get(key)).toBeNull()
    })

    it("keeps finished schedules that are still within retention", async () => {
        await insertSchedule(env.DB, {
            id: "h-recent",
            did: "did:plc:testfixturealice0000000000",
            runAt: NOW - 900000,
            payload: "{}",
            imageKeys: [],
            now: NOW,
        })
        await env.DB.prepare(
            "UPDATE scheduled_posts SET status = 'failed', finished_at = ? WHERE id = 'h-recent'",
        )
            .bind(NOW - 3600)
            .run()
        await runHousekeeping(scheduleEnv(), NOW)
        expect((await scheduleState("h-recent"))?.status).toBe("failed")
    })

    it("runs housekeeping only at the scheduled minute of the day (UTC)", () => {
        // Minutes from 00:00 UTC on the test reference date.
        const at = (minute: number) =>
            Date.UTC(2026, 9, 31) / 1000 + minute * 60
        expect(isHousekeepingTime(at(HOUSEKEEPING_MINUTE_OF_DAY_UTC))).toBe(
            true,
        )
        expect(isHousekeepingTime(at(HOUSEKEEPING_MINUTE_OF_DAY_UTC + 1))).toBe(
            false,
        )
    })
})
