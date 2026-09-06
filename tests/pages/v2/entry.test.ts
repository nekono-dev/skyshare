/**
 * `src/pages/v2/entry.ts`(POST/PUT/DELETE /v2/entry)の分岐網羅レベルの統合テスト。
 *
 * 責務と処理概要:
 * - ルートハンドラを直接呼び出し、`locals.agent` に duck-typed なフェイク AtpAgent
 *   （`testSupport/fakeAgent.ts`）を注入することで、実ネットワーク・`@atproto/api`の
 *   モックいずれにも触れずに全分岐（スキーマ検証・atproto呼び出しの成功/失敗）を駆動する。
 * - ルートが呼び出す `src/lib/entry/*` / `src/lib/atproto/*` はモックせず実コードのまま
 *   通す。モックの境界は常に agent（atproto通信の実体）に置く方針（`tests/README.md`参照）。
 */
import { describe, expect, it, vi } from "vitest"
import type { APIContext } from "astro"

import { POST, PUT, DELETE } from "@/pages/v2/entry"
import { createFakeAgent, fakeSession } from "./testSupport/fakeAgent"

const callRoute = (
    handler: typeof POST,
    request: Request,
    locals: Partial<App.Locals> = {},
) => handler({ request, locals } as unknown as APIContext)

const authHeaders = { cookie: "sid=abc123" }

