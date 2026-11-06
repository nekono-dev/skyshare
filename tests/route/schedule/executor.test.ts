// 予約の実行（P0・要件 2.1 の「予約投稿の実行: 冪等性・失敗の分類・後片付け・暗号化」）
import { env } from "cloudflare:test"
import type { D1Database } from "@/lib/platform/cfTypes"
import { beforeEach, describe, expect, it } from "vitest"
import { executeSchedule, MAX_ATTEMPTS } from "@/lib/schedule/executor"
import { saveCredential } from "@/lib/schedule/store"
import { TEST_KEY_BASE64 } from "../../fixtures/identities"
import { createBudget } from "@/lib/schedule/xrpcClient"
import { TEST_DID } from "../../fixtures/identities"
import {
    callsTo,
    fakePds,
    NOW,
    PDS,
    scheduleEnv,
    scheduleState,
    seedCredential,
    seedRunningSchedule,
    resetScheduleTables,
} from "./support"

const stageImage = async (key: string) =>
    env.SCHEDULE_IMAGES.put(key, new Uint8Array([1, 2, 3, 4]), {
        httpMetadata: { contentType: "image/png" },
    })

const run = (
    row: Awaited<ReturnType<typeof seedRunningSchedule>>,
    fetchImpl: typeof fetch,
) => executeSchedule(scheduleEnv(), createBudget(40), row, NOW, fetchImpl)

describe("executeSchedule: posting", () => {
    beforeEach(async () => {
        await resetScheduleTables()
    })

    it("posts the schedule once, removes it from the queue, and removes its staged images", async () => {
        await seedCredential()
        await stageImage("schedules/x/s-post/gen/0")
        const row = await seedRunningSchedule({
            id: "s-post",
            payload: { posts: [{ text: "こんにちは", images: [0] }] },
            imageKeys: ["schedules/x/s-post/gen/0"],
        })
        const { fetchImpl, calls } = fakePds()
        expect(await run(row, fetchImpl)).toBe("posted")
        // 投稿が済んだ予約はキューから削除される
        expect(await scheduleState("s-post")).toBeNull()
        expect(callsTo(calls, "com.atproto.repo.putRecord")).toHaveLength(1)
        expect(
            await env.SCHEDULE_IMAGES.get("schedules/x/s-post/gen/0"),
        ).toBeNull()
    })

    it("does not write an already created post again when the run is retried (idempotent)", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-retry",
            payload: { posts: [{ text: "一件目" }, { text: "二件目" }] },
            progress: {
                rkeys: ["3aaaaaaaaaaa2", "3aaaaaaaaaab2"],
                blobs: {},
                created: [
                    {
                        uri: "at://did:plc:testfixturealice0000000000/app.bsky.feed.post/3aaaaaaaaaaa2",
                        cid: "bafkfirst",
                    },
                ],
                gates: 0,
                entryDone: false,
            },
        })
        const { fetchImpl, calls } = fakePds()
        expect(await run(row, fetchImpl)).toBe("posted")
        const puts = callsTo(calls, "com.atproto.repo.putRecord")
        // 作成済みの一件目は書き直さず、二件目だけを同じキーで書く
        expect(puts).toHaveLength(1)
        expect(JSON.parse(String(puts[0]!.body)).rkey).toBe("3aaaaaaaaaab2")
    })

    it("keeps the same record keys across a retry, so a half-finished thread never gets duplicate posts", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-keys",
            payload: { posts: [{ text: "a" }, { text: "b" }] },
        })
        const failingOnSecond = fakePds({
            [`${PDS}/xrpc/com.atproto.repo.putRecord`]: (() => {
                let n = 0
                return () =>
                    n++ === 0
                        ? new Response(
                              JSON.stringify({ uri: "at://x/y/1", cid: "c1" }),
                              { status: 200 },
                          )
                        : new Response("{}", { status: 500 })
            })() as never,
        })
        expect(await run(row, failingOnSecond.fetchImpl)).toBe("released")
        const state = await scheduleState("s-keys")
        const progress = JSON.parse(state!.progress) as {
            rkeys: string[]
            created: unknown[]
        }
        expect(progress.created).toHaveLength(1)
        expect(progress.rkeys).toHaveLength(3)
    })
})

