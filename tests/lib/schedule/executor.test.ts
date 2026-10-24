import { beforeEach, describe, expect, test, vi } from "vitest"
import { createFakeD1 } from "../../helpers/fakeD1"
import { createFakeR2 } from "../../helpers/fakeR2"
import { createFakePds } from "../../helpers/fakePds"
import {
    createTestClientSecret,
    createTestCredentialToken,
} from "../../helpers/oauthTestKeys"
import { executeSchedule } from "@/lib/schedule/executor"
import { putImages } from "@/lib/schedule/imageStaging"
import {
    claimDueSchedules,
    getSchedule,
    insertSchedule,
    loadCredential,
    saveCredential,
    getCredentialStatus,
} from "@/lib/schedule/store"
import type { StoredPayload } from "@/lib/schedule/validateSchedule"
import { createBudget } from "@/lib/schedule/xrpcClient"
import { parseCredential } from "@/lib/schedule/oauth/storedCredential"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(5)))
const DID = "did:plc:aaaa"
const NOW = 1_800_000_000

let db: ReturnType<typeof createFakeD1>
let r2: ReturnType<typeof createFakeR2>
let env: {
    DB: typeof db
    SCHEDULE_IMAGES: typeof r2
    SCHEDULE_ENC_KEY: string
    SCHEDULE_OAUTH_KEY: string
}
let pds: ReturnType<typeof createFakePds>

const png = (n = 3) => ({ bytes: new ArrayBuffer(n), mime: "image/png" })

const schedule = async (id: string, payload: StoredPayload, imageCount = 0) => {
    const keys = imageCount
        ? await putImages(
              r2,
              DID,
              id,
              "g",
              Array.from({ length: imageCount }, () => png()),
          )
        : []
    await insertSchedule(db, {
        id,
        did: DID,
        runAt: NOW - 10,
        payload: JSON.stringify(payload),
        imageKeys: keys,
        now: 0,
    })
}
const claim = async () => await claimDueSchedules(db, NOW, 5)
const exec = async (id: string, budget = createBudget(40)) => {
    const row = (await claim()).find(r => r.id === id)!
    const outcome = await executeSchedule(env, budget, row, NOW, pds.fetch)
    return { outcome, budget }
}
const collections = () =>
    pds.calls
        .filter(c => c.nsid === "com.atproto.repo.putRecord")
        .map(c => c.body.collection)

beforeEach(async () => {
    db = createFakeD1()
    r2 = createFakeR2()
    pds = createFakePds(DID)
    env = {
        DB: db,
        SCHEDULE_IMAGES: r2,
        SCHEDULE_ENC_KEY: KEY,
        SCHEDULE_OAUTH_KEY: await createTestClientSecret(),
    }
    await saveCredential(
        db,
        KEY,
        {
            did: DID,
            service: "https://pds",
            token: await createTestCredentialToken("OLD-REFRESH"),
        },
        1,
    )
})

const full: StoredPayload = {
    posts: [
        { text: "one", images: [0], imagesMeta: [{ width: 10, height: 10 }] },
        {
            text: "two",
            gate: {
                replyAudience: "nobody",
                allowMentioned: false,
                allowFollower: false,
                allowFollowing: false,
                listUris: [],
                allowQuote: true,
            },
        },
    ],
    createEntry: true,
    visual: 1,
    heading: "H",
}

