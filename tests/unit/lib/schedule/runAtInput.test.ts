/**
 * 予約日時の入力の 2 桁表示の特性化テスト（src-duplicates 1.3・要件 3.2）。
 * 月・日・時・分の 0 埋め（例: 5 は 05）を、現行の値で固定する。
 */
import { describe, expect, it } from "vitest"
import { toLocalInputValue, toRunAtIso } from "@/lib/schedule/runAtInput"

describe("datetime-local の値の 2 桁表示", () => {
    it("1 桁の月・日・時・分を 0 埋めする", () => {
        expect(toLocalInputValue(new Date(2027, 0, 5, 9, 7))).toBe(
            "2027-01-05T09:07",
        )
    })

    it("2 桁の値はそのまま表示する", () => {
        expect(toLocalInputValue(new Date(2027, 11, 31, 23, 59))).toBe(
            "2027-12-31T23:59",
        )
    })

    it("秒は 0 埋めして、タイムゾーンの差を付ける", () => {
        expect(toRunAtIso(new Date(2027, 0, 5, 9, 7, 3))).toMatch(
            /^2027-01-05T09:07:03[+-]\d{2}:\d{2}$/,
        )
    })
})
