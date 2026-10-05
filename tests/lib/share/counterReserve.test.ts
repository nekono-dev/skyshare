import { describe, expect, it } from "vitest"

import { estimateSkyshareEntryUrl } from "@/lib/entry/estimateEntryUrl"
import { skyshareEntryUrlgen } from "@/lib/entry/url"
import {
    resolveCounterReserve,
    resolveCounterTargets,
} from "@/lib/share/counterReserve"
import { TID } from "@atproto/common-web"

const DID = "did:plc:abcdefghijklmnopqrstuvwx"

describe("estimateSkyshareEntryUrl", () => {
    it("実際のURLと同じ長さ・構造になる", () => {
        const actual = skyshareEntryUrlgen(DID, TID.nextStr())
        expect(estimateSkyshareEntryUrl(DID).length).toBe(actual.length)
        expect(
            estimateSkyshareEntryUrl(DID).startsWith(
                actual.slice(0, actual.indexOf(DID)),
            ),
        ).toBe(true)
    })

    it("DID未取得ならdid:plc相当の長さで見積もる", () => {
        expect(estimateSkyshareEntryUrl(null).length).toBe(
            estimateSkyshareEntryUrl(DID).length,
        )
    })
})

describe("resolveCounterTargets", () => {
    it.each([
        ["x", true, ["x"]],
        ["taittsuu", true, ["taittsuu"]],
        ["mastodon", true, []],
        ["ask", true, ["x", "taittsuu"]],
        ["taittsuu", false, ["x"]],
        ["mastodon", false, ["x"]],
    ] as const)("%s / popup=%s", (target, popup, expected) => {
        expect(resolveCounterTargets(target, popup)).toEqual(expected)
    })
})

describe("resolveCounterReserve", () => {
    const entryUrl = estimateSkyshareEntryUrl(DID)

    it("末尾文字列が無ければ0", () => {
        expect(
            resolveCounterReserve({
                target: "x",
                body: "本文",
                entryUrl: null,
                linkCardUrl: "",
            }),
        ).toBe(0)
    })

    it("Xは改行1 + URL23 = 24 → 12", () => {
        expect(
            resolveCounterReserve({
                target: "x",
                body: "本文",
                entryUrl,
                linkCardUrl: "",
            }),
        ).toBe(12)
    })

    it("タイッツーはURLの全文字を半角0.5で数える", () => {
        expect(
            resolveCounterReserve({
                target: "taittsuu",
                body: "本文",
                entryUrl,
                linkCardUrl: "",
            }),
        ).toBe(Math.ceil((entryUrl.length + 1) / 2))
    })

    it("本文に無いリンクカードURLも差し引く", () => {
        const link = "https://example.com/a"
        const withLink = resolveCounterReserve({
            target: "taittsuu",
            body: "本文",
            entryUrl: null,
            linkCardUrl: link,
        })
        expect(withLink).toBe(Math.ceil((link.length + 1) / 2))
    })

    it("本文に含まれるリンクカードURLは差し引かない", () => {
        expect(
            resolveCounterReserve({
                target: "x",
                body: "見て example.com/a",
                entryUrl: null,
                linkCardUrl: "https://example.com/a",
            }),
        ).toBe(0)
    })
})
