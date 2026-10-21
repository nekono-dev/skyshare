import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/client/openapi/client", () => ({
    getSession: vi.fn(),
}))

import { getSession } from "@/client/openapi/client"
import {
    clearKnownUnauthenticated,
    getSessionOnce,
    resetActiveAccountInfoCache,
} from "@/lib/account/activeAccountSession"

const mockedGetSession = vi.mocked(getSession)

// sessionStorage の最小の代替（Node 環境には window が無いため）
const stubWindow = () => {
    const store = new Map<string, string>()
    vi.stubGlobal("window", {
        sessionStorage: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => void store.set(k, v),
            removeItem: (k: string) => void store.delete(k),
        },
    })
}

describe("getSessionOnce", () => {
    beforeEach(() => {
        stubWindow()
        resetActiveAccountInfoCache()
    })
    afterEach(() => {
        clearKnownUnauthenticated()
        resetActiveAccountInfoCache()
        mockedGetSession.mockReset()
        vi.unstubAllGlobals()
    })

    it("[account-session/AC-16] 同時に2回取得すると実際のリクエストは1回になる", async () => {
        mockedGetSession.mockResolvedValue({
            status: 200,
            data: { accounts: [] },
            headers: new Headers(),
        } as any)
        const [a, b] = await Promise.all([getSessionOnce(), getSessionOnce()])
        expect(a).toBe(b)
        expect(mockedGetSession).toHaveBeenCalledTimes(1)
    })

    it("[account-session/AC-16] 401 を受けた後は、リクエストを送らずに 401 を返す", async () => {
        mockedGetSession.mockResolvedValue({
            status: 401,
            data: { error: "x" },
            headers: new Headers(),
        } as any)
        await getSessionOnce()
        resetActiveAccountInfoCache()
        const res = await getSessionOnce()
        expect(res.status).toBe(401)
        expect(mockedGetSession).toHaveBeenCalledTimes(1)
    })
})
