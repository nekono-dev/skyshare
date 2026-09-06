/**
 * `src/pages/v2/bsky/record.ts`(POST /v2/bsky/record)の分岐網羅レベルのテスト。
 */
import { describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"

import { POST } from "@/pages/v2/bsky/record"
import { createFakeAgent, fakeSession } from "../testSupport/fakeAgent"

const callRoute = (request: Request, locals: Partial<App.Locals> = {}) =>
    POST({ request, locals } as unknown as APIContext)

const authHeaders = { cookie: "sid=abc123" }

const buildTextOnlyFormData = (text: string) => {
    const formData = new FormData()
    formData.set("text", text)
    return formData
}

const buildOgpFormData = (opts?: { url?: string; text?: string }) => {
    const formData = new FormData()
    if (opts?.text) formData.set("text", opts.text)
    formData.set("ogImage", new Blob(["thumb"], { type: "image/jpeg" }))
    formData.set(
        "ogMeta",
        JSON.stringify({
            title: "Example",
            description: "desc",
            url: opts?.url ?? "https://example.com/article",
        }),
    )
    return formData
}

const buildImagePostFormData = (opts?: {
    imagesCount?: number
    metaCount?: number
}) => {
    const formData = new FormData()
    const imagesCount = opts?.imagesCount ?? 1
    for (let i = 0; i < imagesCount; i++) {
        formData.append("images", new Blob([`img${i}`], { type: "image/png" }))
    }
    const metaCount = opts?.metaCount ?? imagesCount
    formData.set(
        "imagesMeta",
        JSON.stringify(
            Array.from({ length: metaCount }, () => ({
                width: 100,
                height: 100,
            })),
        ),
    )
    return formData
}

describe("POST /v2/bsky/record", () => {
    it("cookieヘッダーが無い場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            { method: "POST", body: new FormData() },
        )
        const res = await callRoute(request)
        expect(res.status).toBe(400)
    })

    it("未認証の場合は401を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: authHeaders,
                body: buildTextOnlyFormData("hello"),
            },
        )
        const res = await callRoute(request, {})
        expect(res.status).toBe(401)
    })

    it("Content-Typeがmultipartでない場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: { ...authHeaders, "content-type": "application/json" },
                body: JSON.stringify({}),
            },
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(400)
    })

    it("FormDataとして解釈できないbodyの場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: {
                    ...authHeaders,
                    "content-type": "multipart/form-data; boundary=----x",
                },
                body: "not-a-valid-multipart-body",
            },
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(400)
    })

    it("スキーマ不正(textもimagesもogMetaも無し)の場合は400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            { method: "POST", headers: authHeaders, body: new FormData() },
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(400)
    })

    it("画像枚数とメタデータ件数が不一致なら400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: authHeaders,
                body: buildImagePostFormData({ imagesCount: 2, metaCount: 1 }),
            },
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(400)
    })

    it("テキストのみの投稿は成功時に200でembed無しの結果を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: authHeaders,
                body: buildTextOnlyFormData("hello world"),
            },
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.url).toContain(fakeSession.handle)
        expect(json.uri).toBeDefined()
    })

    it("画像アップロード失敗時は500を返す", async () => {
        const agent = createFakeAgent({
            uploadBlob: vi.fn().mockRejectedValue(new Error("upload failed")),
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: authHeaders,
                body: buildImagePostFormData(),
            },
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(500)
    })

    it("画像投稿は成功時に200を返す(images優先でembedが組まれる)", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: authHeaders,
                body: buildImagePostFormData({ imagesCount: 2 }),
            },
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(200)
    })

    it("ogImageアップロード失敗時は500を返す", async () => {
        const agent = createFakeAgent({
            uploadBlob: vi
                .fn()
                .mockRejectedValue(new Error("og upload failed")),
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: authHeaders,
                body: buildOgpFormData(),
            },
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(500)
    })

    it("ogMeta.urlが空の場合はcreateExternalEmbedが失敗し400を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: authHeaders,
                body: buildOgpFormData({ url: "" }),
            },
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(400)
    })

    it("OGPリンク投稿は成功時に200を返す", async () => {
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: authHeaders,
                body: buildOgpFormData({ text: "リンクだよ" }),
            },
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(200)
    })

    it("bsky投稿作成失敗時は500を返す", async () => {
        const agent = createFakeAgent({
            post: vi.fn().mockRejectedValue(new Error("post failed")),
        })
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            {
                method: "POST",
                headers: authHeaders,
                body: buildTextOnlyFormData("hello"),
            },
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(500)
    })

    it("gate適用が失敗してもgateWarning:trueとして200を返す", async () => {
        const agent = createFakeAgent({
            com: {
                atproto: {
                    repo: {
                        createRecord: vi
                            .fn()
                            .mockRejectedValue(new Error("gate create failed")),
                    },
                },
            },
        })
        const formData = buildTextOnlyFormData("hello")
        formData.set(
            "gate",
            JSON.stringify({
                replyAudience: "nobody",
                allowMentioned: false,
                allowFollower: false,
                allowFollowing: false,
                listUris: [],
                allowQuote: true,
            }),
        )
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            { method: "POST", headers: authHeaders, body: formData },
        )
        const res = await callRoute(request, { agent, session: fakeSession })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.gateWarning).toBe(true)
    })

    it("gateが完全デフォルト(everyone+allowQuote:true)ならgateWarning:falseで200を返す", async () => {
        const formData = buildTextOnlyFormData("hello")
        formData.set(
            "gate",
            JSON.stringify({
                replyAudience: "everyone",
                allowMentioned: false,
                allowFollower: false,
                allowFollowing: false,
                listUris: [],
                allowQuote: true,
            }),
        )
        const request = new Request(
            "https://skyshare.nekono.dev/v2/bsky/record/",
            { method: "POST", headers: authHeaders, body: formData },
        )
        const res = await callRoute(request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(200)
        const json = await res.json()
        expect(json.gateWarning).toBeFalsy()
    })
})
