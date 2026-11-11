/**
 * Verifies JSON response status, body, and cache headers for schedules.
 */
import { describe, expect, it } from "vitest"
import { codeErrorResponse } from "@/lib/schedule/scheduleResponse"
import { jsonResponse } from "@/util/http"

describe("JSON responses with no-store caching", () => {
    it("defaults to 200 JSON with no-store and no set-cookie", async () => {
        const res = jsonResponse(
            { a: 1 },
            { headers: { "cache-control": "no-store" } },
        )
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ a: 1 })
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(res.headers.getSetCookie()).toEqual([])
    })

    it("preserves the status and set-cookie headers", () => {
        const res = jsonResponse(
            {},
            {
                status: 201,
                headers: [
                    ["cache-control", "no-store"],
                    ["set-cookie", "a=1; Path=/"],
                    ["set-cookie", "b=2; Path=/"],
                ],
            },
        )
        expect(res.status).toBe(201)
        expect(res.headers.getSetCookie()).toEqual([
            "a=1; Path=/",
            "b=2; Path=/",
        ])
        expect(res.headers.get("cache-control")).toBe("no-store")
    })
})

describe("codeErrorResponse returns machine-readable errors", () => {
    it("returns the status and error body with no-store", async () => {
        const res = codeErrorResponse(409, "ScheduleRunning")
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ error: "ScheduleRunning" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })
})
