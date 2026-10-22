import { describe, expect, test } from "vitest"
import { nextTid } from "@/lib/schedule/tid"

describe("nextTid", () => {
    test("13文字で、続けて採番しても単調に増える", () => {
        let prev: string | undefined
        for (let i = 0; i < 200; i++) {
            const tid = nextTid(prev)
            expect(tid).toMatch(/^[234567a-z]{13}$/)
            if (prev) expect(tid > prev).toBe(true)
            prev = tid
        }
    })

    test("直前の値が未来の時刻でも、それより大きい値を返す", () => {
        const future = nextTid()
        const a = nextTid(future)
        const b = nextTid(a)
        expect(a > future).toBe(true)
        expect(b > a).toBe(true)
    })
})
