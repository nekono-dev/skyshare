import { beforeEach, describe, expect, test, vi } from "vitest"
import { createFakeD1 } from "../../helpers/fakeD1"
import {
    AUTH,
    NONCE,
    PDS,
    createFakeOAuth,
    decodeJwt,
    verifyJwt,
} from "../../helpers/fakeOAuth"
import { createTestClientSecret } from "../../helpers/oauthTestKeys"
import {
    OAUTH_SCOPE,
    clientIdFor,
    clientMetadata,
    redirectUriFor,
} from "@/lib/schedule/oauth/client"
import { parseCredential } from "@/lib/schedule/oauth/storedCredential"
import {
    completeAuthorization,
    refreshTokens,
    startAuthorization,
} from "@/lib/schedule/oauth/flow"
import { sha256Base64url } from "@/lib/schedule/oauth/jose"
import { loadCredential } from "@/lib/schedule/store"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)))
const DID = "did:plc:aaaa"
const ORIGIN = "https://skyshare.test"
const NOW = 1_800_000_000

let db: ReturnType<typeof createFakeD1>
let world: ReturnType<typeof createFakeOAuth>
let env: { DB: typeof db; SCHEDULE_ENC_KEY: string; SCHEDULE_OAUTH_KEY: string }

beforeEach(async () => {
    db = createFakeD1()
    world = createFakeOAuth(DID)
    env = {
        DB: db,
        SCHEDULE_ENC_KEY: KEY,
        SCHEDULE_OAUTH_KEY: await createTestClientSecret(),
    }
})

/** 認可を開始し、PAR に送った state と、認可の画面の URL を返す */
const start = async (did = DID) => {
    const result = await startAuthorization(
        env,
        { origin: ORIGIN, did, now: NOW },
        world.fetch,
    )
    if (!result.ok) throw new Error(`start failed: ${result.status}`)
    const par = world.requests
        .filter(r => r.url === `${AUTH}/oauth/par`)
        .at(-1)!
    return { url: new URL(result.url), state: par.form.state!, par }
}

const complete = (state: string, did = DID, extra: object = {}) =>
    completeAuthorization(
        env,
        {
            origin: ORIGIN,
            did,
            now: NOW + 30,
            query: { code: "AUTH-CODE-VALUE", state, iss: AUTH, ...extra },
        },
        world.fetch,
    )

