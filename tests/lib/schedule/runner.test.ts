import { beforeEach, describe, expect, test } from "vitest"
import { createFakeD1 } from "../../helpers/fakeD1"
import { createFakeR2 } from "../../helpers/fakeR2"
import { createFakePds } from "../../helpers/fakePds"
import {
    createTestClientSecret,
    createTestCredentialToken,
} from "../../helpers/oauthTestKeys"
import {
    HOUSEKEEPING_MINUTE_OF_DAY_UTC,
    MAX_EXTERNAL_CALLS,
    isHousekeepingTime,
    runHousekeeping,
    runScheduledPosts,
} from "@/lib/schedule/runner"
import { putImages } from "@/lib/schedule/imageStaging"
import {
    claimDueSchedules,
    getSchedule,
    insertSchedule,
    loadCredential,
    saveCredential,
    saveProgress,
    failSchedule,
    touchCredential,
} from "@/lib/schedule/store"
import { emptyProgress } from "@/lib/schedule/types"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(5)))
const DID = "did:plc:aaaa"
const NOW = 1_800_000_000

let db: ReturnType<typeof createFakeD1>
let r2: ReturnType<typeof createFakeR2>
let env: {
    DB: typeof db
    SCHEDULE_IMAGES: typeof r2
    SCHEDULE_ENC_KEY: string
    OAUTH_CLIENT_KEY: string
}
let pds: ReturnType<typeof createFakePds>

const add = async (
    id: string,
    runAt: number,
    payload: object = { posts: [{ text: id }] },
    images = 0,
) => {
    const keys = images
        ? await putImages(
              r2,
              DID,
              id,
              "g",
              Array.from({ length: images }, () => ({
                  bytes: new ArrayBuffer(2),
                  mime: "image/png",
              })),
          )
        : []
    await insertSchedule(db, {
        id,
        did: DID,
        runAt,
        payload: JSON.stringify(payload),
        imageKeys: keys,
        now: 0,
    })
}
const run = (now = NOW) => runScheduledPosts(env, now, pds.fetch)
const housekeep = (now = NOW) => runHousekeeping(env, now)

beforeEach(async () => {
    db = createFakeD1()
    r2 = createFakeR2()
    pds = createFakePds(DID)
    env = {
        DB: db,
        SCHEDULE_IMAGES: r2,
        SCHEDULE_ENC_KEY: KEY,
        OAUTH_CLIENT_KEY: await createTestClientSecret(),
    }
    await saveCredential(
        db,
        KEY,
        {
            did: DID,
            service: "https://pds",
            token: await createTestCredentialToken("R"),
        },
        1,
    )
})