/** 新規画像投稿としてPOSTするための最小限のFormDataを組み立てる。 */
const buildNewImagePostFormData = (opts?: {
    text?: string
    imagesCount?: number
    metaCount?: number
    gate?: object
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
    formData.set("ogImage", new Blob(["thumb"], { type: "image/jpeg" }))
    if (opts?.text) formData.set("text", opts.text)
    if (opts?.gate) formData.set("gate", JSON.stringify(opts.gate))
    return formData
}

/** 既存投稿からの発行(from-post)としてPOSTするための最小限のFormDataを組み立てる。 */
const buildFromPostFormData = (uri: string) => {
    const formData = new FormData()
    formData.set("uri", uri)
    formData.set("ogImage", new Blob(["thumb"], { type: "image/jpeg" }))
    return formData
}

describe("POST /v2/entry", () => {
    it("cookieヘッダーが無い場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "POST",
            body: new FormData(),
        })
        const res = await callRoute(POST, request)
        expect(res.status).toBe(400)
    })

    it("cookieヘッダーはあるがセッション未確立の場合は401を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "POST",
            headers: authHeaders,
            body: buildFromPostFormData(
                "at://did:plc:abc/app.bsky.feed.post/3lxyz",
            ),
        })
        const res = await callRoute(POST, request, {})
        expect(res.status).toBe(401)
    })

    it("Content-Typeがmultipartでない場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "POST",
            headers: { ...authHeaders, "content-type": "application/json" },
            body: JSON.stringify({}),
        })
        const res = await callRoute(POST, request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(400)
    })

    it("FormDataとして解釈できないbodyの場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "POST",
            headers: {
                ...authHeaders,
                "content-type": "multipart/form-data; boundary=----x",
            },
            body: "not-a-valid-multipart-body",
        })
        const res = await callRoute(POST, request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(400)
    })

    it("スキーマ不正(uri無し・images無し)の場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "POST",
            headers: authHeaders,
            body: new FormData(),
        })
        const res = await callRoute(POST, request, {
            agent: createFakeAgent(),
            session: fakeSession,
        })
        expect(res.status).toBe(400)
    })

    describe("uri指定時(from-post)", () => {
        const postUri = "at://did:plc:author/app.bsky.feed.post/3lpost"

        it("所有者不一致のuriなら400を返す", async () => {
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildFromPostFormData(
                        "at://did:plc:other/app.bsky.feed.post/3lpost",
                    ),
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent(),
                session: fakeSession,
            })
            expect(res.status).toBe(400)
        })

        it("対象投稿が見つからない場合は404を返す", async () => {
            const agent = createFakeAgent({
                com: {
                    atproto: {
                        repo: {
                            getRecord: vi
                                .fn()
                                .mockRejectedValue(new Error("not found")),
                        },
                    },
                },
            })
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildFromPostFormData(postUri),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(404)
        })

        it("成功時は200でbsky/skyshare情報を返す", async () => {
            const agent = createFakeAgent()
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildFromPostFormData(postUri),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(200)
            const json = await res.json()
            expect(json.bsky.url).toContain(fakeSession.handle)
            expect(json.skyshare.sourceUri).toBe(postUri)
        })
    })

    describe("新規画像投稿", () => {
        it("画像枚数とメタデータ件数が不一致なら400を返す", async () => {
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData({
                        imagesCount: 2,
                        metaCount: 1,
                    }),
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent(),
                session: fakeSession,
            })
            expect(res.status).toBe(400)
        })

        it("画像アップロード失敗時は500を返す", async () => {
            const agent = createFakeAgent({
                uploadBlob: vi
                    .fn()
                    .mockRejectedValue(new Error("upload failed")),
            })
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData(),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(500)
        })

        it("ogImageアップロード失敗時は500を返す", async () => {
            let callCount = 0
            const agent = createFakeAgent({
                uploadBlob: vi.fn().mockImplementation(async () => {
                    callCount++
                    if (callCount > 1) throw new Error("og upload failed")
                    return { data: { blob: { $type: "blob", ref: "x" } } }
                }),
            })
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData({ imagesCount: 1 }),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(500)
        })

        it("bsky投稿作成失敗時は500を返す", async () => {
            const agent = createFakeAgent({
                post: vi.fn().mockRejectedValue(new Error("post failed")),
            })
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData(),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(500)
        })

        it("gate適用が失敗してもgateWarning:trueとして200を返す", async () => {
            const agent = createFakeAgent({
                com: {
                    atproto: {
                        repo: {
                            createRecord: vi
                                .fn()
                                .mockImplementation(
                                    async ({
                                        collection,
                                    }: {
                                        collection: string
                                    }) => {
                                        if (
                                            collection ===
                                            "dev.nekono.skyshare.entry"
                                        ) {
                                            return {
                                                data: {
                                                    uri: "at://did:plc:author/dev.nekono.skyshare.entry/3lentry",
                                                    cid: "bafyentrycid",
                                                },
                                            }
                                        }
                                        throw new Error("gate create failed")
                                    },
                                ),
                        },
                    },
                },
            })
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData({
                        gate: {
                            replyAudience: "nobody",
                            allowMentioned: false,
                            allowFollower: false,
                            allowFollowing: false,
                            listUris: [],
                            allowQuote: true,
                        },
                    }),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(200)
            const json = await res.json()
            expect(json.bsky.gateWarning).toBe(true)
        })

        it("skyshare entry作成失敗時は500を返す", async () => {
            const agent = createFakeAgent({
                com: {
                    atproto: {
                        repo: {
                            createRecord: vi
                                .fn()
                                .mockRejectedValue(
                                    new Error("entry create failed"),
                                ),
                        },
                    },
                },
            })
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData(),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(500)
        })

        it("成功時は200でbsky/skyshare情報を返す", async () => {
            const agent = createFakeAgent()
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData({ text: "hello" }),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(200)
            const json = await res.json()
            expect(json.bsky.gateWarning).toBeFalsy()
            expect(json.skyshare.uri).toBeDefined()
        })
    })
})

const authenticatedLocals = () => ({
    agent: createFakeAgent(),
    session: fakeSession,
})

describe("PUT /v2/entry", () => {
    it("cookieヘッダーが無い場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                uri: "at://did:plc:author/dev.nekono.skyshare.entry/3lentry",
                heading: "旅行",
                caption: "京都にて",
            }),
        })
        const res = await callRoute(PUT, request)
        expect(res.status).toBe(400)
    })

    it("未認証の場合は401を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "PUT",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                uri: "at://did:plc:author/dev.nekono.skyshare.entry/3lentry",
                heading: "旅行",
                caption: "京都にて",
            }),
        })
        const res = await callRoute(PUT, request, {})
        expect(res.status).toBe(401)
    })

    it("JSONとして解釈できないbodyの場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "PUT",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: "not-json",
        })
        const res = await callRoute(PUT, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("bodyがスキーマ不正(uri欠落)の場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "PUT",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({ heading: "旅行", caption: "京都にて" }),
        })
        const res = await callRoute(PUT, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("uriが自分自身のdev.nekono.skyshare.entryでない場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "PUT",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                uri: "at://did:plc:other/dev.nekono.skyshare.entry/3lentry",
                heading: "旅行",
                caption: "京都にて",
            }),
        })
        const res = await callRoute(PUT, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("対象entryが見つからない場合は404を返す", async () => {
        const agent = createFakeAgent({
            com: {
                atproto: {
                    repo: {
                        getRecord: vi.fn().mockRejectedValue(
                            Object.assign(new Error("RecordNotFound"), {
                                error: "RecordNotFound",
                            }),
                        ),
                    },
                },
            },
        })
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "PUT",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                uri: "at://did:plc:author/dev.nekono.skyshare.entry/3lentry",
                heading: "旅行",
                caption: "京都にて",
            }),
        })
        const res = await callRoute(PUT, request, {
            agent,
            session: fakeSession,
        })
        expect(res.status).toBe(404)
    })

    it("成功時は200(本文なし)を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "PUT",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                uri: "at://did:plc:author/dev.nekono.skyshare.entry/3lentry",
                heading: "旅行",
                caption: "京都にて",
            }),
        })
        const res = await callRoute(PUT, request, authenticatedLocals())
        expect(res.status).toBe(200)
    })
})

