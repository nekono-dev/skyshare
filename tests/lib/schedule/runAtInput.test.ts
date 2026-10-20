import { afterAll, describe, expect, test } from "vitest"
import {
    checkRunAt,
    defaultRunAt,
    toLocalInputValue,
    toRunAtIso,
} from "@/lib/schedule/runAtInput"
import {
    scheduleErrorKey,
    failureMessageKey,
} from "@/lib/schedule/scheduleErrorKey"
import { nextDialogState } from "@/lib/schedule/scheduleDialogState"
import { ja } from "@/lib/i18n/messages/ja"
import { en } from "@/lib/i18n/messages/en"
import { createTranslator } from "@/lib/i18n/translate"

const limits = { minLeadSeconds: 300, maxLeadSeconds: 30 * 86400 }
const originalTz = process.env.TZ
afterAll(() => {
    process.env.TZ = originalTz
})

describe("日時の入力と変換", () => {
    test("schedule-form/AC-1: 既定値は現在から1時間後", () => {
        const now = new Date("2027-03-01T10:00:00Z")
        expect(defaultRunAt(now).getTime() - now.getTime()).toBe(3600_000)
    })

    test("schedule-form/AC-2: 端末のタイムゾーンが東京のとき、同じ時刻のタイムゾーンつきの形式になる", () => {
        process.env.TZ = "Asia/Tokyo"
        const d = new Date("2027-03-01T10:30:00Z")
        const local = toLocalInputValue(d)
        expect(local).toBe("2027-03-01T19:30")
        const iso = toRunAtIso(local)
        expect(iso).toBe("2027-03-01T19:30:00+09:00")
        expect(Date.parse(iso)).toBe(d.getTime())
    })

    test("schedule-form/AC-2: 西側のタイムゾーンでも同じ時刻を指す", () => {
        process.env.TZ = "America/New_York"
        const d = new Date("2027-01-15T10:30:00Z")
        const iso = toRunAtIso(toLocalInputValue(d))
        expect(iso.endsWith("-05:00")).toBe(true)
        expect(Date.parse(iso)).toBe(d.getTime())
    })

    test("schedule-form/AC-3: 範囲が5分後から30日後のとき、4分後と31日後は範囲外、10分後と30日後は範囲内", () => {
        const now = new Date("2027-03-01T00:00:00Z")
        const at = (sec: number) => new Date(now.getTime() + sec * 1000)
        expect(checkRunAt(at(4 * 60), now, limits)).toBe("tooSoon")
        expect(checkRunAt(at(31 * 86400), now, limits)).toBe("tooLate")
        expect(checkRunAt(at(10 * 60), now, limits)).toBe("ok")
        expect(checkRunAt(at(30 * 86400), now, limits)).toBe("ok")
        expect(checkRunAt(new Date("invalid"), now, limits)).toBe("tooSoon")
    })
})

describe("エラー文言", () => {
    test("schedule-form/AC-11: 409 は識別子ごとに日本語と英語の文言になる", () => {
        for (const code of [
            "ScheduleCredentialRequired",
            "ScheduleRunning",
            "ScheduleCredentialInUse",
        ]) {
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
        expect(scheduleErrorKey(429)).toBe("schedule.error.tooMany")
        expect(scheduleErrorKey(500)).toBe("schedule.error.server")
        expect(failureMessageKey("CredentialExpired")).toBe(
            "schedule.failure.CredentialExpired",
        )
        expect(failureMessageKey("Unknown")).toBe("schedule.failure.unknown")
        expect(failureMessageKey(null)).toBe("schedule.failure.unknown")
    })

    test("schedule-form/AC-13: 日本語と英語の予約の文言のキー集合が一致する", () => {
        const keys = (d: object) =>
            Object.keys(d)
                .filter(
                    k =>
                        k.startsWith("schedule.") ||
                        k === "pageTitle.schedules",
                )
                .sort()
        expect(keys(en)).toEqual(keys(ja))
        expect(keys(ja).length).toBeGreaterThan(40)
    })
})

describe("ダイアログの状態遷移", () => {
    test("schedule-form/AC-4: 未登録なら登録が先に現れ、登録に成功すると送信に進む", () => {
        let s = nextDialogState("Editing", {
            type: "submit",
            credentialRegistered: false,
        })
        expect(s).toBe("Registering")
        s = nextDialogState(s, { type: "registered" })
        expect(s).toBe("Submitting")
        expect(nextDialogState(s, { type: "created" })).toBe("Done")
    })

    test("登録済みなら直接送信に進み、失敗すると Editing に戻る", () => {
        expect(
            nextDialogState("Editing", {
                type: "submit",
                credentialRegistered: true,
            }),
        ).toBe("Submitting")
        expect(nextDialogState("Registering", { type: "registerFailed" })).toBe(
            "Editing",
        )
        expect(nextDialogState("Submitting", { type: "createFailed" })).toBe(
            "Editing",
        )
        expect(nextDialogState("Done", { type: "reset" })).toBe("Editing")
    })

    test("schedule-form/AC-15: 送信中の確定操作は無視される", () => {
        const s = nextDialogState("Submitting", {
            type: "submit",
            credentialRegistered: true,
        })
        expect(s).toBe("Submitting")
        expect(
            nextDialogState("Registering", {
                type: "submit",
                credentialRegistered: true,
            }),
        ).toBe("Registering")
    })

    test("文言の置換が働く", () => {
        expect(
            createTranslator("ja").t("schedule.range.tooSoon", { minutes: 5 }),
        ).toContain("5分後")
    })
})
