import { describe, expect, test } from "vitest"
import { DatabaseSync } from "node:sqlite"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

/** マイグレーションをすべて適用した SQLite を作り、問い合わせの計画の文字列を返す */
const planOf = (sql: string): string[] => {
    const db = new DatabaseSync(":memory:")
    const dir = path.resolve(__dirname, "../../../migrations")
    for (const file of readdirSync(dir).sort()) {
        db.exec(readFileSync(path.join(dir, file), "utf8"))
    }
    const rows = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as {
        detail: string
    }[]
    return rows.map(r => r.detail)
}

describe("予約の所有者の索引", () => {
    test("schedule-store/3.8: 登録状態の取得の問い合わせが、アカウントと状態で絞る索引だけで予約の表を検索する", () => {
        const plan = planOf(`
            SELECT updated_at,
              (SELECT MAX(run_at) FROM scheduled_posts
               WHERE scheduled_posts.did = schedule_credentials.did
                 AND status IN ('pending', 'running')) AS latest_run_at
            FROM schedule_credentials WHERE did = 'd'`)
        const onPosts = plan.filter(line => line.includes("scheduled_posts"))
        expect(onPosts).toHaveLength(1)
        expect(onPosts[0]).toContain("scheduled_posts_owner")
        expect(onPosts[0]).toContain("did=?")
        expect(onPosts[0]).toContain("status=?")
        expect(plan.some(line => line.includes("scheduled_posts_due"))).toBe(
            false,
        )
        expect(plan.some(line => line.startsWith("SCAN"))).toBe(false)
    })
})
