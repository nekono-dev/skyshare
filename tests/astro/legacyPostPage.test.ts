/**
 * 旧形式の投稿の表示ページ（`/posts/{dbIndex}/{slug}`）の描画テスト。
 *
 * 責務と処理概要:
 * - 識別子の形式が不正なとき、旧バックエンドへ問い合わせずに404で応答することを確認する。
 * - 形式が正しい識別子は旧バックエンドへ問い合わせることを、不正な場合との対照として確認する。
 * - 種別を省略したURLは別ページが書き換えで本ページへ渡すため、描画では扱えず、`tests/e2e/legacyPostPage.spec.ts` で確認する。
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import reactRenderer from "@astrojs/react/server.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/legacy/pagedb", () => ({
    fetchPageDbEntry: vi.fn(),
}))

import { fetchPageDbEntry } from "@/lib/legacy/pagedb"
import LegacyPostPage from "@/pages/posts/[dbIndex]/[slug].astro"

const mockedFetch = vi.mocked(fetchPageDbEntry)

/** ページを描画して、応答を返す。 */
const request = async (params: { dbIndex?: string; slug?: string }) => {
    const container = await AstroContainer.create()
    container.addServerRenderer({
        name: "@astrojs/react",
        renderer: reactRenderer,
    })
    return container.renderToResponse(LegacyPostPage, {
        params,
        request: new Request("https://skyshare.test/posts/x"),
        locals: { locale: "ja" } as never,
    })
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe("旧形式の投稿の表示ページ", () => {
    it("[legacy-page/1.3] 種別が数字でも旧形式でもないURLは、旧バックエンドへ問い合わせず404を返す", async () => {
        const res = await request({ dbIndex: "abc", slug: "someone@3abc" })
        expect(res.status).toBe(404)
        expect(mockedFetch).not.toHaveBeenCalled()
    })

    it("[legacy-page/1.3] キーに区切りが無いURLは、旧バックエンドへ問い合わせず404を返し、不正な識別子の旨を表示する", async () => {
        const res = await request({ dbIndex: "legacy", slug: "no-separator" })
        expect(res.status).toBe(404)
        expect(mockedFetch).not.toHaveBeenCalled()
        expect(await res.text()).toContain("Invalid post identifier")
    })

    it("形式が正しい識別子は、旧バックエンドへ問い合わせる（不正な場合との対照）", async () => {
        mockedFetch.mockResolvedValue({ error: "BadRequest" } as never)
        const res = await request({ dbIndex: "3", slug: "did:plc:abc@3abc" })
        expect(mockedFetch).toHaveBeenCalledWith({
            dbIndex: "3",
            dbKey: "did:plc:abc@3abc",
        })
        expect(res.status).toBe(404)
    })
})
