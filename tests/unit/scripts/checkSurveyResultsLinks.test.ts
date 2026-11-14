/**
 * ビルド後のアンケート結果ページとログインページのリンク整合を検査する。
 */
import { describe, expect, it } from "vitest"
import { findLinkMismatch } from "../../../scripts/build/checkSurveyResultsLinks.mjs"

describe("findLinkMismatch", () => {
    it("accepts a link when the surveys page exists", () => {
        expect(
            findLinkMismatch({
                loginHtml: '<a href="/surveys/">',
                surveysPageExists: true,
            }),
        ).toBeUndefined()
    })

    it("accepts no link when the surveys page does not exist", () => {
        expect(
            findLinkMismatch({ loginHtml: "", surveysPageExists: false }),
        ).toBeUndefined()
    })

    it("reports a link without a page", () => {
        expect(
            findLinkMismatch({
                loginHtml: '<a href="/surveys/">',
                surveysPageExists: false,
            }),
        ).toBe("link-without-page")
    })

    it("reports a page without a link", () => {
        expect(
            findLinkMismatch({ loginHtml: "", surveysPageExists: true }),
        ).toBe("page-without-link")
    })
})
