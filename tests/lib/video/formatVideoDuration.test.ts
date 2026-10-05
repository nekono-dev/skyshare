import { describe, expect, it } from "vitest"

import { formatVideoDuration } from "@/lib/video/formatVideoDuration"

describe("formatVideoDuration", () => {
    it.each([
        [5, "0:05"],
        [59.6, "1:00"],
        [0, "0:01"],
        [600, "10:00"],
        [65, "1:05"],
        [3599, "59:59"],
        [3600, "1:00:00"],
        [3661, "1:01:01"],
        [36000, "10:00:00"],
    ])("%s 秒 → %s", (sec, expected) => {
        expect(formatVideoDuration(sec)).toBe(expected)
    })
})