describe("runScheduledPosts", () => {
    test("schedule-runner/AC-1: 到来した7件のうち早い5件が実行され、未到来の予約は実行されない", async () => {
        for (let i = 1; i <= 7; i++) await add(`due${i}`, NOW - 100 + i)
        await add("future", NOW + 3600)
        await run()
        for (let i = 1; i <= 5; i++)
            expect(await getSchedule(db, DID, `due${i}`)).toBeNull()
        expect((await getSchedule(db, DID, "due6"))?.status).toBe("pending")
        expect((await getSchedule(db, DID, "due7"))?.status).toBe("pending")
        expect((await getSchedule(db, DID, "future"))?.status).toBe("pending")
    })

    test("schedule-runner/AC-13: 実行時刻の直後の実行で、5件以内の予約が投稿の作成を開始する", async () => {
        await add("a", NOW)
        await add("b", NOW)
        await run(NOW + 60)
        const posts = pds.calls.filter(
            c => c.body?.collection === "app.bsky.feed.post",
        )
        expect(posts).toHaveLength(2)
    })

    test("schedule-runner/AC-14: 10枚の画像を持つ予約を5件実行しても、外部への通信が40回を超えない", async () => {
        const payload = {
            posts: [
                {
                    text: "x",
                    images: Array.from({ length: 10 }, (_, i) => i),
                    imagesMeta: Array.from({ length: 10 }, () => ({
                        width: 1,
                        height: 1,
                    })),
                },
            ],
        }
        for (let i = 1; i <= 5; i++)
            await add(`s${i}`, NOW - 10 + i, payload, 10)
        await run()
        expect(pds.calls.length).toBeLessThanOrEqual(MAX_EXTERNAL_CALLS)
        expect(pds.calls.length).toBe(MAX_EXTERNAL_CALLS)
        // 持ち越された予約は、次の実行で続きから完了する
        for (let n = 0; n < 5; n++) await run()
        for (let i = 1; i <= 5; i++)
            expect(await getSchedule(db, DID, `s${i}`)).toBeNull()
        expect(pds.records.size).toBe(5)
    })

    test("schedule-runner/AC-10: 10分以上更新のない実行中の予約が待機に戻り、直近に更新された予約は戻らない", async () => {
        await add("stuck", NOW - 5000)
        await add("fresh", NOW - 5000)
        await claimDueSchedules(db, NOW - 700, 1) // stuck を 700 秒前に実行中にする
        pds.override = () => new Response("{}", { status: 503 })
        await db
            .prepare(
                "UPDATE scheduled_posts SET status = 'running', updated_at = ? WHERE id = 'fresh'",
            )
            .bind(NOW - 10)
            .run()
        await run()
        // stuck は回収された後で取り出され、実行された（失敗応答なので待機に戻る）
        expect(
            (await getSchedule(db, DID, "stuck"))?.attempts,
        ).toBeGreaterThanOrEqual(1)
        expect((await getSchedule(db, DID, "fresh"))?.status).toBe("running")
    })

    test("schedule-runner/AC-11: 後片付けで、終了から7日を超えた予約が削除され、予約がなく最後の使用から30日を超えた認証情報だけが取り出せなくなる", async () => {
        const week = 7 * 24 * 60 * 60
        const month = 30 * 24 * 60 * 60
        await add("old", NOW - 10)
        await claimDueSchedules(db, NOW, 5)
        await saveProgress(db, "old", emptyProgress(), NOW)
        await failSchedule(db, "old", "InvalidRecord", NOW - week - 10)
        // 最後の使用から30日以内の認証情報は残る
        await touchCredential(db, DID, NOW - month + 60)
        await housekeep()
        expect(await getSchedule(db, DID, "old")).toBeNull()
        expect(await loadCredential(db, KEY, DID)).not.toBeNull()
        // 30日を超えると削除される
        await touchCredential(db, DID, NOW - month - 60)
        await housekeep()
        expect(await loadCredential(db, KEY, DID)).toBeNull()
    })

    test("30日を超えて使われていなくても、待機中の予約が残る認証情報は削除されない", async () => {
        const month = 30 * 24 * 60 * 60
        await add("future", NOW + 3600)
        await touchCredential(db, DID, NOW - month - 60)
        await housekeep()
        expect(await loadCredential(db, KEY, DID)).not.toBeNull()
    })

    test("schedule-runner/AC-19: 毎分の実行は後片付けをせず、1日のうち後片付けの分だけが後片付けの時刻と判定される", async () => {
        const week = 7 * 24 * 60 * 60
        await add("old", NOW - 10)
        await claimDueSchedules(db, NOW, 5)
        await saveProgress(db, "old", emptyProgress(), NOW)
        await failSchedule(db, "old", "InvalidRecord", NOW - week - 10)
        await run()
        expect(await getSchedule(db, DID, "old")).not.toBeNull()

        const day = 24 * 60 * 60
        const start = HOUSEKEEPING_MINUTE_OF_DAY_UTC * 60
        expect(isHousekeepingTime(start + 20)).toBe(true)
        expect(isHousekeepingTime(start + day * 3 + 59)).toBe(true)
        expect(isHousekeepingTime(start - 1)).toBe(false)
        expect(isHousekeepingTime(start + 60)).toBe(false)
        const hits = Array.from({ length: 24 * 60 }, (_, i) => i * 60).filter(
            t => isHousekeepingTime(t),
        )
        expect(hits).toHaveLength(1)
    })

    test("暗号鍵が未設定なら何も実行せず、予約は待機のまま残る", async () => {
        await add("a", NOW - 10)
        await runScheduledPosts(
            { ...env, SCHEDULE_ENC_KEY: "" },
            NOW,
            pds.fetch,
        )
        expect(pds.calls).toHaveLength(0)
        expect((await getSchedule(db, DID, "a"))?.status).toBe("pending")
    })
})
