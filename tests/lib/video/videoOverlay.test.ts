import { describe, expect, it, vi } from "vitest"

import {
    drawVideoOverlay,
    formatVideoDuration,
    VIDEO_OVERLAY_SPEC,
} from "@/lib/video/videoOverlay"

describe("formatVideoDuration", () => {
    it.each([
        [5, "0:05"],
        [59.6, "1:00"],
        [0, "0:01"],
        [600, "10:00"],
        [65, "1:05"],
    ])("%s 秒 → %s", (sec, expected) => {
        expect(formatVideoDuration(sec)).toBe(expected)
    })
})

describe("VIDEO_OVERLAY_SPEC", () => {
    it("design.md §6.5.1 の値と一致する", () => {
        expect(VIDEO_OVERLAY_SPEC).toEqual({
            buttonDiameter: 59,
            buttonFill: "rgba(50, 50, 50, 0.6)",
            triangleWidth: 20,
            triangleHeight: 25,
            triangleFill: "#ffffff",
            triangleOffsetX: 2.5,
            badgeHeight: 20,
            badgePaddingX: 9,
            badgeRadius: 4,
            badgeFill: "rgba(0, 0, 0, 0.8)",
            badgeTextColor: "#ffffff",
            badgeFontSize: 13,
            badgeFontWeight: 700,
            badgeMarginLeft: 12,
            badgeMarginBottom: 12,
            referenceCardWidth: 506,
        })
    })
})

describe("drawVideoOverlay", () => {
    const S = 1200 / 506

    const makeContext = (textWidth = 40) => {
        const calls: { op: string; args: unknown[]; fillStyle?: unknown }[] = []
        const context: any = {
            fillStyle: "",
            font: "",
            textAlign: "",
            textBaseline: "",
            beginPath: () => calls.push({ op: "beginPath", args: [] }),
            closePath: () => calls.push({ op: "closePath", args: [] }),
            moveTo: (...args: number[]) => calls.push({ op: "moveTo", args }),
            lineTo: (...args: number[]) => calls.push({ op: "lineTo", args }),
            arc: (...args: number[]) => calls.push({ op: "arc", args }),
            arcTo: (...args: number[]) => calls.push({ op: "arcTo", args }),
            fill: vi.fn(() =>
                calls.push({
                    op: "fill",
                    args: [],
                    fillStyle: context.fillStyle,
                }),
            ),
            measureText: () => ({ width: textWidth }),
            fillText: (...args: unknown[]) =>
                calls.push({
                    op: "fillText",
                    args,
                    fillStyle: context.fillStyle,
                }),
        }
        return { context, calls }
    }

    it("scale=1 で円・再生記号・バッジを設計の寸法で描く", () => {
        const { context, calls } = makeContext(40)
        drawVideoOverlay(65)(context, 1)

        // 円: 中心は画像の中心、直径 139.9（59*S）
        const arc = calls.find(c => c.op === "arc")!
        expect(arc.args[0]).toBeCloseTo(600)
        expect(arc.args[1]).toBeCloseTo(315)
        expect((arc.args[2] as number) * 2).toBeCloseTo(139.9, 1)

        // 再生記号: 47.4 x 59.3、円の中心から右へ 5.9 ずれる
        const moves = calls.filter(c => c.op === "moveTo")
        const lines = calls.filter(c => c.op === "lineTo")
        const [tx0, ty0] = moves[0].args as number[]
        expect((lines[1].args[0] as number) - tx0).toBeCloseTo(47.4, 1)
        expect((lines[0].args[1] as number) - ty0).toBeCloseTo(59.3, 1)
        expect(tx0 + 47.4 / 2).toBeCloseTo(600 + 5.9, 1)

        // 塗り色
        const fills = calls.filter(c => c.op === "fill").map(c => c.fillStyle)
        expect(fills).toEqual([
            "rgba(50, 50, 50, 0.6)",
            "#ffffff",
            "rgba(0, 0, 0, 0.8)",
        ])

        // バッジの文字
        expect(context.font).toMatch(/^700 30\.83\d*px sans-serif$/)
        const text = calls.find(c => c.op === "fillText")!
        expect(text.args[0]).toBe("1:05")
        expect(text.fillStyle).toBe("#ffffff")
        expect(context.textAlign).toBe("center")
        expect(context.textBaseline).toBe("middle")

        // バッジ: 左 28.5・下 28.5・高さ 47.4・幅 = 文字幅 + 2*21.3
        const badgeStart = calls.filter(c => c.op === "moveTo")[1]
            .args as number[]
        const radius = 4 * S
        expect(badgeStart[0] - radius).toBeCloseTo(12 * S, 1)
        const badgeTop = badgeStart[1]
        expect(630 - (badgeTop + 20 * S)).toBeCloseTo(12 * S, 1)
        const arcTos = calls.filter(c => c.op === "arcTo")
        expect((arcTos[0].args[0] as number) - 12 * S).toBeCloseTo(
            40 + 2 * 9 * S,
            1,
        )
        expect(text.args[1]).toBeCloseTo(12 * S + (40 + 2 * 9 * S) / 2, 1)
    })

    it("scale を掛けた寸法で描く", () => {
        const { context, calls } = makeContext()
        drawVideoOverlay(5)(context, 0.5)
        const arc = calls.find(c => c.op === "arc")!
        expect(arc.args[0]).toBeCloseTo(300)
        expect(arc.args[1]).toBeCloseTo(157.5)
        expect((arc.args[2] as number) * 2).toBeCloseTo(139.9 / 2, 1)
    })
})
