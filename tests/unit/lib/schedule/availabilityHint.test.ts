/**
 * 予約投稿の cookie ヒントを解析する形状を確認する。
 */
import { describe, expect, it } from "vitest"
import { parseScheduleHint } from "@/lib/schedule/availabilityHint"

describe("parseScheduleHint", () => {
    it("accepts a registration hint without a re-authorization flag", () => {
        expect(
            parseScheduleHint(
                encodeURIComponent(
                    JSON.stringify({
                        registered: true,
                        expiresAt: "2030-01-01T00:00:00.000Z",
                    }),
                ),
            ),
        ).toEqual({ registered: true, expiresAt: "2030-01-01T00:00:00.000Z" })
    })
})
