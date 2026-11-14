/**
 * 移行 0002 が、旧実装の「再度の許可が必要である印」の行を残さず列を削除することを確かめる。
 */
import { readFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { describe, expect, it } from "vitest"

const migration = (name: string): string =>
    readFileSync(`migrations/${name}`, "utf8")

describe("0002_drop_reauth_required", () => {
    it("deletes the leftover markers, keeps the valid credentials, and drops the column", () => {
        const db = new DatabaseSync(":memory:")
        db.exec(migration("0001_initial.sql"))
        const insert = db.prepare(
            `INSERT INTO schedule_credentials
               (did, service, token_enc, updated_at, authorized_at, reauth_required)
             VALUES (?, 'https://bsky.social', ?, 1, 1, ?)`,
        )
        insert.run("did:plc:valid", "encrypted-token", 0)
        insert.run("did:plc:marker", "", 1)

        db.exec(migration("0002_drop_reauth_required.sql"))

        const rows = db
            .prepare("SELECT did FROM schedule_credentials ORDER BY did")
            .all()
        expect(rows).toEqual([{ did: "did:plc:valid" }])
        const columns = db
            .prepare("PRAGMA table_info(schedule_credentials)")
            .all()
            .map(column => column.name)
        expect(columns).not.toContain("reauth_required")
    })

    it("applies to an empty database", () => {
        const db = new DatabaseSync(":memory:")
        db.exec(migration("0001_initial.sql"))
        expect(() =>
            db.exec(migration("0002_drop_reauth_required.sql")),
        ).not.toThrow()
    })
})