describe("予約投稿の OAuth", () => {
    test("schedule-api/AC-5: 認可の開始は、ログイン中のアカウントを指定した PAR を、署名つきの証明とともに送り、認可の画面の URL を返す", async () => {
        const { url, par } = await start()
        expect(`${url.origin}${url.pathname}`).toBe(`${AUTH}/oauth/authorize`)
        expect(url.searchParams.get("client_id")).toBe(clientIdFor(ORIGIN))
        expect(url.searchParams.get("request_uri")).toBe("urn:request:1")

        // ユーザー名を受け取らず、ログイン中のアカウントを指定する
        expect(par.form.login_hint).toBe(DID)
        expect(par.form.scope).toBe(OAUTH_SCOPE)
        expect(par.form.redirect_uri).toBe(redirectUriFor(ORIGIN))
        expect(par.form.code_challenge_method).toBe("S256")

        // 認可サーバーが求めた nonce で1回だけやり直している
        expect(
            world.requests.filter(r => r.url === `${AUTH}/oauth/par`),
        ).toHaveLength(2)
        const proof = decodeJwt(par.dpop!)
        expect(proof.header.typ).toBe("dpop+jwt")
        expect(proof.payload).toMatchObject({
            htm: "POST",
            htu: `${AUTH}/oauth/par`,
            nonce: NONCE,
        })
        expect(await verifyJwt(par.dpop!, proof.header.jwk)).toBe(true)

        // クライアントの証明は、クライアントの公開鍵で検証でき、宛先が認可サーバーになっている
        const assertion = decodeJwt(par.form.client_assertion!)
        expect(assertion.payload).toMatchObject({
            iss: clientIdFor(ORIGIN),
            sub: clientIdFor(ORIGIN),
            aud: AUTH,
        })
        const clientJwk = JSON.parse(env.SCHEDULE_OAUTH_KEY)
        expect(await verifyJwt(par.form.client_assertion!, clientJwk)).toBe(
            true,
        )
    })

    test("schedule-api/AC-5: 認可の完了で、PKCE の verifier と DPoP つきでトークンを得て、更新用トークンを暗号化して保管する", async () => {
        const { state, par } = await start()
        expect(await complete(state)).toEqual({ ok: true })

        const token = world.requests
            .filter(r => r.url === `${AUTH}/oauth/token`)
            .at(-1)!
        expect(token.form.grant_type).toBe("authorization_code")
        expect(await sha256Base64url(token.form.code_verifier!)).toBe(
            par.form.code_challenge,
        )
        // 認可の開始と同じ DPoP の鍵を使う
        expect(decodeJwt(token.dpop!).header.jwk).toEqual(
            decodeJwt(par.dpop!).header.jwk,
        )

        const stored = await loadCredential(db, KEY, DID)
        expect(stored?.service).toBe(PDS)
        const credential = parseCredential(stored!.token)
        expect(credential).toMatchObject({
            refreshToken: "REFRESH-TOKEN-VALUE",
            issuer: AUTH,
            tokenEndpoint: `${AUTH}/oauth/token`,
            clientId: clientIdFor(ORIGIN),
        })
        // 保管した行に、トークンが平文で入っていない
        const row = await db
            .prepare("SELECT token_enc FROM schedule_credentials WHERE did = ?")
            .bind(DID)
            .first<{ token_enc: string }>()
        expect(row!.token_enc).not.toContain("REFRESH-TOKEN-VALUE")
    })

    test("schedule-api/AC-6: トークンの持ち主がログイン中のアカウントと違うときは、保管しない", async () => {
        const { state } = await start()
        world.tokenSub = "did:plc:other"
        expect(await complete(state)).toEqual({
            ok: false,
            code: "AccountMismatch",
        })
        expect(await loadCredential(db, KEY, DID)).toBeNull()
    })

    test("schedule-api/AC-7: 別のアカウントの state・使用済みの state・発行元の違う戻りは受け付けない", async () => {
        const first = await start()
        // 別のアカウントのセッションでは、state を照合できない
        expect(await complete(first.state, "did:plc:other")).toEqual({
            ok: false,
            code: "StateInvalid",
        })
        // 一度照合を試みた state は、元のアカウントでも使えない
        expect(await complete(first.state)).toEqual({
            ok: false,
            code: "StateInvalid",
        })
        const second = await start()
        expect(
            await complete(second.state, DID, { iss: "https://evil.example" }),
        ).toEqual({
            ok: false,
            code: "IssuerMismatch",
        })
        // 拒否の戻りは保管しない
        const third = await start()
        expect(
            await complete(third.state, DID, {
                error: "access_denied",
                code: undefined,
            }),
        ).toEqual({ ok: false, code: "Denied" })
        expect(await loadCredential(db, KEY, DID)).toBeNull()
    })

    test("schedule-api/AC-15: 認可の失敗でも、トークン・認可コード・鍵がログに現れない", async () => {
        const logs: string[] = []
        const spies = (["log", "warn", "error"] as const).map(m =>
            vi.spyOn(console, m).mockImplementation((...a) => {
                logs.push(a.map(String).join(" "))
            }),
        )
        const { state } = await start()
        world.tokenSub = "did:plc:other"
        await complete(state)
        const failing = await start()
        const broken = world.fetch
        world.fetch = (async (input: string, init?: RequestInit) =>
            input.endsWith("/oauth/token")
                ? new Response("{}", { status: 500 })
                : broken(input, init)) as typeof fetch
        await complete(failing.state)
        spies.forEach(s => s.mockRestore())
        const all = logs.join("\n")
        for (const secret of [
            "ACCESS-TOKEN-VALUE",
            "REFRESH-TOKEN-VALUE",
            "AUTH-CODE-VALUE",
            JSON.parse(env.SCHEDULE_OAUTH_KEY).d,
        ]) {
            expect(all).not.toContain(secret)
        }
    })

    test("更新用トークンで新しいトークンを得て、回転した更新用トークンを返す。取り消された更新用トークンは Expired になる", async () => {
        const { state } = await start()
        await complete(state)
        const credential = parseCredential(
            (await loadCredential(db, KEY, DID))!.token,
        )!
        const refreshed = await refreshTokens(
            env,
            { did: DID, credential, now: NOW + 60 },
            world.fetch,
        )
        expect(refreshed.ok).toBe(true)
        const last = world.requests.at(-1)!
        expect(last.form.grant_type).toBe("refresh_token")
        expect(last.form.refresh_token).toBe("REFRESH-TOKEN-VALUE")

        const revoked = await refreshTokens(
            env,
            { did: DID, credential, now: NOW + 60 },
            (async () =>
                new Response(JSON.stringify({ error: "invalid_grant" }), {
                    status: 400,
                })) as unknown as typeof fetch,
        )
        expect(revoked).toEqual({ ok: false, kind: "Expired" })
    })

    test("Workers と同じく this つきの呼び出しを拒む fetch でも、開始・完了・更新が通る", async () => {
        // Workers の fetch は、別のオブジェクトのメソッドとして呼ぶと Illegal invocation になる
        const inner = world.fetch
        world.fetch = function (
            this: unknown,
            ...args: Parameters<typeof fetch>
        ) {
            if (this !== undefined && this !== globalThis)
                throw new TypeError("Illegal invocation")
            return inner(...args)
        } as typeof fetch
        const { state } = await start()
        expect(await complete(state)).toEqual({ ok: true })
        const credential = parseCredential(
            (await loadCredential(db, KEY, DID))!.token,
        )!
        const refreshed = await refreshTokens(
            env,
            { did: DID, credential, now: NOW + 60 },
            world.fetch,
        )
        expect(refreshed.ok).toBe(true)
    })

    test("クライアントのメタデータは、オリジンから識別子・戻り先・鍵の一覧を作り、DPoP と private_key_jwt を宣言する", () => {
        const meta = clientMetadata(ORIGIN, "Skyshare")
        expect(meta).toMatchObject({
            client_id: `${ORIGIN}/oauth/client-metadata.json`,
            redirect_uris: [`${ORIGIN}/oauth/callback/`],
            jwks_uri: `${ORIGIN}/oauth/jwks.json`,
            token_endpoint_auth_method: "private_key_jwt",
            dpop_bound_access_tokens: true,
            grant_types: ["authorization_code", "refresh_token"],
        })
        // 書き込みは予約の実行に必要なコレクションと画像に限る
        expect(meta.scope.split(" ")).toEqual(
            expect.arrayContaining(["atproto", "blob:image/*"]),
        )
        expect(meta.scope).not.toContain("transition:generic")
    })
})
