// 偽の Bluesky の記録（E2E の別プロセスが読む経路）: 受けた経路を JSON で返す
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
    type FakeBluesky,
    REQUESTS_PATH,
    startFakeBluesky,
} from "../../support/fakeBluesky"

describe("fake Bluesky request log", () => {
    let fake: FakeBluesky

    beforeEach(async () => {
        fake = await startFakeBluesky({
            port: 0,
            fixtures: {
                did: "did:plc:testfixturealice0000000000",
                handle: "alice.test",
            },
        })
    })

    afterEach(async () => {
        await fake.close()
    })

    it("returns the paths it received, readable over HTTP", async () => {
        await fetch(`${fake.origin}/.well-known/oauth-protected-resource`)
        const res = await fetch(`${fake.origin}${REQUESTS_PATH}`)
        const body = (await res.json()) as {
            requests: { method: string; path: string }[]
        }
        expect(body.requests.map(r => r.path)).toContain(
            "/.well-known/oauth-protected-resource",
        )
    })
})
