import { afterAll, describe, expect, test } from "vitest"
import {
    checkRunAt,
    defaultRunAt,
    formatRunAtLabel,
    fromLocalInputValue,
    toLocalInputValue,
    toRunAtIso,
} from "@/lib/schedule/runAtInput"
import {
    scheduleErrorKey,
    failureMessageKey,
} from "@/lib/schedule/scheduleErrorKey"
import { ja } from "@/lib/i18n/messages/ja"
import { en } from "@/lib/i18n/messages/en"
import { createTranslator } from "@/lib/i18n/translate"

const limits = { minLeadSeconds: 300, maxLeadSeconds: 14 * 86400 }
const originalTz = process.env.TZ
afterAll(() => {
    process.env.TZ = originalTz
})

describe("日時の入力と変換", () => {
    test("schedule-form/AC-6: 既定値は翌日の同時刻で、秒以下は切り捨てる", () => {
        const now = new Date("2027-03-01T10:15:42.123Z")
        expect(defaultRunAt(now).toISOString()).toBe("2027-03-02T10:15:00.000Z")
    })

    test("schedule-form/AC-6: 東京の端末では、入力した時刻がタイムゾーンつきの形式になる", () => {
        process.env.TZ = "Asia/Tokyo"
        const d = new Date("2027-03-01T10:30:00Z")
        const local = toLocalInputValue(d)
        expect(local).toBe("2027-03-01T19:30")
        const parsed = fromLocalInputValue(local)!
        const iso = toRunAtIso(parsed)
        expect(iso).toBe("2027-03-01T19:30:00+09:00")
        expect(Date.parse(iso)).toBe(d.getTime())
    })

    test("西側のタイムゾーンでも同じ時刻を指し、不正な入力は null になる", () => {
        process.env.TZ = "America/New_York"
        const d = new Date("2027-01-15T10:30:00Z")
        const iso = toRunAtIso(fromLocalInputValue(toLocalInputValue(d))!)
        expect(iso.endsWith("-05:00")).toBe(true)
        expect(Date.parse(iso)).toBe(d.getTime())
        expect(fromLocalInputValue("")).toBeNull()
        expect(fromLocalInputValue("2027-13-45T99:99")).toBeNull()
    })

    test("schedule-form/AC-7: 範囲が5分後から14日後のとき、4分後と15日後は範囲外、14日後は範囲内", () => {
        const now = new Date("2027-03-01T00:00:00Z")
        const at = (sec: number) => new Date(now.getTime() + sec * 1000)
        expect(checkRunAt(at(4 * 60), now, limits)).toBe("tooSoon")
        expect(checkRunAt(at(15 * 86400), now, limits)).toBe("tooLate")
        expect(checkRunAt(at(14 * 86400), now, limits)).toBe("ok")
        expect(checkRunAt(at(10 * 60), now, limits)).toBe("ok")
        expect(checkRunAt(new Date("invalid"), now, limits)).toBe("tooSoon")
    })

    test("実行日時の表示は表示言語の書式になる", () => {
        process.env.TZ = "Asia/Tokyo"
        const d = new Date("2027-03-01T05:00:00Z")
        expect(formatRunAtLabel(d, "ja")).toContain("14:00")
        expect(formatRunAtLabel(d, "en")).toMatch(/Mar/)
    })
})

describe("エラー文言", () => {
    test("schedule-form/AC-11: 409 は識別子ごとに日本語と英語の文言になる", () => {
        for (const code of ["ScheduleCredentialRequired", "ScheduleRunning"]) {
            const key = scheduleErrorKey(409, code)
            expect(createTranslator("ja").t(key)).toBe(
                (ja as Record<string, string>)[key],
            )
            expect(createTranslator("en").t(key)).toBe(
                (en as Record<string, string>)[key],
            )
            expect((ja as Record<string, string>)[key]).not.toBe(
                (en as Record<string, string>)[key],
            )
        }
        expect(scheduleErrorKey(409, "ScheduleRunning")).toBe(
            "schedule.error.running",
        )
        expect(scheduleErrorKey(401, undefined, "credential")).toBe(
            "schedule.error.passwordRejected",
        )
        expect(scheduleErrorKey(404)).toBe("schedule.error.notFound")
        expect(scheduleErrorKey(429)).toBe("schedule.error.tooMany")
        expect(scheduleErrorKey(500)).toBe("schedule.error.server")
        expect(failureMessageKey("CredentialExpired")).toBe(
            "schedule.failure.CredentialExpired",
        )
        expect(failureMessageKey("Unknown")).toBe("schedule.failure.unknown")
        expect(failureMessageKey(null)).toBe("schedule.failure.unknown")
    })

    test("schedule-form/AC-20: 日本語と英語の予約の文言のキー集合が一致する", () => {
        const keys = (d: object) =>
            Object.keys(d)
                .filter(k => k.startsWith("schedule."))
                .sort()
        expect(keys(en)).toEqual(keys(ja))
        expect(keys(ja).length).toBeGreaterThan(40)
    })

    test("文言の置換が働く", () => {
        expect(
            createTranslator("ja").t("schedule.range.tooSoon", { minutes: 5 }),
        ).toContain("5分後")
    })
})
