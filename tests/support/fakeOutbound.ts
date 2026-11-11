/**
 * Serves fake Bluesky responses to outbound requests in the route test runtime.
 * Unknown routes return 404 without reaching the network.
 */
import { createFakeStore, respondTo } from "./fakeBluesky/routes"
import type { FakeBlueskyFixtures } from "./fakeBluesky/types"

/** Fixed fake identity used by route tests. */
const fixtures: FakeBlueskyFixtures = {
    did: "did:plc:testfixturealice0000000000",
    handle: "alice.test",
}

/** Shares authorization state within a route test file, like its D1 database. */
const store = createFakeStore()

/** Handles an outbound fetch from workerd and returns the matching fake response. */
export const fakeOutbound = async (request: Request): Promise<Response> => {
    const body =
        request.method === "GET" || request.method === "HEAD"
            ? ""
            : await request.text()
    const reply = respondTo({
        method: request.method,
        url: new URL(request.url),
        fixtures,
        body,
        store,
    })
    if (!reply)
        return new Response(
            JSON.stringify({ error: "NotFound", message: "no fake route" }),
            { status: 404 },
        )
    return new Response(
        reply.body === undefined ? null : JSON.stringify(reply.body),
        {
            status: reply.status,
            headers: { "content-type": "application/json", ...reply.headers },
        },
    )
}
