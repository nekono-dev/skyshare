import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { decodeJwt, verifyJwt } from "../../helpers/fakeOAuth"
import { createTestClientSecret } from "../../helpers/oauthTestKeys"
import {
    SCHEDULE_SCOPE,
    SESSION_SCOPE,
    clientAuthParams,
    clientIdFor,
    clientJwks,
    clientMetadata,
    loadClientKey,
    redirectUriFor,
} from "@/lib/oauth/client"
import { isLoopbackOrigin } from "@/lib/oauth/loopback"

const ORIGIN = "https://skyshare.test"
const DEV = "https://localhost:4321"
const NOW = 1_800_000_000

describe("OAuth のクライアントの識別", () => {
    test("[oauth-client/1.1] 本番のメタデータが、識別子・戻り先・公開鍵の一覧の住所と、ログインと予約の両方の権限を含む", () => {
        const meta = clientMetadata(ORIGIN, "Skyshare")
        expect(meta).toMatchObject({
            client_id: `${ORIGIN}/oauth/client-metadata.json`,
            redirect_uris: [`${ORIGIN}/oauth/callback/`],
            jwks_uri: `${ORIGIN}/oauth/jwks.json`,
            token_endpoint_auth_method: "private_key_jwt",
            dpop_bound_access_tokens: true,
        })
        const scopes = meta.scope.split(" ")
        for (const scope of [
            ...SESSION_SCOPE.split(" "),
            ...SCHEDULE_SCOPE.split(" "),
        ]) {
            expect(scopes).toContain(scope)
        }
        // 重複を除いている
        expect(new Set(scopes).size).toBe(scopes.length)
    })

    test("[oauth-client/1.2] 公開鍵の一覧に秘密鍵の成分が含まれない", async () => {
        const client = (await loadClientKey(await createTestClientSecret()))!
        const jwks = clientJwks(client)
        expect(jwks.keys).toHaveLength(1)
        expect(jwks.keys[0]).toMatchObject({ kid: "test-key", alg: "ES256" })
        expect(jwks.keys[0]).not.toHaveProperty("d")
    })

    test("[oauth-client/1.3] ループバックのオリジンでは、識別子が権限と戻り先を含む開発用の形になり、戻り先がループバックの IP の http になる", () => {
        expect(isLoopbackOrigin(DEV)).toBe(true)
        expect(isLoopbackOrigin("http://127.0.0.1:8787")).toBe(true)
        expect(isLoopbackOrigin(ORIGIN)).toBe(false)

        const redirect = redirectUriFor(DEV)
        expect(redirect).toBe("http://127.0.0.1:4322/oauth/callback/")
        const id = new URL(clientIdFor(DEV))
        expect(`${id.protocol}//${id.host}`).toBe("http://localhost")
        expect(id.searchParams.get("redirect_uri")).toBe(redirect)
        expect(id.searchParams.get("scope")).toBe(
            clientMetadata(ORIGIN, "x").scope,
        )
    })

    test("[oauth-client/1.4,1.5] 開発用の証明は識別子だけ、それ以外は署名した証明になり、秘密鍵が無ければ作れない", async () => {
        const devId = clientIdFor(DEV)
        expect(
            await clientAuthParams(null, devId, "https://bsky.social", NOW),
        ).toEqual({ client_id: devId })

        const secret = await createTestClientSecret()
        const client = await loadClientKey(secret)
        const prodId = clientIdFor(ORIGIN)
        const params = (await clientAuthParams(
            client,
            prodId,
            "https://bsky.social",
            NOW,
        ))!
        expect(params.client_assertion_type).toBe(
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        )
        const assertion = decodeJwt(params.client_assertion!)
        expect(assertion.payload).toMatchObject({
            iss: prodId,
            sub: prodId,
            aud: "https://bsky.social",
            exp: NOW + 60,
        })
        expect(
            await verifyJwt(params.client_assertion!, JSON.parse(secret)),
        ).toBe(true)

        expect(
            await clientAuthParams(null, prodId, "https://bsky.social", NOW),
        ).toBeNull()
    })

    test("[oauth-client/4.3] OAuth のクライアントの処理が、atproto のライブラリを読み込まない", () => {
        const dir = join(process.cwd(), "src/lib/oauth")
        for (const file of readdirSync(dir)) {
            const text = readFileSync(join(dir, file), "utf8")
            expect(text, file).not.toMatch(/from\s+["']@atproto\//)
            expect(text, file).not.toMatch(/import\(\s*["']@atproto\//)
        }
    })
})
