/**
 * 表示言語の決定ミドルウェア（`src/lib/i18n/middleware.ts`）のテスト。
 */
import type { APIContext } from "astro"
import { describe, expect, it } from "vitest"

import { localeMiddleware } from "@/lib/i18n/middleware"

type TestContext = {
    request: Request
    isPrerendered: boolean
    locals: { locale?: string }
}

const contextOf = (acceptLanguage: string, isPrerendered = false) =>
    ({
        request: new Request("https://skyshare.test/", {
            headers: { "accept-language": acceptLanguage },
        }),
        isPrerendered,
        locals: {},
    }) as TestContext

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe("localeMiddleware", () => {
    it("[i18n-locale/4.2] 受け入れ言語が異なる2件のリクエストを並行して処理しても、それぞれの言語で描画される", async () => {
        const seen: Record<string, string | undefined> = {}
        const handle = async (
            name: string,
            acceptLanguage: string,
            ms: number,
        ) => {
            const context = contextOf(acceptLanguage)
            // 後続の処理で待たされる間に、別のリクエストの処理が割り込む
            await localeMiddleware(
                context as unknown as APIContext,
                async () => {
                    await delay(ms)
                    seen[name] = context.locals.locale
                    return new Response("ok")
                },
            )
        }
        await Promise.all([
            handle("first", "en", 20),
            handle("second", "ja", 5),
            handle("third", "en", 1),
        ])
        expect(seen).toEqual({ first: "en", second: "ja", third: "en" })
    })

    it("[i18n-locale/4.3] 静的生成するページは、受け入れ言語が英語でも日本語を設定する", async () => {
        const context = contextOf("en", true)
        await localeMiddleware(
            context as unknown as APIContext,
            async () => new Response("ok"),
        )
        expect(context.locals.locale).toBe("ja")
    })

    it("受け入れ言語が英語のリクエストには英語を設定する", async () => {
        const context = contextOf("en-US,en;q=0.9")
        await localeMiddleware(
            context as unknown as APIContext,
            async () => new Response("ok"),
        )
        expect(context.locals.locale).toBe("en")
    })
})
