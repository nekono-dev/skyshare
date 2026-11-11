/**
 * Verifies server-rendered analytics markup with and without a measurement ID.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import { describe, expect, it } from "vitest"
import AnalyticsTag from "@/components/layout/AnalyticsTag/index.astro"

describe("AnalyticsTag (server render)", () => {
    it("renders nothing when no measurement ID is configured", async () => {
        const container = await AstroContainer.create()
        const html = await container.renderToString(AnalyticsTag, {
            props: { measurementId: null },
        })
        expect(html.trim()).toBe("")
    })

    it("renders the gtag loader and the config call for a measurement ID", async () => {
        const container = await AstroContainer.create()
        const html = await container.renderToString(AnalyticsTag, {
            props: { measurementId: "G-TEST12345" },
        })
        expect(html).toContain('type="text/partytown"')
        expect(html).toContain(
            "https://www.googletagmanager.com/gtag/js?id=G-TEST12345",
        )
        expect(html).toContain('gtag("config", "G-TEST12345")')
    })
})
