import { describe, expect, test } from "vitest"
import { AUTH, PDS, createFakeOAuth } from "../../helpers/fakeOAuth"
import {
    discoverAuthorizationServer,
    readAuthorizationServer,
    resolvePdsUrl,
} from "@/lib/oauth/discovery"

const DID = "did:plc:aaaa"

/** 認可サーバーのメタデータの応答だけを差し替えた fetch */
const withMetadata =
    (meta: Record<string, unknown>): typeof fetch =>
    (async () =>
        new Response(JSON.stringify(meta), {
            headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch

const goodMeta = {
    issuer: AUTH,
    authorization_endpoint: `${AUTH}/oauth/authorize`,
    pushed_authorization_request_endpoint: `${AUTH}/oauth/par`,
    token_endpoint: `${AUTH}/oauth/token`,
    dpop_signing_alg_values_supported: ["ES256"],
    token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
}

describe("認可サーバーの探索と PDS の解決", () => {
    test("oauth-client/AC-5: メタデータの識別子が違う認可サーバーと、必要な端点が欠けた認可サーバーは使われない", async () => {
        expect(
            await readAuthorizationServer(
                AUTH,
                withMetadata({ ...goodMeta, issuer: "https://evil.example" }),
            ),
        ).toBeNull()
        const { token_endpoint: _omit, ...noToken } = goodMeta
        expect(
            await readAuthorizationServer(AUTH, withMetadata(noToken)),
        ).toBeNull()
        expect(
            await readAuthorizationServer(
                AUTH,
                withMetadata({
                    ...goodMeta,
                    token_endpoint_auth_methods_supported: ["none"],
                }),
            ),
        ).toBeNull()
    })

    test("oauth-client/AC-6: 認可サーバーの識別子から、その端点が得られ、PDS からも同じ認可サーバーに辿れる", async () => {
        expect(
            await readAuthorizationServer(AUTH, withMetadata(goodMeta)),
        ).toEqual({
            issuer: AUTH,
            authorizationEndpoint: `${AUTH}/oauth/authorize`,
            parEndpoint: `${AUTH}/oauth/par`,
            tokenEndpoint: `${AUTH}/oauth/token`,
        })
        const world = createFakeOAuth(DID)
        expect(
            (await discoverAuthorizationServer(PDS, world.fetch))?.issuer,
        ).toBe(AUTH)
    })

    test("oauth-client/AC-7: DID ドキュメントの PDS が解決され、解決できない DID では何も返らない", async () => {
        const world = createFakeOAuth(DID)
        expect(await resolvePdsUrl(DID, world.fetch)).toBe(PDS)
        expect(await resolvePdsUrl("did:example:x", world.fetch)).toBeNull()
        expect(
            await resolvePdsUrl("did:web:evil.example:8080", world.fetch),
        ).toBeNull()
    })
})