describe("DELETE /v2/entry", () => {
    const entryUri = "at://did:plc:author/dev.nekono.skyshare.entry/3lentry"

    it("cookieヘッダーが無い場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ uri: entryUri }),
        })
        const res = await callRoute(DELETE, request)
        expect(res.status).toBe(400)
    })

    it("未認証の場合は401を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "DELETE",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({ uri: entryUri }),
        })
        const res = await callRoute(DELETE, request, {})
        expect(res.status).toBe(401)
    })

    it("JSONとして解釈できないbodyの場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "DELETE",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: "not-json",
        })
        const res = await callRoute(DELETE, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("bodyがスキーマ不正(uri欠落)の場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "DELETE",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({ deleteBskyPost: true }),
        })
        const res = await callRoute(DELETE, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("uriが自分自身のdev.nekono.skyshare.entryでない場合は400を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "DELETE",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                uri: "at://did:plc:other/dev.nekono.skyshare.entry/3lentry",
            }),
        })
        const res = await callRoute(DELETE, request, authenticatedLocals())
        expect(res.status).toBe(400)
    })

    it("deleteBskyPost指定時、entryが見つからない場合は404を返す", async () => {
        const agent = createFakeAgent({
            com: {
                atproto: {
                    repo: {
                        getRecord: vi
                            .fn()
                            .mockRejectedValue(new Error("not found")),
                    },
                },
            },
        })
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "DELETE",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({ uri: entryUri, deleteBskyPost: true }),
        })
        const res = await callRoute(DELETE, request, {
            agent,
            session: fakeSession,
        })
        expect(res.status).toBe(404)
    })

    it("deleteBskyPost指定時、元投稿の削除に失敗してもentry削除自体は200を返す", async () => {
        const agent = createFakeAgent({
            com: {
                atproto: {
                    repo: {
                        deleteRecord: vi
                            .fn()
                            .mockImplementation(
                                async ({
                                    collection,
                                }: {
                                    collection: string
                                }) => {
                                    if (collection === "app.bsky.feed.post") {
                                        throw new Error("delete failed")
                                    }
                                    return {}
                                },
                            ),
                    },
                },
            },
        })
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "DELETE",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({ uri: entryUri, deleteBskyPost: true }),
        })
        const res = await callRoute(DELETE, request, {
            agent,
            session: fakeSession,
        })
        expect(res.status).toBe(200)
    })

    it("deleteBskyPost=falseの場合は元投稿を削除せず200を返す", async () => {
        const deleteRecord = vi.fn().mockResolvedValue({})
        const agent = createFakeAgent({
            com: { atproto: { repo: { deleteRecord } } },
        })
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "DELETE",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({ uri: entryUri, deleteBskyPost: false }),
        })
        const res = await callRoute(DELETE, request, {
            agent,
            session: fakeSession,
        })
        expect(res.status).toBe(200)
        expect(deleteRecord).toHaveBeenCalledTimes(1)
    })

    it("成功時(deleteBskyPost:true)は200(本文なし)を返す", async () => {
        const request = new Request("https://skyshare.nekono.dev/v2/entry/", {
            method: "DELETE",
            headers: {
                ...authHeaders,
                "content-type": "application/json",
            },
            body: JSON.stringify({ uri: entryUri, deleteBskyPost: true }),
        })
        const res = await callRoute(DELETE, request, authenticatedLocals())
        expect(res.status).toBe(200)
    })
})
