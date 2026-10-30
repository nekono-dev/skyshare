import { describe, expect, test } from "vitest"
import { createFakeD1 } from "./fakeD1"

const insertCred = (db: ReturnType<typeof createFakeD1>, did: string) =>
    db
        .prepare(
            "INSERT INTO schedule_credentials (did, service, token_enc, updated_at) VALUES (?, ?, ?, ?)",
        )
        .bind(did, "s", "t", 1)

const countCreds = async (db: ReturnType<typeof createFakeD1>) =>
    (
        await db
            .prepare("SELECT COUNT(*) AS n FROM schedule_credentials")
            .first<{ n: number }>()
    )?.n

describe("FakeD1.batch", () => {
    test("[survey-api/6.7][survey-api/9.3] 全文が成功すると全て反映され、呼び出しは 1 回と数える", async () => {
        const db = createFakeD1()
        const before = db.queryCount
        const results = await db.batch([
            insertCred(db, "a"),
            insertCred(db, "b"),
        ])
        expect(db.queryCount - before).toBe(1)
        expect(results).toHaveLength(2)
        expect(results[0].meta?.changes).toBe(1)
        expect(await countCreds(db)).toBe(2)
    })

    test("[survey-api/6.7] 途中で失敗すると何も残らず、呼び出しは 1 回と数える", async () => {
        const db = createFakeD1()
        const before = db.queryCount
        await expect(
            db.batch([insertCred(db, "a"), insertCred(db, "a")]),
        ).rejects.toThrow()
        expect(db.queryCount - before).toBe(1)
        expect(await countCreds(db)).toBe(0)
    })

    test("[survey-api/6.7] 失敗した後も、次のまとめた実行が成功する", async () => {
        const db = createFakeD1()
        await expect(
            db.batch([insertCred(db, "a"), insertCred(db, "a")]),
        ).rejects.toThrow()
        await db.batch([insertCred(db, "c")])
        expect(await countCreds(db)).toBe(1)
    })
})