describe("executeSchedule: failure classification", () => {
    it("fails with CredentialMissing when no credential is stored for the owner", async () => {
        const row = await seedRunningSchedule({
            id: "s-nocred",
            payload: { posts: [{ text: "x" }] },
            did: "did:plc:testfixturenocred000000000",
        })
        expect(await run(row, fakePds().fetchImpl)).toBe("failed")
        expect((await scheduleState("s-nocred"))?.last_error).toBe(
            "CredentialMissing",
        )
    })

    it("fails with CredentialExpired and asks for re-authorization when the refresh token is rejected", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-expired",
            payload: { posts: [{ text: "x" }] },
        })
        const { fetchImpl } = fakePds({
            "https://bsky.social/oauth/token": () =>
                new Response(JSON.stringify({ error: "invalid_grant" }), {
                    status: 400,
                }),
        })
        expect(await run(row, fetchImpl)).toBe("failed")
        expect((await scheduleState("s-expired"))?.last_error).toBe(
            "CredentialExpired",
        )
        const reauth = await env.DB.prepare(
            "SELECT reauth_required FROM schedule_credentials WHERE did = ?",
        )
            .bind(TEST_DID)
            .first<{ reauth_required: number }>()
        expect(reauth?.reauth_required).toBe(1)
    })

    it("fails with ImageMissing when a referenced image is not in storage", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-img",
            payload: { posts: [{ text: "x", images: [0] }] },
            imageKeys: ["schedules/x/missing/gen/0"],
        })
        expect(await run(row, fakePds().fetchImpl)).toBe("failed")
        expect((await scheduleState("s-img"))?.last_error).toBe("ImageMissing")
    })

    it("fails with InvalidRecord for a schedule that has no posts", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-empty",
            payload: { posts: [] },
        })
        expect(await run(row, fakePds().fetchImpl)).toBe("failed")
        expect((await scheduleState("s-empty"))?.last_error).toBe(
            "InvalidRecord",
        )
    })

    it("releases a schedule for a later run on a temporary PDS failure, counting the attempt", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-500",
            payload: { posts: [{ text: "x" }] },
        })
        const { fetchImpl } = fakePds({
            [`${PDS}/xrpc/com.atproto.repo.putRecord`]: () =>
                new Response("{}", { status: 500 }),
        })
        expect(await run(row, fetchImpl)).toBe("released")
        const state = await scheduleState("s-500")
        expect(state?.status).toBe("pending")
        expect(state?.attempts).toBe(1)
    })

    it("releases a schedule on rate limiting without counting the attempt", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-429",
            payload: { posts: [{ text: "x" }] },
        })
        const { fetchImpl } = fakePds({
            [`${PDS}/xrpc/com.atproto.repo.putRecord`]: () =>
                new Response("{}", { status: 429 }),
        })
        expect(await run(row, fetchImpl)).toBe("released")
        const state = await scheduleState("s-429")
        expect(state?.status).toBe("pending")
        expect(state?.attempts).toBe(0)
    })

    it("fails with RetryExceeded once the last allowed attempt also fails", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-max",
            payload: { posts: [{ text: "x" }] },
            attempts: MAX_ATTEMPTS - 1,
        })
        const { fetchImpl } = fakePds({
            [`${PDS}/xrpc/com.atproto.repo.putRecord`]: () =>
                new Response("{}", { status: 500 }),
        })
        expect(await run(row, fetchImpl)).toBe("failed")
        expect((await scheduleState("s-max"))?.last_error).toBe("RetryExceeded")
    })
})

