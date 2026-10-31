/**
 * 予約の API の JSON 応答の特性化テスト（src-duplicates 1.2・要件 2.1）。
 * 状態・本文・ヘッダー（content-type・cache-control・set-cookie）を、現行の値で固定する。
 * 予約の応答は、呼び出し側が `cache-control: no-store` を指定する（統合後の JSON 応答の形）。
 */
import { describe, expect, it } from "vitest"
import { codeErrorResponse } from "@/lib/schedule/scheduleResponse"
import { jsonResponse } from "@/util/http"

describe("予約の JSON 応答（no-store を指定した呼び出し）", () => {
    it("既定は 200・JSON・no-store で、set-cookie を付けない", async () => {
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

    it("状態と set-cookie の配列を、そのまま応答に付ける", () => {
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

describe("codeErrorResponse（機械可読の識別子つきのエラー）", () => {
    it("状態と { error } の本文を返し、no-store を付ける", async () => {
        const res = codeErrorResponse(409, "ScheduleRunning")
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ error: "ScheduleRunning" })
        expect(res.headers.get("cache-control")).toBe("no-store")
    })
})
