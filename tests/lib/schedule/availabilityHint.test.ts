import { afterEach, describe, expect, test } from "vitest"
import {
    SCHEDULE_HINT_COOKIE_NAME,
    SCHEDULE_HINT_MAX_AGE_SECONDS,
    makeScheduleHintClearCookie,
    makeScheduleHintSetCookie,
    parseScheduleHint,
    readScheduleHint,
} from "@/lib/schedule/availabilityHint"

describe("登録状態のヒント cookie", () => {
    const original = process.env.PUBLIC_NODE_ENV
    afterEach(() => {
        process.env.PUBLIC_NODE_ENV = original
    })

    test("schedule-api/4.6,4.8,4.10: 保存する cookie は7日で、クライアントが読めるよう HttpOnly を付けず、本番だけ Secure を付ける", () => {
        process.env.PUBLIC_NODE_ENV = "development"
        const dev = makeScheduleHintSetCookie({
            registered: true,
            reauthRequired: false,
        })
        expect(dev.startsWith(`${SCHEDULE_HINT_COOKIE_NAME}=`)).toBe(true)
        expect(dev).toContain(`Max-Age=${SCHEDULE_HINT_MAX_AGE_SECONDS}`)
        expect(dev).toContain("Path=/")
        expect(dev).not.toContain("HttpOnly")
        expect(dev).not.toContain("Secure")
        process.env.PUBLIC_NODE_ENV = "production"
        expect(
            makeScheduleHintSetCookie({
                registered: false,
                reauthRequired: false,
            }),
        ).toContain("Secure")
    })

    test("schedule-api/4.6,4.8,4.10: 失効させる cookie は値が空で Max-Age が 0", () => {
        const clear = makeScheduleHintClearCookie()
        expect(clear.startsWith(`${SCHEDULE_HINT_COOKIE_NAME}=;`)).toBe(true)
        expect(clear).toContain("Max-Age=0")
    })

    test("schedule-api/4.6,4.8,4.10: Cookie ヘッダから、保存したヒントを元の形で読み戻せる", () => {
        const set = makeScheduleHintSetCookie({
            registered: true,
            reauthRequired: true,
            expiresAt: "2027-01-01T00:00:00.000Z",
        })
        const pair = set.split(";")[0]!
        expect(readScheduleHint(`a=1; ${pair}; b=2`)).toEqual({
            registered: true,
            reauthRequired: true,
            expiresAt: "2027-01-01T00:00:00.000Z",
        })
        expect(readScheduleHint("a=1; b=2")).toBeUndefined()
    })

    test("schedule-api/4.6,4.8,4.10: 壊れた値や形の違う値はヒントとして扱わない", () => {
        for (const value of [
            undefined,
            "",
            "%E0%A4%A",
            encodeURIComponent("not json"),
            encodeURIComponent("[]"),
            encodeURIComponent(JSON.stringify({ registered: "yes" })),
            encodeURIComponent(
                JSON.stringify({
                    registered: true,
                    reauthRequired: false,
                    expiresAt: 1,
                }),
            ),
        ]) {
            expect(parseScheduleHint(value)).toBeUndefined()
        }
    })
})
