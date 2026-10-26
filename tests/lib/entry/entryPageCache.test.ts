import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
    ENTRY_PAGE_CACHE_HEADER,
    ENTRY_PAGE_CACHE_TTL_SECONDS,
    entryPageCache,
    entryPageCacheKey,
    isEntryDetailPath,
} from "@/lib/entry/entryPageCache"

/** Cache API の最小フェイク。キー（URL）→ 保存した応答 */
const createFakeCache = () => {
    const store = new Map<string, Response>()
    return {
        store,
        match: vi.fn(async (req: Request) => store.get(req.url)?.clone()),
        put: vi.fn(async (req: Request, res: Response) => {
            store.set(req.url, res.clone())
        }),
    }
}

const entryUrl = "https://skyshare.nekono.dev/entries/did:plc:abc@3k/"

const createContext = (
    options: {
        url?: string
        method?: string
        locale?: string
        isPrerendered?: boolean
    } = {},
) => {
    const waitUntil = vi.fn()
    const url = new URL(options.url ?? entryUrl)
    return {
        waitUntil,
        context: {
            request: new Request(url, { method: options.method ?? "GET" }),
            url,
            isPrerendered: options.isPrerendered ?? false,
            locals: {
                locale: options.locale ?? "ja",
                cfContext: { waitUntil },
            },
        } as never,
    }
}

/** ミドルウェアを実行して Response を返す（戻り値の `void` を型から除く） */
const run = async (
    context: ReturnType<typeof createContext>["context"],
    next: () => Promise<Response>,
): Promise<Response> => {
    const res = await entryPageCache(context, next)
    if (!res) throw new Error("ミドルウェアが Response を返さなかった")
    return res
}

const htmlResponse = (init?: ResponseInit) =>
    new Response("<html>entry</html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        ...init,
    })

describe("isEntryDetailPath", () => {
    it("/entries/{slug}/ は対象", () => {
        expect(isEntryDetailPath("/entries/did:plc:abc@3k/")).toBe(true)
    })

    it("一覧・末尾スラッシュ無し・下位パスは対象外", () => {
        expect(isEntryDetailPath("/entries/")).toBe(false)
        expect(isEntryDetailPath("/entries/did:plc:abc@3k")).toBe(false)
        expect(isEntryDetailPath("/entries/did:plc:abc@3k/favicon.svg")).toBe(
            false,
        )
        expect(isEntryDetailPath("/v2/entries/")).toBe(false)
    })
})

describe("entryPageCacheKey", () => {
    it("クエリを除き、言語ごとに別のキーになる", () => {
        const ja = entryPageCacheKey(new URL(`${entryUrl}?utm=1`), "ja")
        const en = entryPageCacheKey(new URL(entryUrl), "en")
        expect(ja.url).toBe(`${entryUrl}?locale=ja`)
        expect(en.url).not.toBe(ja.url)
    })
})

describe("[entry-detail/5.3,5.4] entryPageCache", () => {
    let cache: ReturnType<typeof createFakeCache>

    beforeEach(() => {
        cache = createFakeCache()
        vi.stubGlobal("caches", { default: cache })
        vi.spyOn(console, "warn").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it("未保存なら描画して MISS を返し、waitUntil で保存する", async () => {
        const { context, waitUntil } = createContext()
        const next = vi.fn(async () => htmlResponse())

        const res = await run(context, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(res.headers.get(ENTRY_PAGE_CACHE_HEADER)).toBe("MISS")
        expect(await res.text()).toBe("<html>entry</html>")
        expect(waitUntil).toHaveBeenCalledTimes(1)
        await waitUntil.mock.calls[0][0]
        const stored = cache.store.get(`${entryUrl}?locale=ja`)
        expect(stored?.headers.get("cache-control")).toBe(
            `public, max-age=${ENTRY_PAGE_CACHE_TTL_SECONDS}`,
        )
    })

    it("保存済みなら後続を呼ばずに HIT を返す", async () => {
        const first = createContext()
        await run(first.context, async () => htmlResponse())
        await first.waitUntil.mock.calls[0][0]

        const second = createContext()
        const next = vi.fn(async () => htmlResponse())
        const res = await run(second.context, next)

        expect(next).not.toHaveBeenCalled()
        expect(res.headers.get(ENTRY_PAGE_CACHE_HEADER)).toBe("HIT")
        expect(res.headers.has("cache-control")).toBe(false)
        expect(await res.text()).toBe("<html>entry</html>")
    })

    it("表示言語が違えば別のページとして扱う", async () => {
        const ja = createContext({ locale: "ja" })
        await run(ja.context, async () => htmlResponse())
        await ja.waitUntil.mock.calls[0][0]

        const en = createContext({ locale: "en" })
        const next = vi.fn(async () => htmlResponse())
        const res = await run(en.context, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(res.headers.get(ENTRY_PAGE_CACHE_HEADER)).toBe("MISS")
    })

    it.each([
        ["404", htmlResponse({ status: 404 })],
        ["500", htmlResponse({ status: 500 })],
        [
            "Set-Cookie 付き",
            htmlResponse({
                headers: {
                    "content-type": "text/html",
                    "set-cookie": "a=b",
                },
            }),
        ],
        [
            "HTML 以外",
            new Response("{}", {
                headers: { "content-type": "application/json" },
            }),
        ],
    ])("%s の応答は保存しない", async (_label, response) => {
        const { context, waitUntil } = createContext()

        const res = await run(context, async () => response)

        expect(res).toBe(response)
        expect(cache.put).not.toHaveBeenCalled()
        expect(waitUntil).not.toHaveBeenCalled()
    })

    it.each([
        ["GET 以外", { method: "HEAD" }],
        ["対象外パス", { url: "https://skyshare.nekono.dev/entries/" }],
        ["事前描画ページ", { isPrerendered: true }],
    ])("%s は素通しする", async (_label, options) => {
        const { context } = createContext(options)
        const response = htmlResponse()

        const res = await run(context, async () => response)

        expect(res).toBe(response)
        expect(cache.match).not.toHaveBeenCalled()
    })

    it("Cache API が無い環境（workers.dev 等）では素通しする", async () => {
        vi.stubGlobal("caches", undefined)
        const { context } = createContext()
        const response = htmlResponse()

        const res = await run(context, async () => response)

        expect(res).toBe(response)
    })

    it("Cache API の失敗はページ表示を妨げず、通常描画にフォールバックする", async () => {
        cache.match.mockRejectedValueOnce(new Error("boom"))
        cache.put.mockRejectedValueOnce(new Error("boom"))
        const { context, waitUntil } = createContext()

        const res = await run(context, async () => htmlResponse())

        expect(res.status).toBe(200)
        expect(await res.text()).toBe("<html>entry</html>")
        await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined()
    })
})
