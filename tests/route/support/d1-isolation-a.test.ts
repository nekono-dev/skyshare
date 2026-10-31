// D1 の分離（要件 5.4）: テストファイルは空の D1 から始まり、他のファイルのレコードを見ない
import { env } from "cloudflare:test"
import { describe, expect, it } from "vitest"

const countProbe = async (): Promise<number> => {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM probe").first<{
        n: number
    }>()
    return row?.n ?? -1
}

describe("D1 isolation (a)", () => {
    it("starts from an empty table and sees only its own rows", async () => {
        await env.DB.exec("CREATE TABLE IF NOT EXISTS probe (v TEXT)")
        expect(await countProbe()).toBe(0)
        await env.DB.prepare("INSERT INTO probe (v) VALUES (?)").bind("a").run()
        expect(await countProbe()).toBe(1)
    })
})
