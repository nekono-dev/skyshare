import { beforeEach, describe, expect, test, vi } from "vitest"
import type { APIContext } from "astro"
import { createFakeD1 } from "../../helpers/fakeD1"
import { createTestClientSecret } from "../../helpers/oauthTestKeys"

const holder = vi.hoisted(() => ({ env: undefined as unknown }))
vi.mock("@/lib/schedule/env", () => ({
    getScheduleEnv: async () => holder.env,
}))
// 認可の開始は外部の認可サーバーへ通信するため、結果だけを差し替える
vi.mock("@/lib/schedule/oauth/flow", async importOriginal => ({
    ...(await importOriginal<typeof import("@/lib/schedule/oauth/flow")>()),
    startAuthorization: async () => ({
        ok: true,
        url: "https://auth.example/oauth/authorize?request_uri=x",
    }),
}))

import { GET as callback } from "@/pages/oauth/callback"
import { POST as start } from "@/pages/v2/schedules/credential/authorization"
import {
    isSafeReturnPath,
    RETURN_PATH_COOKIE,
} from "@/lib/schedule/oauth/returnPath"
import { POST as complete } from "@/pages/v2/schedules/credential/authorization/completion"
import { readAuthorizationFragment } from "@/lib/schedule/oauth/callbackFragment"
import { loadCredential } from "@/lib/schedule/store"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(4)))
const DID = "did:plc:aaaa"
const ORIGIN = "https://skyshare.test"

let db: ReturnType<typeof createFakeD1>
beforeEach(async () => {
    db = createFakeD1()
    holder.env = {
        DB: db,
        SCHEDULE_ENC_KEY: KEY,
        SCHEDULE_OAUTH_KEY: await createTestClientSecret(),
    }
})

const callCallback = (query: string, cookie?: string) =>
    (callback as (c: APIContext) => Response)({
        request: new Request(`${ORIGIN}/oauth/callback/${query}`, {
            headers: cookie ? { cookie } : {},
        }),
        locals: {},
    } as unknown as APIContext)

const callStart = (body: string) =>
    (start as (c: APIContext) => Promise<Response>)({
        request: new Request(
            `${ORIGIN}/v2/schedules/credential/authorization/`,
            { method: "POST", body },
        ),
        locals: { session: { did: DID } },
    } as unknown as APIContext)

const callComplete = (
    body: string,
    locals: object = { session: { did: DID } },
) =>
    (complete as (c: APIContext) => Promise<Response>)({
        request: new Request(
            `${ORIGIN}/v2/schedules/credential/authorization/completion/`,
            { method: "POST", body },
        ),
        locals,
    } as unknown as APIContext)

describe("予約投稿の OAuth の戻り", () => {
    test("schedule-api/AC-22: 戻り先はセッションなしで、既知の項目だけを設定のページのフラグメントへ移して303で転送する", () => {
        const res = callCallback(
            "?code=C1&state=S1&iss=https%3A%2F%2Fpds&extra=x",
        )
        expect(res.status).toBe(303)
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(res.headers.get("referrer-policy")).toBe("no-referrer")
        const to = new URL(res.headers.get("location")!)
        expect(`${to.origin}${to.pathname}`).toBe(`${ORIGIN}/settings/`)
        // 認可コードはクエリに載せない
        expect(to.search).toBe("")
        expect(readAuthorizationFragment(to.hash)).toEqual({
            code: "C1",
            state: "S1",
            iss: "https://pds",
        })
        // 拒否の戻りも、そのまま渡す
        const denied = new URL(
            callCallback("?error=access_denied&state=S2").headers.get(
                "location",
            )!,
        )
        expect(readAuthorizationFragment(denied.hash)).toEqual({
            error: "access_denied",
            state: "S2",
        })
        // 目印の無いフラグメントは戻りとみなさない
        expect(readAuthorizationFragment("#top")).toBeNull()
    })

    test("schedule-api/AC-22: 完了は未ログインで401、不正な本文で400、拒否と不明な state では保存せずに分類を返す", async () => {
        expect((await callComplete("{}", {})).status).toBe(401)
        expect((await callComplete("not json")).status).toBe(400)
        expect((await callComplete('{"code":1}')).status).toBe(400)

        const denied = await callComplete(
            JSON.stringify({ error: "access_denied", state: "S" }),
        )
        expect(denied.status).toBe(200)
        expect(denied.headers.get("cache-control")).toBe("no-store")
        expect(await denied.json()).toEqual({ result: "Denied" })

        const unknown = await callComplete(
            JSON.stringify({ code: "C", state: "S", iss: "https://pds" }),
        )
        expect(await unknown.json()).toEqual({ result: "StateInvalid" })
        expect(await loadCredential(db, KEY, DID)).toBeNull()
    })

    test("schedule-api/AC-24: 開始で渡したページのパスが戻り先だけに送られる cookie に入り、戻るとそのページへ転送されて cookie が消える", async () => {
        const res = await callStart(JSON.stringify({ returnTo: "/post/?a=1" }))
        expect(res.status).toBe(200)
        const cookie = res.headers.get("set-cookie")!
        expect(cookie).toContain(`${RETURN_PATH_COOKIE}=%2Fpost%2F%3Fa%3D1`)
        expect(cookie).toContain("Path=/oauth/callback/")
        expect(cookie).toContain("SameSite=Lax")
        expect(cookie).toContain("HttpOnly")

        const back = callCallback("?code=C&state=S", cookie.split(";")[0])
        const to = new URL(back.headers.get("location")!)
        expect(`${to.origin}${to.pathname}${to.search}`).toBe(
            `${ORIGIN}/post/?a=1`,
        )
        expect(readAuthorizationFragment(to.hash)).toEqual({
            code: "C",
            state: "S",
        })
        expect(back.headers.get("set-cookie")).toContain("Max-Age=0")

        // 本文を省くと設定のページへ戻す
        const plain = await callStart("")
        expect(plain.headers.get("set-cookie")).toContain("%2Fsettings%2F")
    })

    test("schedule-api/AC-24: 別のオリジンへ向かうパスは開始で400になり、cookie にあっても設定のページへ転送する", async () => {
        for (const bad of [
            "https://evil.example/",
            "//evil.example/",
            "/\\evil.example",
            "relative",
            "/a#b",
        ]) {
            expect(isSafeReturnPath(bad)).toBe(false)
            expect(
                (await callStart(JSON.stringify({ returnTo: bad }))).status,
            ).toBe(400)
        }
        expect((await callStart("not json")).status).toBe(400)
        const back = callCallback(
            "?code=C",
            `${RETURN_PATH_COOKIE}=${encodeURIComponent("//evil.example/")}`,
        )
        const to = new URL(back.headers.get("location")!)
        expect(`${to.origin}${to.pathname}`).toBe(`${ORIGIN}/settings/`)
    })
})
