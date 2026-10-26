import { describe, expect, test } from "vitest"
import type { APIContext } from "astro"
import { GET as callback } from "@/pages/oauth/callback"
import { readAuthorizationFragment } from "@/lib/oauth/callbackFragment"
import { returnCookie } from "@/lib/oauth/returnPath"

const ORIGIN = "https://skyshare.test"

const callCallback = (query: string, cookie?: string) =>
    (callback as (c: APIContext) => Response)({
        request: new Request(`${ORIGIN}/oauth/callback/${query}`, {
            headers: cookie ? { cookie } : {},
        }),
        locals: {},
    } as unknown as APIContext)

/** `Set-Cookie` の値から、要求の `Cookie` に入れる部分を取り出す */
const asCookie = (setCookie: string) => setCookie.split(";")[0]!

describe("認可の戻りの受け渡し", () => {
    test("[oauth-client/5.1] ログインの用途で始めた戻りが、そのページのフラグメントへ用途と既知の項目だけを移して転送される", () => {
        const set = returnCookie("session", "/accounts/")
        expect(set).toContain("Path=/oauth/callback/")
        expect(set).toContain("SameSite=Lax")
        expect(set).toContain("HttpOnly")

        const res = callCallback(
            "?code=C1&state=S1&iss=https%3A%2F%2Fbsky.social&extra=x",
            asCookie(set),
        )
        expect(res.status).toBe(303)
        const to = new URL(res.headers.get("location")!)
        expect(`${to.origin}${to.pathname}`).toBe(`${ORIGIN}/accounts/`)
        expect(to.search).toBe("")
        expect(readAuthorizationFragment(to.hash, "session")).toEqual({
            code: "C1",
            state: "S1",
            iss: "https://bsky.social",
        })
        // 別の用途のページは読まない
        expect(readAuthorizationFragment(to.hash, "schedule")).toBeNull()
        expect(res.headers.get("set-cookie")).toContain("Max-Age=0")
    })

    test("[oauth-client/5.2,5.3,5.4] 用途の無い戻りは予約の設定のページへ、別のオリジンへ向かうページの戻りは用途の既定のページへ転送される", () => {
        const none = new URL(callCallback("?code=C").headers.get("location")!)
        expect(none.pathname).toBe("/settings/")
        expect(readAuthorizationFragment(none.hash, "schedule")).toEqual({
            code: "C",
        })

        const unknownPurpose = new URL(
            callCallback(
                "?code=C",
                `oauth_return=${encodeURIComponent("other:/accounts/")}`,
            ).headers.get("location")!,
        )
        expect(unknownPurpose.pathname).toBe("/settings/")

        const evil = new URL(
            callCallback(
                "?code=C",
                `oauth_return=${encodeURIComponent("session://evil.example/")}`,
            ).headers.get("location")!,
        )
        expect(`${evil.origin}${evil.pathname}`).toBe(`${ORIGIN}/login/`)
        // 開始でも、不正なページは用途の既定のページに置き換える
        expect(returnCookie("session", "//evil.example/")).toContain(
            encodeURIComponent("session:/login/"),
        )
    })
})
