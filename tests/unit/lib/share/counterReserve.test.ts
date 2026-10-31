// 共有の文字数の予約（P0・要件 2.1 の「共有の文字数」）: 共有先の決め方と、URL 分の上限の補正
import { describe, expect, it } from "vitest"
import {
    resolveCounterReserve,
    resolveCounterTargets,
} from "@/lib/share/counterReserve"

const ENTRY_URL = "https://skyshare.test/entry/1"

describe("resolveCounterTargets", () => {
    it("counts only X when the share is not the popup intent", () => {
        expect(resolveCounterTargets("ask", false)).toEqual(["x"])
    })

    it("returns no counter for Mastodon and Misskey, which have no fixed limit here", () => {
        expect(resolveCounterTargets("mastodon", true)).toEqual([])
        expect(resolveCounterTargets("misskey", true)).toEqual([])
    })

    it("counts both X and taittsuu when the target is asked", () => {
        expect(resolveCounterTargets("ask", true)).toEqual(["x", "taittsuu"])
    })
})

describe("resolveCounterReserve", () => {
    it("reserves nothing when there is neither an entry URL nor a link card", () => {
        expect(
            resolveCounterReserve({
                target: "x",
                body: "本文",
                entryUrl: null,
                linkCardUrl: "",
            }),
        ).toBe(0)
    })

    it("reserves a positive whole number of characters when the URL is appended", () => {
        const reserve = resolveCounterReserve({
            target: "x",
            body: "本文",
            entryUrl: ENTRY_URL,
            linkCardUrl: "",
        })
        expect(Number.isInteger(reserve)).toBe(true)
        expect(reserve).toBeGreaterThan(0)
    })

    it("reserves more when the URL is longer", () => {
        const short = resolveCounterReserve({
            target: "x",
            body: "本文",
            entryUrl: "https://a.test/1",
            linkCardUrl: "",
        })
        const long = resolveCounterReserve({
            target: "x",
            body: "本文",
            entryUrl: "https://a.test/" + "x".repeat(200),
            linkCardUrl: "",
        })
        expect(long).toBeGreaterThan(short)
    })
})

describe("resolveCounterTargets (single targets)", () => {
    it("counts only X for the X target when the popup intent is used", () => {
        expect(resolveCounterTargets("x", true)).toEqual(["x"])
    })

    it("counts only taittsuu for the taittsuu target when the popup intent is used", () => {
        expect(resolveCounterTargets("taittsuu", true)).toEqual(["taittsuu"])
    })
})
