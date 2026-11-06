// route 層の外部通信（要件 5.1・10.5）: workerd からの fetch は偽の Bluesky の応答を受け、未定義の経路は 404
import { describe, expect, it } from "vitest"

describe("route outbound (fake Bluesky)", () => {
    it("answers a Bluesky authorization server request from the fake definition", async () => {
        const res = await fetch(
            "https://bsky.social/.well-known/oauth-authorization-server",
        )
        expect(res.status).toBe(200)
        const body = (await res.json()) as { issuer: string }
        expect(body.issuer).toBe("https://bsky.social")
    })

    it("returns 404 for an undefined path instead of reaching the network", async () => {
        const res = await fetch(
            "https://api.bsky.app/xrpc/app.bsky.feed.getTimeline",
        )
        expect(res.status).toBe(404)
    })
})
