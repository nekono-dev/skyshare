/**
 * Characterizes the status, body, and headers returned by errorResponseFromStatus.
 * Locks down the current status, error message, and cache headers.
 */
import { describe, expect, it } from "vitest"
import { errorResponseFromStatus } from "@/util/http"

describe("errorResponseFromStatus", () => {
    it.each([
        [400, "Bad Request"],
        [401, "Unauthorized"],
        [403, "Forbidden"],
        [404, "Not Found"],
        [409, "Conflict"],
        [422, "Unprocessable Content"],
        [429, "Too Many Requests"],
        [503, "Service Unavailable"],
        [500, "Internal Server Error"],
        [418, "Internal Server Error"],
    ])("%i returns error message %s", async (status, message) => {
        const res = errorResponseFromStatus(status)
        expect(res.status).toBe(status)
        expect(await res.json()).toEqual({ error: message })
    })

    it("sets JSON and no-store headers without set-cookie", () => {
        const res = errorResponseFromStatus(401)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(res.headers.getSetCookie()).toEqual([])
    })
})