describe("executeSchedule", () => {
    test("schedule-runner/AC-3: 画像・投稿・制限・entry の順に作成する", async () => {
        await schedule("s1", full, 2)
        const { outcome } = await exec("s1")
        expect(outcome).toBe("posted")
        const order = pds.calls.map(c =>
            c.nsid.split(".").pop() === "putRecord"
                ? c.body.collection
                : c.nsid,
        )
        expect(order).toEqual([
            "oauth.token",
            "com.atproto.repo.uploadBlob",
            "com.atproto.repo.uploadBlob",
            "app.bsky.feed.post",
            "app.bsky.feed.post",
            "app.bsky.feed.threadgate",
            "dev.nekono.skyshare.entry",
        ])
        const [p1, p2] = pds.calls.filter(
            c => c.body?.collection === "app.bsky.feed.post",
        )
        expect(p1!.body.record.embed.$type).toBe("app.bsky.embed.images")
        expect(p2!.body.record.reply.root.uri).toBe(
            `at://${DID}/app.bsky.feed.post/${p1!.body.rkey}`,
        )
        expect(p2!.body.record.reply.parent.uri).toBe(
            p2!.body.record.reply.root.uri,
        )
        const entry = pds.calls.find(
            c => c.body?.collection === "dev.nekono.skyshare.entry",
        )!
        expect(entry.body.record.source.uri).toBe(
            p2!.body.record.reply.root.uri,
        )
    })

    test("schedule-runner/AC-4: 投稿の日時は実行時の時刻で、返信先の指定があれば先頭がその返信になる", async () => {
        const reply = {
            root: { uri: `at://${DID}/app.bsky.feed.post/r`, cid: "cr" },
            parent: { uri: `at://${DID}/app.bsky.feed.post/p`, cid: "cp" },
        }
        await schedule("s1", { posts: [{ text: "a" }, { text: "b" }], reply })
        await exec("s1")
        const [a, b] = pds.calls.filter(
            c => c.body?.collection === "app.bsky.feed.post",
        )
        expect(a!.body.record.createdAt).toBe(
            new Date(NOW * 1000).toISOString(),
        )
        expect(a!.body.record.reply).toEqual(reply)
        expect(b!.body.record.reply.root).toEqual(reply.root)
    })

    test("schedule-runner/AC-2: 更新後のトークンを投稿より先に保管し、投稿に失敗しても残る", async () => {
        await schedule("s1", { posts: [{ text: "a" }] })
        pds.override = c =>
            c.nsid === "com.atproto.repo.putRecord"
                ? new Response("{}", { status: 500 })
                : null
        const { outcome } = await exec("s1")
        expect(outcome).toBe("released")
        // 回転した更新用トークンが保管され、トークンの要求は古い更新用トークンで行われる
        const stored = parseCredential(
            (await loadCredential(db, KEY, DID))!.token,
        )
        expect(stored?.refreshToken).toBe("NEW-REFRESH")
        expect(pds.calls[0]!.nsid).toBe("oauth.token")
        expect(pds.calls[0]!.body.grant_type).toBe("refresh_token")
        expect(pds.calls[0]!.body.refresh_token).toBe("OLD-REFRESH")
        // PDS への要求は、DPoP の方式でアクセストークンと証明を送る
        const post = pds.calls.find(
            c => c.nsid === "com.atproto.repo.putRecord",
        )
        expect(post?.token).toBe("ACCESS")
        expect(post?.dpop).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
    })

    test("schedule-runner/AC-5: 通信の上限に達した予約は進捗を保って戻り、次の実行で続きから完了する", async () => {
        await schedule("s1", {
            posts: [{ text: "a" }, { text: "b" }, { text: "c" }],
        })
        const first = await exec("s1", createBudget(3))
        expect(first.outcome).toBe("released")
        const row = (await getSchedule(db, DID, "s1"))!
        expect(row.status).toBe("pending")
        expect(row.attempts).toBe(0)
        expect(JSON.parse(row.progress).created).toHaveLength(2)
        const second = await exec("s1")
        expect(second.outcome).toBe("posted")
        expect(pds.records.size).toBe(3)
    })

    test("schedule-runner/AC-6: 作成の直後に進捗の保存に失敗しても、再実行で同じ位置の投稿が重複しない", async () => {
        await schedule("s1", { posts: [{ text: "a" }, { text: "b" }] })
        const row = (await claim())[0]!
        // 2回目の進捗の保存（1件目の作成の記録）で失敗させる
        let saves = 0
        const flaky = {
            ...env,
            DB: {
                prepare: (sql: string) => {
                    if (sql.includes("SET progress") && ++saves === 2)
                        throw new Error("crash")
                    return db.prepare(sql)
                },
            },
        } as never
        await expect(
            executeSchedule(flaky, createBudget(40), row, NOW, pds.fetch),
        ).rejects.toThrow("crash")
        const recoveredRow = (await getSchedule(db, DID, "s1"))!
        expect(JSON.parse(recoveredRow.progress).created).toHaveLength(0)
        // 回収されて再実行される
        await db.prepare("UPDATE scheduled_posts SET status = 'pending'").run()
        await exec("s1")
        expect(pds.records.size).toBe(2)
        const keys = [...pds.records.keys()]
        expect(new Set(keys).size).toBe(2)
    })

    test("schedule-runner/AC-15: 書き込みの直後に中断して再実行しても、同じキーへの書き込みになり投稿は1件のまま", async () => {
        await schedule("s1", { posts: [{ text: "a" }] })
        const row = (await claim())[0]!
        let saves = 0
        const flaky = {
            ...env,
            DB: {
                prepare: (sql: string) => {
                    if (sql.includes("SET progress") && ++saves === 2)
                        throw new Error("crash")
                    return db.prepare(sql)
                },
            },
        } as never
        await expect(
            executeSchedule(flaky, createBudget(40), row, NOW, pds.fetch),
        ).rejects.toThrow("crash")
        await db.prepare("UPDATE scheduled_posts SET status = 'pending'").run()
        await exec("s1")
        const rkeys = pds.calls
            .filter(c => c.body?.collection === "app.bsky.feed.post")
            .map(c => c.body.rkey)
        expect(rkeys).toHaveLength(2)
        expect(rkeys[0]).toBe(rkeys[1])
        expect(pds.records.size).toBe(1)
    })

    test("schedule-runner/AC-7: 一時的な失敗は4回目まで待機に戻り、5回続くと失敗になる", async () => {
        await schedule("s1", { posts: [{ text: "a" }] })
        pds.override = c =>
            c.nsid === "oauth.token"
                ? new Response("{}", { status: 503 })
                : null
        for (let i = 1; i <= 4; i++) {
            const { outcome } = await exec("s1")
            expect(outcome).toBe("released")
            const row = (await getSchedule(db, DID, "s1"))!
            expect(row.status).toBe("pending")
            expect(row.attempts).toBe(i)
        }
        const last = await exec("s1")
        expect(last.outcome).toBe("failed")
        const row = (await getSchedule(db, DID, "s1"))!
        expect(row.status).toBe("failed")
        expect(row.lastError).toBe("RetryExceeded")
    })

    test("schedule-runner/AC-8: 認証が失効した予約は再試行されず、失敗と分類コードが記録され、認証情報が消えて再度の許可が必要な印が残る", async () => {
        await schedule("s1", { posts: [{ text: "a" }] }, 1)
        pds.override = c =>
            c.nsid === "oauth.token"
                ? new Response(JSON.stringify({ error: "invalid_grant" }), {
                      status: 400,
                  })
                : null
        const { outcome } = await exec("s1")
        expect(outcome).toBe("failed")
        const row = (await getSchedule(db, DID, "s1"))!
        expect(row.status).toBe("failed")
        expect(row.lastError).toBe("CredentialExpired")
        // 失敗した予約の画像は、フォームへ書き戻せるよう残す
        expect(r2.objects.size).toBe(1)
        expect(await loadCredential(db, KEY, DID)).toBeNull()
        // 設定のスイッチをオフに戻さないよう、登録ありのまま再度の許可が必要と示す
        expect(await getCredentialStatus(db, DID)).toMatchObject({
            registered: true,
            reauthRequired: true,
        })

        // 失効が分かった後の予約は、通信せずに同じ分類で失敗する
        await schedule("s2", { posts: [{ text: "b" }] })
        pds.calls.length = 0
        expect((await exec("s2")).outcome).toBe("failed")
        expect((await getSchedule(db, DID, "s2"))?.lastError).toBe(
            "CredentialExpired",
        )
        expect(pds.calls).toHaveLength(0)
    })

    test("認証情報が無い・画像が欠けている・入力が不正な予約は失敗になる", async () => {
        await schedule("nocred", { posts: [{ text: "a" }] })
        await db.prepare("DELETE FROM schedule_credentials").run()
        await exec("nocred")
        expect((await getSchedule(db, DID, "nocred"))?.lastError).toBe(
            "CredentialMissing",
        )

        await saveCredential(
            db,
            KEY,
            {
                did: DID,
                service: "https://pds",
                token: await createTestCredentialToken("T"),
            },
            3,
        )
        await schedule(
            "noimg",
            {
                posts: [
                    {
                        text: "a",
                        images: [0],
                        imagesMeta: [{ width: 1, height: 1 }],
                    },
                ],
            },
            1,
        )
        r2.objects.clear()
        await exec("noimg")
        expect((await getSchedule(db, DID, "noimg"))?.lastError).toBe(
            "ImageMissing",
        )

        await schedule("empty", { posts: [] })
        await exec("empty")
        expect((await getSchedule(db, DID, "empty"))?.lastError).toBe(
            "InvalidRecord",
        )
    })

    test("schedule-runner/AC-9: 成功した予約は履歴に残らず行ごと削除され、画像が削除される", async () => {
        await schedule(
            "s1",
            {
                posts: [
                    {
                        text: "a",
                        images: [0],
                        imagesMeta: [{ width: 1, height: 1 }],
                    },
                ],
            },
            1,
        )
        const { outcome } = await exec("s1")
        expect(outcome).toBe("posted")
        expect(await getSchedule(db, DID, "s1")).toBeNull()
        expect(r2.objects.size).toBe(0)
        // 認証情報は次の予約で使うため、成功しても削除しない
        expect(await loadCredential(db, KEY, DID)).not.toBeNull()
    })

    test("schedule-runner/AC-12: レート制限を受けたら以降の通信を止め、予約は回数を数えずに待機に戻る", async () => {
        await schedule("s1", { posts: [{ text: "a" }, { text: "b" }] })
        pds.override = c =>
            c.nsid === "com.atproto.repo.putRecord"
                ? new Response("{}", { status: 429 })
                : null
        const { outcome, budget } = await exec("s1")
        expect(outcome).toBe("released")
        expect(budget.rateLimited).toBe(true)
        expect(
            pds.calls.filter(c => c.nsid === "com.atproto.repo.putRecord"),
        ).toHaveLength(1)
        expect((await getSchedule(db, DID, "s1"))?.attempts).toBe(0)
    })

    test("schedule-runner/AC-17: 失敗した実行のログと記録にトークンが現れない", async () => {
        await schedule("s1", { posts: [{ text: "a" }] })
        const logs: string[] = []
        const spies = (["log", "warn", "error"] as const).map(m =>
            vi.spyOn(console, m).mockImplementation((...a) => {
                logs.push(a.map(String).join(" "))
            }),
        )
        pds.override = c =>
            c.nsid === "com.atproto.repo.putRecord"
                ? new Response(
                      JSON.stringify({ message: "NEW-REFRESH ACCESS" }),
                      { status: 400 },
                  )
                : null
        await exec("s1")
        spies.forEach(s => s.mockRestore())
        const row = (await getSchedule(db, DID, "s1"))!
        const everything = logs.join("\n") + JSON.stringify(row)
        for (const secret of ["OLD-REFRESH", "NEW-REFRESH", "ACCESS"]) {
            expect(everything).not.toContain(secret)
        }
        expect(row.lastError).toBe("InvalidRecord")
    })
})

