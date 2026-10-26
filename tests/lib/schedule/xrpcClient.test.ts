import { describe, expect, test, vi } from "vitest"
import { callXrpc, createBudget } from "@/lib/schedule/xrpcClient"

const res = (status: number, body: object = {}) =>
    new Response(JSON.stringify(body), { status })
const req = {
    service: "https://pds/",
    nsid: "com.atproto.repo.putRecord",
    method: "POST" as const,
    token: "SECRET-TOKEN",
    body: { a: 1 },
}

describe("callXrpc", () => {
    test("予算が尽きると通信せずに BudgetExceeded を返し、通信のたびに予算が減る", async () => {
        const f = vi.fn(async () => res(200, { ok: 1 }))
        const budget = createBudget(2)
        expect((await callXrpc(budget, req, f as never)).ok).toBe(true)
        expect((await callXrpc(budget, req, f as never)).ok).toBe(true)
        expect(await callXrpc(budget, req, f as never)).toEqual({
            ok: false,
            kind: "BudgetExceeded",
        })
        expect(f).toHaveBeenCalledTimes(2)
        expect(budget.remaining).toBe(0)
    })

    test("schedule-runner/3.2: 429 は RateLimited になり、予算に rateLimited が立つ", async () => {
        const budget = createBudget(10)
        const r = await callXrpc(budget, req, (async () => res(429)) as never)
        expect(r).toEqual({ ok: false, kind: "RateLimited" })
        expect(budget.rateLimited).toBe(true)
    })

    test("応答を Auth・Invalid・Transient に分類し、本文はバイト列も送れる", async () => {
        const run = (status: number, body: object = {}) =>
            callXrpc(createBudget(5), req, (async () =>
                res(status, body)) as never)
        expect(await run(401)).toEqual({ ok: false, kind: "Auth" })
        expect(await run(400, { error: "ExpiredToken" })).toEqual({
            ok: false,
            kind: "Auth",
        })
        expect(await run(400, { error: "InvalidRequest" })).toEqual({
            ok: false,
            kind: "Invalid",
        })
        expect(await run(500)).toEqual({ ok: false, kind: "Transient" })
        expect(
            await callXrpc(createBudget(5), req, (async () => {
                throw new Error("net")
            }) as never),
        ).toEqual({ ok: false, kind: "Transient" })

        const f = vi.fn(async () => res(200, {}))
        await callXrpc(
            createBudget(1),
            {
                ...req,
                body: new Uint8Array([1, 2]),
                contentType: "image/png",
                params: { x: "1" },
            },
            f as never,
        )
        const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe("https://pds/xrpc/com.atproto.repo.putRecord?x=1")
        expect((init.headers as Record<string, string>)["content-type"]).toBe(
            "image/png",
        )
        expect((init.headers as Record<string, string>).authorization).toBe(
            "Bearer SECRET-TOKEN",
        )
    })

    test("schedule-runner/6.2: 失敗のログにトークンが現れない", async () => {
        const logs: string[] = []
        const spies = (["log", "warn", "error"] as const).map(m =>
            vi.spyOn(console, m).mockImplementation((...a) => {
                logs.push(a.map(String).join(" "))
            }),
        )
        await callXrpc(createBudget(5), req, (async () =>
            res(500, { message: "SECRET-TOKEN" })) as never)
        await callXrpc(createBudget(5), req, (async () => {
            throw new Error("SECRET-TOKEN")
        }) as never)
        spies.forEach(s => s.mockRestore())
        expect(logs.join("\n")).not.toContain("SECRET-TOKEN")
    })
})
