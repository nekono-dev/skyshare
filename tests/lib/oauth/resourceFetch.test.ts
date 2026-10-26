import { describe, expect, test } from "vitest"
import {
    PDS,
    PDS_NONCE,
    createFakeOAuth,
    decodeJwt,
} from "../../helpers/fakeOAuth"
import { createDpopSession } from "@/lib/oauth/dpop"
import { generateEcJwk, sha256Base64url } from "@/lib/oauth/jose"
import { createDpopFetch } from "@/lib/oauth/resourceFetch"

const DID = "did:plc:aaaa"
const NOW = 1_800_000_000

describe("PDS への DPoP つきの要求", () => {
    test("[oauth-client/4.1,4.2] アクセストークンとそのハッシュを入れた証明が付き、nonce を求められると1回だけやり直す", async () => {
        const world = createFakeOAuth(DID)
        const dpop = await createDpopSession(await generateEcJwk())
        const fetchPds = createDpopFetch({
            pdsUrl: PDS,
            accessToken: "ACCESS-TOKEN-VALUE",
            dpop,
            now: () => NOW,
            fetchImpl: world.fetch,
        })

        const res = await fetchPds("/xrpc/com.atproto.server.getSession")
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ did: DID })
        expect(world.pdsRequests).toHaveLength(2)
        const [first, retry] = world.pdsRequests
        expect(retry!.authorization).toBe("DPoP ACCESS-TOKEN-VALUE")
        const proof = decodeJwt(retry!.dpop!).payload
        expect(proof).toMatchObject({
            htm: "GET",
            htu: `${PDS}/xrpc/com.atproto.server.getSession`,
            ath: await sha256Base64url("ACCESS-TOKEN-VALUE"),
            nonce: PDS_NONCE,
        })
        expect(decodeJwt(first!.dpop!).payload.nonce).toBeUndefined()
        // 受け取った nonce が残り、次の要求は最初から nonce を入れる
        expect(dpop.nonces.get(new URL(PDS).origin)).toBe(PDS_NONCE)
        await fetchPds("/xrpc/app.bsky.actor.getPreferences", {
            method: "POST",
            body: new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode("{}"))
                    controller.close()
                },
            }),
        })
        expect(world.pdsRequests).toHaveLength(3)
    })
})
