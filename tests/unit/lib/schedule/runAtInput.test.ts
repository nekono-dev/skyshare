/**
 * Formats scheduled-post date and time values for local inputs.
 */
import { describe, expect, it } from "vitest"
import { toLocalInputValue, toRunAtIso } from "@/lib/schedule/runAtInput"

describe("two-digit datetime-local fields", () => {
    it("zero-pads single-digit month, day, hour, and minute fields", () => {
        expect(toLocalInputValue(new Date(2027, 0, 5, 9, 7))).toBe(
            "2027-01-05T09:07",
        )
    })

    it("preserves two-digit fields", () => {
        expect(toLocalInputValue(new Date(2027, 11, 31, 23, 59))).toBe(
            "2027-12-31T23:59",
        )
    })

    it("zero-pads seconds and applies the timezone offset", () => {
        expect(toRunAtIso(new Date(2027, 0, 5, 9, 7, 3))).toMatch(
            /^2027-01-05T09:07:03[+-]\d{2}:\d{2}$/,
        )
    })
})
