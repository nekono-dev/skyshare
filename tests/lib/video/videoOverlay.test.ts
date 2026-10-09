import { describe, expect, it, vi } from "vitest"

import { drawVideoOverlay, VIDEO_OVERLAY_SPEC } from "@/lib/video/videoOverlay"

describe("VIDEO_OVERLAY_SPEC", () => {
    it("design.md §6.5.1 の値と一致する", () => {
        expect(VIDEO_OVERLAY_SPEC).toEqual({
            buttonDiameter: 59,
            buttonFill: "rgba(50, 50, 50, 0.6)",
            triangleWidth: 20,
            triangleHeight: 25,
            triangleFill: "#ffffff",
            triangleOffsetX: 2.5,
            referenceCardWidth: 342,
        })
    })
})

describe("drawVideoOverlay", () => {
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

    it("[entry-visual/AC-11] scale=1 で円・再生記号を設計の寸法で描く", () => {
        const { context, calls } = makeContext(40)
        drawVideoOverlay()(context, 1)

        // 円: 中心は画像の中心、直径 207.0（59*S）
        const arc = calls.find(c => c.op === "arc")!
        expect(arc.args[0]).toBeCloseTo(600)
        expect(arc.args[1]).toBeCloseTo(315)
        expect((arc.args[2] as number) * 2).toBeCloseTo(207.0, 1)

        // 再生記号: 70.2 x 87.7、円の中心から右へ 8.8 ずれる
        const moves = calls.filter(c => c.op === "moveTo")
        const lines = calls.filter(c => c.op === "lineTo")
        const [tx0, ty0] = moves[0].args as number[]
        expect((lines[1].args[0] as number) - tx0).toBeCloseTo(70.2, 1)
        expect((lines[0].args[1] as number) - ty0).toBeCloseTo(87.7, 1)
        expect(tx0 + 70.2 / 2).toBeCloseTo(600 + 8.8, 1)

        // 塗り色
        const fills = calls.filter(c => c.op === "fill").map(c => c.fillStyle)
        expect(fills).toEqual(["rgba(50, 50, 50, 0.6)", "#ffffff"])

        // 再生時間バッジは描かない（文字・角丸矩形の描画命令なし）
        expect(calls.some(c => c.op === "fillText" || c.op === "arcTo")).toBe(
            false,
        )
    })

    it("[entry-visual/AC-4] scale を掛けた寸法で描く", () => {
        const { context, calls } = makeContext()
        drawVideoOverlay()(context, 0.5)
        const arc = calls.find(c => c.op === "arc")!
        expect(arc.args[0]).toBeCloseTo(300)
        expect(arc.args[1]).toBeCloseTo(157.5)
        expect((arc.args[2] as number) * 2).toBeCloseTo(207.0 / 2, 1)
    })
})