describe("executeSchedule: credential storage", () => {
    it("stores the rotated refresh token encrypted, never in plain text", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-enc",
            payload: { posts: [{ text: "x" }] },
        })
        expect(await run(row, fakePds().fetchImpl)).toBe("posted")
        const stored = await env.DB.prepare(
            "SELECT token_enc FROM schedule_credentials WHERE did = ?",
        )
            .bind(TEST_DID)
            .first<{ token_enc: string }>()
        expect(stored?.token_enc).toBeTruthy()
        expect(stored?.token_enc).not.toContain("refresh-rotated-fixture")
    })
})

describe("executeSchedule: threads, gates, and entries", () => {
    it("writes the threadgate and postgate records of a post that has a reply gate", async () => {
        await seedCredential()
        const gate = {
            replyAudience: "nobody",
            allowMentioned: false,
            allowFollower: false,
            allowFollowing: false,
            listUris: [],
            allowQuote: false,
        }
        const row = await seedRunningSchedule({
            id: "s-gate",
            payload: { posts: [{ text: "制限", gate }] },
        })
        const { fetchImpl, calls } = fakePds()
        expect(await run(row, fetchImpl)).toBe("posted")
        const collections = callsTo(calls, "com.atproto.repo.putRecord").map(
            c => JSON.parse(String(c.body)).collection,
        )
        expect(collections).toEqual([
            "app.bsky.feed.post",
            "app.bsky.feed.threadgate",
            "app.bsky.feed.postgate",
        ])
    })

    it("creates the skyshare entry from the first post and its visual image", async () => {
        await seedCredential()
        await stageImage("schedules/x/s-entry/gen/0")
        const row = await seedRunningSchedule({
            id: "s-entry",
            payload: {
                posts: [{ text: "entry" }],
                createEntry: true,
                visual: 0,
                heading: "見出し",
            },
            imageKeys: ["schedules/x/s-entry/gen/0"],
        })
        const { fetchImpl, calls } = fakePds()
        expect(await run(row, fetchImpl)).toBe("posted")
        const collections = callsTo(calls, "com.atproto.repo.putRecord").map(
            c => JSON.parse(String(c.body)).collection,
        )
        expect(collections).toContain("dev.nekono.skyshare.entry")
    })

    it("fails with InvalidRecord for an entry without a visual image", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-novisual",
            payload: { posts: [{ text: "x" }], createEntry: true },
        })
        expect(await run(row, fakePds().fetchImpl)).toBe("failed")
        expect((await scheduleState("s-novisual"))?.last_error).toBe(
            "InvalidRecord",
        )
    })
})

describe("executeSchedule: ownership of the row and the budget", () => {
    it("leaves the schedule alone when another run already took it over (abandon)", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-taken",
            payload: { posts: [{ text: "x" }] },
        })
        // 別の実行が先に状態を変えた（実行中ではなくなった）
        await env.DB.prepare(
            "UPDATE scheduled_posts SET status = 'pending' WHERE id = 's-taken'",
        ).run()
        expect(await run(row, fakePds().fetchImpl)).toBe("released")
        expect((await scheduleState("s-taken"))?.status).toBe("pending")
    })

    it("releases the schedule without counting an attempt when the call budget is used up", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-budget",
            payload: { posts: [{ text: "x" }] },
        })
        expect(
            await executeSchedule(
                scheduleEnv(),
                createBudget(0),
                row,
                NOW,
                fakePds().fetchImpl,
            ),
        ).toBe("released")
        expect((await scheduleState("s-budget"))?.attempts).toBe(0)
    })

    it("releases the schedule without counting an attempt when the token endpoint rate limits", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-tokrl",
            payload: { posts: [{ text: "x" }] },
        })
        const { fetchImpl } = fakePds({
            "https://bsky.social/oauth/token": () =>
                new Response("{}", { status: 429 }),
        })
        expect(await run(row, fetchImpl)).toBe("released")
        expect((await scheduleState("s-tokrl"))?.attempts).toBe(0)
    })

    it("counts an attempt when the token endpoint fails temporarily", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-toktmp",
            payload: { posts: [{ text: "x" }] },
        })
        const { fetchImpl } = fakePds({
            "https://bsky.social/oauth/token": () =>
                new Response("{}", { status: 500 }),
        })
        expect(await run(row, fetchImpl)).toBe("released")
        expect((await scheduleState("s-toktmp"))?.attempts).toBe(1)
    })

    it("fails with CredentialInvalid when the stored credential cannot be read", async () => {
        await saveCredential(
            env.DB,
            TEST_KEY_BASE64,
            { did: TEST_DID, service: PDS, token: "not-a-credential" },
            NOW,
            { authorized: true },
        )
        const row = await seedRunningSchedule({
            id: "s-badcred",
            payload: { posts: [{ text: "x" }] },
        })
        expect(await run(row, fakePds().fetchImpl)).toBe("failed")
        expect((await scheduleState("s-badcred"))?.last_error).toBe(
            "CredentialInvalid",
        )
    })
})

