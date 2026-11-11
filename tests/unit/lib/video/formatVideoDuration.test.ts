/**
 * Formats video durations with padded seconds and long-form minutes.
 */
import { describe, expect, it } from "vitest"
import { formatVideoDuration } from "@/lib/video/formatVideoDuration"

describe("formats video durations with padded seconds and long-form minutes", () => {
    it.each([
        ["rounds values below one second up to 0:01", 0, "0:01"],
        ["rounds fractional seconds to the nearest second", 0.4, "0:01"],
        ["zero-pads single-digit seconds", 5, "0:05"],
        ["keeps seconds below 60", 59, "0:59"],
        ["does not pad single-digit minutes", 60, "1:00"],
        ["formats two-digit minutes", 600, "10:00"],
        ["formats one hour as 1:00:00", 3600, "1:00:00"],
        ["zero-pads minutes and seconds after one hour", 3661, "1:01:01"],
        [
            "zero-pads seconds when minutes are zero after one hour",
            3605,
            "1:00:05",
        ],
    ])("%s", (_name, sec, expected) => {
        expect(formatVideoDuration(sec)).toBe(expected)
    })
})
