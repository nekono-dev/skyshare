import { afterEach, describe, expect, it, vi } from "vitest"

import {
    GUEST_MODE_QUERY_KEY,
    isGuestModeRequested,
    withGuestModeQuery,
} from "@/lib/guestMode"

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("isGuestModeRequested", () => {
    it("[app-navigation/1.1] URLに guest のクエリが付いているとき、true を返す", () => {
        vi.stubGlobal("window", { location: { search: "?guest=1" } })
        expect(isGuestModeRequested()).toBe(true)
        expect(GUEST_MODE_QUERY_KEY).toBe("guest")
    })

    it("[app-navigation/1.2] guest のクエリが無いとき、またはブラウザが無いとき、false を返す", () => {
        vi.stubGlobal("window", { location: { search: "?other=1" } })
        expect(isGuestModeRequested()).toBe(false)
        vi.unstubAllGlobals()
        expect(isGuestModeRequested()).toBe(false)
    })
})

describe("withGuestModeQuery", () => {
    it("[app-navigation/1.3] ゲスト表示中は、リンクに guest のクエリを付与する", () => {
        expect(withGuestModeQuery("/entries/", true)).toBe("/entries/?guest=1")
        expect(withGuestModeQuery("/a/?x=1", true)).toBe("/a/?x=1&guest=1")
    })

    it("[app-navigation/1.4] ゲスト表示でないときは、リンクをそのまま返す", () => {
        expect(withGuestModeQuery("/entries/", false)).toBe("/entries/")
    })
})