describe("executeSchedule: unusable replies", () => {
    it("fails with CredentialInvalid when the token endpoint answers with an unusable token set", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-badtok",
            payload: { posts: [{ text: "x" }] },
        })
        const { fetchImpl } = fakePds({
            "https://bsky.social/oauth/token": () =>
                new Response("{}", { status: 200 }),
        })
        expect(await run(row, fetchImpl)).toBe("failed")
        expect((await scheduleState("s-badtok"))?.last_error).toBe(
            "CredentialInvalid",
        )
    })

    it("releases for a later run when the rotated credential cannot be saved", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-nosave",
            payload: { posts: [{ text: "x" }] },
        })
        const failingSave = {
            prepare: (sql: string) => {
                if (sql.includes("INSERT INTO schedule_credentials")) {
                    throw new Error("d1 unavailable")
                }
                return env.DB.prepare(sql)
            },
            batch: env.DB.batch.bind(env.DB),
            exec: env.DB.exec.bind(env.DB),
            dump: env.DB.dump.bind(env.DB),
        } as unknown as D1Database
        const outcome = await executeSchedule(
            { ...scheduleEnv(), DB: failingSave },
            createBudget(40),
            row,
            NOW,
            fakePds().fetchImpl,
        )
        expect(outcome).toBe("released")
        expect((await scheduleState("s-nosave"))?.attempts).toBe(1)
    })

    it("releases for a later run when a post is answered without its URI", async () => {
        await seedCredential()
        const row = await seedRunningSchedule({
            id: "s-nouri",
            payload: { posts: [{ text: "x" }] },
        })
        const { fetchImpl } = fakePds({
            [`${PDS}/xrpc/com.atproto.repo.putRecord`]: () =>
                new Response("{}", { status: 200 }),
        })
        expect(await run(row, fetchImpl)).toBe("released")
        expect((await scheduleState("s-nouri"))?.attempts).toBe(1)
    })

    it("posts a link card whose image is the staged open-graph image", async () => {
        await seedCredential()
        await stageImage("schedules/x/s-og/gen/0")
        const row = await seedRunningSchedule({
            id: "s-og",
            payload: {
                posts: [
                    {
                        text: "リンク https://a.example/page",
                        ogMeta: {
                            url: "https://a.example/page",
                            title: "題名",
                            description: "説明",
                        },
                        ogImage: 0,
                    },
                ],
            },
            imageKeys: ["schedules/x/s-og/gen/0"],
        })
        const { fetchImpl, calls } = fakePds()
        expect(await run(row, fetchImpl)).toBe("posted")
        const record = JSON.parse(
            String(callsTo(calls, "com.atproto.repo.putRecord")[0]!.body),
        ).record
        expect(JSON.stringify(record)).toContain("https://a.example/page")
    })
})
