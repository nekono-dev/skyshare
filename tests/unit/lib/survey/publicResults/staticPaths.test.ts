/**
 * 公開結果の件数に応じた静的経路の有無を確かめる。
 */

import { describe, expect, it } from "vitest"
import { createSurveyResultStaticPaths } from "@/lib/survey/publicResults/staticPaths"

describe("createSurveyResultStaticPaths", () => {
    it("does not create a route when there are no published surveys", () => {
        expect(createSurveyResultStaticPaths([])).toEqual([])
    })

    it("creates the surveys root route and passes the published surveys", () => {
        const surveys = [{ id: "first" }, { id: "second" }]

        expect(createSurveyResultStaticPaths(surveys)).toEqual([
            { params: { slug: undefined }, props: { surveys } },
        ])
    })
})
