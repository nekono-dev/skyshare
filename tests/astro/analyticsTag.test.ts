/**
 * Google アナリティクスのタグ（`AnalyticsTag`）の描画テスト。
 *
 * 責務と処理概要:
 * - 測定 ID があるときだけ gtag のタグが出力され、ID が初期化に使われることを確かめる。
 */
import { describe, expect, it } from "vitest"

import AnalyticsTag from "@/components/layout/AnalyticsTag.astro"
import { renderAstro } from "./support/renderAstro"

describe("AnalyticsTag", () => {
    it("[site-config/1.6,1.7] 測定 ID があるときだけ GA のタグを出力する", async () => {
        const html = await renderAstro(AnalyticsTag, {
            measurementId: "G-TEST123",
        })
        expect(html).toContain(
            "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
        )
        expect(html).toContain('gtag("config", "G-TEST123")')

        const none = await renderAstro(AnalyticsTag, { measurementId: null })
        expect(none).not.toContain("googletagmanager")
        expect(none).not.toContain("gtag")
    })
})
