import { describe, expect, test } from "vitest"
import {
    getScheduleLimits,
    toStoredPayload,
    validateRunAt,
} from "@/lib/schedule/validateSchedule"

const NOW = 1_800_000_000
const iso = (offsetSeconds: number) =>
    new Date((NOW + offsetSeconds) * 1000).toISOString()

describe("validateRunAt", () => {
    test("schedule-api/AC-3: 4分後と31日後は範囲外、10分後と30日後は範囲内", () => {
        expect(validateRunAt(iso(4 * 60), NOW).ok).toBe(false)
        expect(validateRunAt(iso(31 * 86400), NOW).ok).toBe(false)
        expect(validateRunAt(iso(10 * 60), NOW).ok).toBe(true)
        expect(validateRunAt(iso(30 * 86400), NOW).ok).toBe(true)
        expect(validateRunAt(iso(5 * 60), NOW).ok).toBe(true)
        expect(validateRunAt("not-a-date", NOW).ok).toBe(false)
    })

    test("タイムゾーンの差を含む形式でも同じ時刻として扱う", () => {
        const r = validateRunAt(
            "2027-01-15T21:00:00+09:00",
            Date.parse("2027-01-15T11:00:00Z") / 1000,
        )
        expect(r).toEqual({
            ok: true,
            epoch: Date.parse("2027-01-15T12:00:00Z") / 1000,
        })
    })
})

describe("getScheduleLimits", () => {
    test("schedule-api/AC-17: 検証に使う値と同じ範囲と上限を返す", () => {
        const limits = getScheduleLimits()
        expect(limits.minLeadSeconds).toBe(300)
        expect(limits.maxLeadSeconds).toBe(30 * 86400)
        expect(limits.maxPending).toBe(20)
        expect(limits.maxImageBytes).toBe(10_000_000)
        expect(limits.maxPosts).toBe(100)
        // 検証の境界が、返した値と一致する
        expect(validateRunAt(iso(limits.minLeadSeconds - 1), NOW).ok).toBe(
            false,
        )
        expect(validateRunAt(iso(limits.minLeadSeconds), NOW).ok).toBe(true)
        expect(validateRunAt(iso(limits.maxLeadSeconds), NOW).ok).toBe(true)
        expect(validateRunAt(iso(limits.maxLeadSeconds + 1), NOW).ok).toBe(
            false,
        )
    })
})

describe("toStoredPayload", () => {
    test("画像に番号を振り、本文の JSON は番号の参照に置き換える", async () => {
        const img = (s: string) => new Blob([s], { type: "image/png" })
        const { payload, images } = await toStoredPayload({
            posts: [
                {
                    text: "a",
                    images: [img("1"), img("2")],
                    imagesMeta: [
                        { width: 1, height: 1 },
                        { width: 1, height: 1 },
                    ],
                },
                { text: "b" },
            ],
            runAt: iso(600),
            createEntry: true,
            visual: img("v"),
        } as never)
        expect(images).toHaveLength(3)
        expect(payload.posts[0]!.images).toEqual([0, 1])
        expect(payload.visual).toBe(2)
        expect(JSON.stringify(payload)).not.toContain("Blob")
    })
})
