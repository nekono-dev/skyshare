/**
 * HTTP のエラー応答（errorResponseFromStatus）の特性化テスト（src-duplicates 1.2・要件 2.1・2.3）。
 * 状態・本文（{ error } の文言）・ヘッダー（content-type・cache-control）を、現行の値で固定する。
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
    ])("%i の本文は %s", async (status, message) => {
        const res = errorResponseFromStatus(status)
        expect(res.status).toBe(status)
        expect(await res.json()).toEqual({ error: message })
    })

    it("JSON と no-store のヘッダーを持ち、set-cookie は付けない", () => {
        const res = errorResponseFromStatus(401)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(res.headers.getSetCookie()).toEqual([])
    })
})
