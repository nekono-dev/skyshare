/**
 * SurveyGate（常駐する入口）の描画の確認。
 *
 * 方針:
 * - node 環境のため、判定は effect で走り、サーバー描画では何も出さないことだけを確認する。
 * - 判定の順序・送信の振り分けは `tests/lib/survey/gate.test.ts` で確認する。
 */
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import SurveyGate from "@/components/survey/SurveyGate"

describe("SurveyGate", () => {
    it("判定の前（サーバー描画）は何も描画しない", () => {
        expect(renderToStaticMarkup(createElement(SurveyGate))).toBe("")
    })

    it("React の要素として import できる", () => {
        expect(typeof SurveyGate).toBe("function")
        expect(React.isValidElement(createElement(SurveyGate))).toBe(true)
    })
})