describe("PDS への DPoP の要求", () => {
    test("schedule-runner/AC-18: PDS が nonce を求めたら、受け取った nonce を証明に入れて1回だけやり直す", async () => {
        await schedule("s1", { posts: [{ text: "a" }] })
        let asked = false
        pds.override = c => {
            if (c.nsid !== "com.atproto.repo.putRecord" || asked) return null
            asked = true
            return new Response(JSON.stringify({ error: "use_dpop_nonce" }), {
                status: 401,
                headers: {
                    "www-authenticate": 'DPoP error="use_dpop_nonce"',
                    "dpop-nonce": "pds-nonce",
                },
            })
        }
        const { outcome } = await exec("s1")
        expect(outcome).toBe("posted")
        const puts = pds.calls.filter(
            c => c.nsid === "com.atproto.repo.putRecord",
        )
        expect(puts).toHaveLength(2)
        const payload = (jwt: string) =>
            JSON.parse(
                Buffer.from(
                    jwt.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"),
                    "base64",
                ).toString(),
            )
        expect(payload(puts[0]!.dpop!).nonce).toBeUndefined()
        expect(payload(puts[1]!.dpop!)).toMatchObject({
            nonce: "pds-nonce",
            htm: "POST",
            htu: "https://pds/xrpc/com.atproto.repo.putRecord",
        })
        expect(typeof payload(puts[1]!.dpop!).ath).toBe("string")
    })
})
