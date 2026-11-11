/**
 * Provides an isolated Bluesky HTTP server for tests.
 * Configured paths receive fixture responses; unknown paths return 404 without forwarding.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { type FakeBluesky, startFakeBluesky } from "../../support/fakeBluesky"

const fixtures = {
    did: "did:plc:testfixturealice0000000000",
    handle: "alice.test",
}

describe("fake Bluesky", () => {
    let fake: FakeBluesky

    beforeEach(async () => {
        fake = await startFakeBluesky({ port: 0, fixtures })
    })

    afterEach(async () => {
        await fake.close()
    })

    it("serves the authorization server metadata with its own origin", async () => {
        const res = await fetch(
            `${fake.origin}/.well-known/oauth-authorization-server`,
        )
        expect(res.status).toBe(200)
        const body = (await res.json()) as {
            issuer: string
            pushed_authorization_request_endpoint: string
        }
        expect(body.issuer).toBe(fake.origin)
        expect(body.pushed_authorization_request_endpoint).toBe(
            `${fake.origin}/oauth/par`,
        )
    })

    it("returns 404 for an undefined path and never forwards it", async () => {
        const res = await fetch(`${fake.origin}/xrpc/app.bsky.feed.getTimeline`)
        expect(res.status).toBe(404)
    })

    it("records every requested path, including undefined ones", async () => {
        await fetch(`${fake.origin}/.well-known/oauth-protected-resource`)
        await fetch(`${fake.origin}/undefined/path`)
        expect(fake.requests.map(r => r.path)).toEqual([
            "/.well-known/oauth-protected-resource",
            "/undefined/path",
        ])
    })

    it("answers a CORS preflight for browser-originated requests", async () => {
        const res = await fetch(
            `${fake.origin}/.well-known/oauth-authorization-server`,
            { method: "OPTIONS" },
        )
        expect(res.status).toBe(204)
        expect(res.headers.get("access-control-allow-origin")).toBe("*")
    })
})
