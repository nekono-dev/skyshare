import { XRPCError } from "@atproto/xrpc"
import { describe, expect, it } from "vitest"

import { errorResponseFromStatus, resolveXrpcStatus } from "@/lib/api/response"

describe("errorResponseFromStatus", () => {
    it.each([
        [400, "Bad Request"],
        [401, "Unauthorized"],
        [403, "Forbidden"],
        [404, "Not Found"],
        [429, "Too Many Requests"],
        [500, "Internal Server Error"],
        [418, "Internal Server Error"],
    ])("status %i は %s を返す", async (status, message) => {
        const res = errorResponseFromStatus(status)
        expect(res.status).toBe(status)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")
        await expect(res.json()).resolves.toEqual({ error: message })
    })
})

describe("resolveXrpcStatus", () => {
    it.each([
        ["AuthenticationRequired", 401],
        ["InvalidToken", 401],
        ["ExpiredToken", 401],
        ["RateLimitExceeded", 429],
        ["DraftLimitReached", 429],
        ["BlobNotFound", 404],
        ["RepoNotFound", 404],
        ["RecordNotFound", 404],
        ["SomethingElse", 500],
    ])("XRPCError(%s) は %i を返す", (errorCode, expected) => {
        const error = new XRPCError(500, errorCode, "message")
        expect(resolveXrpcStatus(error)).toBe(expected)
    })

    it("cause チェーンを辿って XRPCError を見つける", () => {
        const inner = new XRPCError(500, "ExpiredToken", "message")
        const outer = new Error("wrapped", { cause: inner })
        expect(resolveXrpcStatus(outer)).toBe(401)
    })

    it("プレーンな Error は 500", () => {
        expect(resolveXrpcStatus(new Error("boom"))).toBe(500)
    })

    it("unknown な値は 500", () => {
        expect(resolveXrpcStatus("boom")).toBe(500)
        expect(resolveXrpcStatus(undefined)).toBe(500)
    })
})
