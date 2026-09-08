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

/** 新規画像投稿(posts[0])としてPOSTするための最小限のFormDataを組み立てる。 */
const buildNewImagePostFormData = (opts?: {
    text?: string
    facets?: object[]
    imagesCount?: number
    metaCount?: number
    gate?: object
    reply?: object
    createEntry?: boolean
}) => {
    const formData = new FormData()
    const imagesCount = opts?.imagesCount ?? 1
    for (let i = 0; i < imagesCount; i++) {
        formData.append(
            "posts[0][images]",
            new Blob([`img${i}`], { type: "image/png" }),
        )
    }
    const metaCount = opts?.metaCount ?? imagesCount
    formData.set(
        "posts[0][imagesMeta]",
        JSON.stringify(
            Array.from({ length: metaCount }, () => ({
                width: 100,
                height: 100,
            })),
        ),
    )
    formData.set(
        "posts[0][ogImage]",
        new Blob(["thumb"], { type: "image/jpeg" }),
    )
    if (opts?.text) formData.set("posts[0][text]", opts.text)
    if (opts?.facets)
        formData.set("posts[0][facets]", JSON.stringify(opts.facets))
    if (opts?.gate) formData.set("posts[0][gate]", JSON.stringify(opts.gate))
    if (opts?.reply) formData.set("reply", JSON.stringify(opts.reply))
    if (opts?.createEntry) formData.set("posts[0][createEntry]", "true")
    return formData
}

/** テキストのみの投稿(posts[0])としてPOSTするための最小限のFormDataを組み立てる。 */
const buildTextPostFormData = (opts?: { text?: string; reply?: object }) => {
    const formData = new FormData()
    formData.set("posts[0][text]", opts?.text ?? "hello")
    if (opts?.reply) formData.set("reply", JSON.stringify(opts.reply))
    return formData
}

/** 既存投稿からの発行(from-post)としてPOSTするための最小限のFormDataを組み立てる。 */
const buildFromPostFormData = (uri: string) => {
    const formData = new FormData()
    formData.set("uri", uri)
    formData.set("ogImage", new Blob(["thumb"], { type: "image/jpeg" }))
    return formData
}

type PostItemOpts = {
    text?: string
    imagesCount?: number
    imagesMeta?: { width: number; height: number; alt?: string }[]
    ogImage?: boolean
    ogMeta?: {
        title: string
        description: string
        url: string
        image?: string
    }
    facets?: object[]
    gate?: object
    createEntry?: boolean
}

/** 複数件(スレッド)のposts[i][...]フォームフィールドを組み立てる。 */
const buildThreadFormData = (
    items: PostItemOpts[],
    opts?: { reply?: object },
) => {
    const formData = new FormData()
    items.forEach((item, i) => {
        if (item.text !== undefined)
            formData.set(`posts[${i}][text]`, item.text)
        const imagesCount = item.imagesCount ?? 0
        for (let n = 0; n < imagesCount; n++) {
            formData.append(
                `posts[${i}][images]`,
                new Blob([`img${i}-${n}`], { type: "image/png" }),
            )
        }
        if (item.imagesMeta) {
            formData.set(
                `posts[${i}][imagesMeta]`,
                JSON.stringify(item.imagesMeta),
            )
        } else if (imagesCount > 0) {
            formData.set(
                `posts[${i}][imagesMeta]`,
                JSON.stringify(
                    Array.from({ length: imagesCount }, () => ({
                        width: 100,
                        height: 100,
                    })),
                ),
            )
        }
        if (item.ogImage) {
            formData.set(
                `posts[${i}][ogImage]`,
                new Blob([`og${i}`], { type: "image/jpeg" }),
            )
        }
        if (item.ogMeta)
            formData.set(`posts[${i}][ogMeta]`, JSON.stringify(item.ogMeta))
        if (item.facets)
            formData.set(`posts[${i}][facets]`, JSON.stringify(item.facets))
        if (item.gate)
            formData.set(`posts[${i}][gate]`, JSON.stringify(item.gate))
        if (item.createEntry) formData.set(`posts[${i}][createEntry]`, "true")
    })
    if (opts?.reply) formData.set("reply", JSON.stringify(opts.reply))
    return formData
}

type ThreadWrite = {
    collection: string
    rkey: string
    value: Record<string, any> & { text?: string }
}

/** `writes`配列から、指定テキストを持つapp.bsky.feed.postのwriteを探す。 */
const findPostWrite = (writes: ThreadWrite[], text: string): ThreadWrite => {
    const found = writes.find(
        w => w.collection === "app.bsky.feed.post" && w.value?.text === text,
    )
    if (!found) throw new Error(`post write not found for text: ${text}`)
    return found
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
            expect(json.posts[0].url).toContain(fakeSession.handle)
            expect(json.posts[0].skyshareEntry.sourceUri).toBe(postUri)
        })
    })

    describe("新規投稿(posts)", () => {
        it("createEntry:trueなのに画像が無い場合は400を返す", async () => {
            const formData = buildTextPostFormData()
            formData.set("posts[0][createEntry]", "true")
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: formData,
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent(),
                session: fakeSession,
            })
            expect(res.status).toBe(400)
        })

        it("画像枚数とメタデータ件数が不一致なら400を返す", async () => {
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData({
                        imagesCount: 2,
                        metaCount: 1,
                        createEntry: true,
                    }),
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent(),
                session: fakeSession,
            })
            expect(res.status).toBe(400)
        })

        it("createEntry:trueで画像はあるがogImageが無い場合は400を返す", async () => {
            const formData = buildThreadFormData([
                {
                    text: "hello",
                    imagesCount: 2,
                    createEntry: true,
                },
            ])
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: formData,
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent(),
                session: fakeSession,
            })
            expect(res.status).toBe(400)
        })

        it("OGPリンクカードのみ(画像無し)の投稿は200でexternal embedになる", async () => {
            const applyWrites = vi.fn().mockResolvedValue({
                data: {
                    results: [
                        {
                            uri: "at://did:plc:author/app.bsky.feed.post/3lpost",
                            cid: "bafypostcid",
                        },
                    ],
                },
            })
            const ogMeta = {
                title: "Example",
                description: "example description",
                url: "https://example.com",
            }
            const formData = buildThreadFormData([
                { text: "見て https://example.com", ogImage: true, ogMeta },
            ])
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: formData,
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent({
                    com: { atproto: { repo: { applyWrites } } },
                }),
                session: fakeSession,
            })
            expect(res.status).toBe(200)
            const writesArg = applyWrites.mock.calls[0][0].writes
            const postWrite = findPostWrite(
                writesArg,
                "見て https://example.com",
            )
            expect(postWrite.value.embed).toEqual({
                $type: "app.bsky.embed.external",
                external: {
                    uri: ogMeta.url,
                    title: ogMeta.title,
                    description: ogMeta.description,
                    thumb: expect.anything(),
                },
            })
        })

        it("facets付き投稿はapplyWritesへfacetsをそのまま渡す(サーバは検出しない)", async () => {
            const applyWrites = vi.fn().mockResolvedValue({
                data: {
                    results: [
                        {
                            uri: "at://did:plc:author/app.bsky.feed.post/3lpost",
                            cid: "bafypostcid",
                        },
                    ],
                },
            })
            const facets = [
                {
                    index: { byteStart: 4, byteEnd: 7 },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://example.com",
                        },
                    ],
                },
            ]
            const formData = buildTextPostFormData({ text: "foo bar" })
            formData.set("posts[0][facets]", JSON.stringify(facets))
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: formData,
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent({
                    com: { atproto: { repo: { applyWrites } } },
                }),
                session: fakeSession,
            })
            expect(res.status).toBe(200)
            expect(applyWrites).toHaveBeenCalledWith(
                expect.objectContaining({
                    writes: expect.arrayContaining([
                        expect.objectContaining({
                            value: expect.objectContaining({
                                text: "foo bar",
                                facets,
                            }),
                        }),
                    ]),
                }),
            )
        })

        it("facetsのbyteEndが本文のバイト長を超える場合は400を返す", async () => {
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData({
                        text: "foo",
                        facets: [
                            {
                                index: { byteStart: 0, byteEnd: 100 },
                                features: [
                                    {
                                        $type: "app.bsky.richtext.facet#link",
                                        uri: "https://example.com",
                                    },
                                ],
                            },
                        ],
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
                    body: buildNewImagePostFormData({ createEntry: true }),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(500)
        })

        it("ogImageアップロード失敗時は500を返す", async () => {
            const agent = createFakeAgent({
                uploadBlob: vi
                    .fn()
                    .mockResolvedValueOnce({
                        data: { blob: { $type: "blob", ref: "x" } },
                    })
                    .mockRejectedValueOnce(new Error("og upload failed")),
            })
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData({
                        imagesCount: 1,
                        createEntry: true,
                    }),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(500)
        })

        it("applyWrites失敗時は500を返す", async () => {
            const agent = createFakeAgent({
                com: {
                    atproto: {
                        repo: {
                            applyWrites: vi
                                .fn()
                                .mockRejectedValue(
                                    new Error("applyWrites failed"),
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
                    body: buildNewImagePostFormData({ createEntry: true }),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(500)
        })

        it("gate適用が失敗した場合(applyWrites全体が失敗)は500を返す", async () => {
            const agent = createFakeAgent({
                com: {
                    atproto: {
                        repo: {
                            applyWrites: vi
                                .fn()
                                .mockRejectedValue(
                                    new Error("gate create failed"),
                                ),
                        },
                    },
                },
            })
            const formData = buildTextPostFormData({ text: "hello" })
            formData.set(
                "posts[0][gate]",
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
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: formData,
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(500)
        })

        it("トップレベルのreply指定時はapplyWritesのpost値へそのまま渡され200を返す", async () => {
            const applyWrites = vi.fn().mockResolvedValue({
                data: {
                    results: [
                        {
                            uri: "at://did:plc:author/app.bsky.feed.post/3lpost",
                            cid: "bafypostcid",
                        },
                    ],
                },
            })
            const reply = {
                root: {
                    uri: "at://did:plc:author/app.bsky.feed.post/3lroot",
                    cid: "bafyroot",
                },
                parent: {
                    uri: "at://did:plc:author/app.bsky.feed.post/3lparent",
                    cid: "bafyparent",
                },
            }
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildTextPostFormData({ reply }),
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent({
                    com: { atproto: { repo: { applyWrites } } },
                }),
                session: fakeSession,
            })
            expect(res.status).toBe(200)
            expect(applyWrites).toHaveBeenCalledWith(
                expect.objectContaining({
                    writes: expect.arrayContaining([
                        expect.objectContaining({
                            value: expect.objectContaining({ reply }),
                        }),
                    ]),
                }),
            )
        })

        it("replyのroot/parentが他人の投稿を指す場合は400を返す", async () => {
            const reply = {
                root: {
                    uri: "at://did:plc:other/app.bsky.feed.post/3lroot",
                    cid: "bafyroot",
                },
                parent: {
                    uri: "at://did:plc:author/app.bsky.feed.post/3lparent",
                    cid: "bafyparent",
                },
            }
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildTextPostFormData({ reply }),
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent(),
                session: fakeSession,
            })
            expect(res.status).toBe(400)
        })

        it("成功時(createEntry:false)は200でskyshareEntryを含まない結果を返す", async () => {
            const agent = createFakeAgent()
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildTextPostFormData({ text: "hello" }),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(200)
            const json = await res.json()
            expect(json.posts).toHaveLength(1)
            expect(json.posts[0].skyshareEntry).toBeUndefined()
        })

        it("成功時(createEntry:true)は200でskyshareEntryを含む結果を返す", async () => {
            const agent = createFakeAgent()
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildNewImagePostFormData({
                        text: "hello",
                        createEntry: true,
                    }),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(200)
            const json = await res.json()
            expect(json.posts[0].skyshareEntry).toBeDefined()
            expect(json.posts[0].skyshareEntry.sourceUri).toBe(
                json.posts[0].uri,
            )
        })

        it("複数件のpostsを送るとスレッドとして1回のapplyWritesで作成される", async () => {
            const applyWrites = vi.fn().mockResolvedValue({
                data: {
                    results: [
                        {
                            uri: "at://did:plc:author/app.bsky.feed.post/3lfirst",
                            cid: "bafyfirst",
                        },
                        {
                            uri: "at://did:plc:author/app.bsky.feed.post/3lsecond",
                            cid: "bafysecond",
                        },
                    ],
                },
            })
            const formData = new FormData()
            formData.set("posts[0][text]", "1件目")
            formData.set("posts[1][text]", "2件目")
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: formData,
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent({
                    com: { atproto: { repo: { applyWrites } } },
                }),
                session: fakeSession,
            })
            expect(res.status).toBe(200)
            expect(applyWrites).toHaveBeenCalledTimes(1)
            const json = await res.json()
            expect(json.posts).toHaveLength(2)
            expect(json.posts[0].uri).toBe(
                "at://did:plc:author/app.bsky.feed.post/3lfirst",
            )
            expect(json.posts[1].uri).toBe(
                "at://did:plc:author/app.bsky.feed.post/3lsecond",
            )
            // 2件目のレコード値には1件目へのreply(root/parent)が組み立てられているはず。
            // cidは(applyWritesが返す値ではなく)1件目のレコード値から事前計算された値になるため、
            // ここではuriの一致と、root/parentが同一投稿(1件目)を指すことのみを検証する。
            const writesArg = applyWrites.mock.calls[0][0].writes
            const firstPostWrite = writesArg.find(
                (w: { collection: string; value?: { text?: string } }) =>
                    w.collection === "app.bsky.feed.post" &&
                    w.value?.text === "1件目",
            )
            const secondPostWrite = writesArg.find(
                (w: { collection: string; value?: { text?: string } }) =>
                    w.collection === "app.bsky.feed.post" &&
                    w.value?.text === "2件目",
            )
            const firstPostUri = `at://did:plc:author/app.bsky.feed.post/${firstPostWrite.rkey}`
            expect(secondPostWrite.value.reply.root.uri).toBe(firstPostUri)
            expect(secondPostWrite.value.reply.parent.uri).toBe(firstPostUri)
            expect(secondPostWrite.value.reply.root.cid).toBe(
                secondPostWrite.value.reply.parent.cid,
            )
        })
    })

    describe("スレッド投稿(複数posts・内容パターン)", () => {
        /**
         * gate/entryの有無で実際のwrites件数が変わるため、固定件数ではなく
         * 送信された`writes`から機械的に(collection/rkeyベースで)結果を組み立てる
         * (`fakeAgent.ts`の`defaultApplyWrites`と同じ方針)。
         */
        const mockApplyWrites = () =>
            vi.fn().mockImplementation(
                async ({
                    repo,
                    writes,
                }: {
                    repo: string
                    writes: { collection: string; rkey: string }[]
                }) => ({
                    data: {
                        results: writes.map((write, index) => ({
                            uri: `at://${repo}/${write.collection}/${write.rkey}`,
                            cid: `bafyapplywrites${index}`,
                        })),
                    },
                }),
            )

        const sendThread = async (
            items: PostItemOpts[],
            applyWrites: ReturnType<typeof vi.fn>,
            opts?: { reply?: object },
        ) => {
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildThreadFormData(items, opts),
                },
            )
            return callRoute(POST, request, {
                agent: createFakeAgent({
                    com: { atproto: { repo: { applyWrites } } },
                }),
                session: fakeSession,
            })
        }

        it("テキストのみ投稿と画像のみ投稿が混在するスレッドは200で各投稿のembedが独立して反映される", async () => {
            const applyWrites = mockApplyWrites()
            const res = await sendThread(
                [{ text: "1件目" }, { text: "2件目", imagesCount: 1 }],
                applyWrites,
            )
            expect(res.status).toBe(200)
            const writesArg = applyWrites.mock.calls[0][0].writes
            expect(findPostWrite(writesArg, "1件目").value.embed).toBeUndefined()
            expect(findPostWrite(writesArg, "2件目").value.embed).toEqual(
                expect.objectContaining({ $type: "app.bsky.embed.images" }),
            )
        })

        it("画像のみ投稿とOGPカードのみ投稿が混在するスレッドは200でそれぞれ異なるembedになる", async () => {
            const applyWrites = mockApplyWrites()
            const ogMeta = {
                title: "Example",
                description: "example description",
                url: "https://example.com",
            }
            const res = await sendThread(
                [
                    { text: "1件目", imagesCount: 1 },
                    { text: "2件目 https://example.com", ogImage: true, ogMeta },
                ],
                applyWrites,
            )
            expect(res.status).toBe(200)
            const writesArg = applyWrites.mock.calls[0][0].writes
            expect(findPostWrite(writesArg, "1件目").value.embed).toEqual(
                expect.objectContaining({ $type: "app.bsky.embed.images" }),
            )
            expect(
                findPostWrite(writesArg, "2件目 https://example.com").value
                    .embed,
            ).toEqual(
                expect.objectContaining({
                    $type: "app.bsky.embed.external",
                    external: expect.objectContaining({ uri: ogMeta.url }),
                }),
            )
        })

        it("URL複数+画像 と URL複数+特定OGPカード が混在するスレッドはembedとfacetsが個別に反映される", async () => {
            const applyWrites = mockApplyWrites()
            const facets1 = [
                {
                    index: { byteStart: 4, byteEnd: 7 },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://a.example.com",
                        },
                    ],
                },
            ]
            const facets2 = [
                {
                    index: { byteStart: 4, byteEnd: 7 },
                    features: [
                        {
                            $type: "app.bsky.richtext.facet#link",
                            uri: "https://c.example.com",
                        },
                    ],
                },
            ]
            const ogMeta = {
                title: "Example",
                description: "example description",
                url: "https://c.example.com",
            }
            const res = await sendThread(
                [
                    { text: "見て aaa", facets: facets1, imagesCount: 1 },
                    {
                        text: "見て ccc",
                        facets: facets2,
                        ogImage: true,
                        ogMeta,
                    },
                ],
                applyWrites,
            )
            expect(res.status).toBe(200)
            const writesArg = applyWrites.mock.calls[0][0].writes
            const firstWrite = findPostWrite(writesArg, "見て aaa")
            const secondWrite = findPostWrite(writesArg, "見て ccc")
            expect(firstWrite.value.facets).toEqual(facets1)
            expect(firstWrite.value.embed).toEqual(
                expect.objectContaining({ $type: "app.bsky.embed.images" }),
            )
            expect(secondWrite.value.facets).toEqual(facets2)
            expect(secondWrite.value.embed).toEqual(
                expect.objectContaining({ $type: "app.bsky.embed.external" }),
            )
        })

        it("画像とOGP情報を両方指定した投稿は画像embedが優先される", async () => {
            const applyWrites = mockApplyWrites()
            const res = await sendThread(
                [
                    {
                        text: "1件目",
                        imagesCount: 1,
                        ogImage: true,
                        ogMeta: {
                            title: "Example",
                            description: "example description",
                            url: "https://example.com",
                        },
                    },
                ],
                applyWrites,
            )
            expect(res.status).toBe(200)
            const writesArg = applyWrites.mock.calls[0][0].writes
            expect(findPostWrite(writesArg, "1件目").value.embed).toEqual(
                expect.objectContaining({ $type: "app.bsky.embed.images" }),
            )
        })

        it("一部投稿だけcreateEntry:trueのスレッドは該当postのみskyshareEntryを返す", async () => {
            const applyWrites = mockApplyWrites()
            const res = await sendThread(
                [
                    {
                        text: "1件目",
                        imagesCount: 1,
                        ogImage: true,
                        createEntry: true,
                    },
                    { text: "2件目" },
                ],
                applyWrites,
            )
            expect(res.status).toBe(200)
            const json = await res.json()
            expect(json.posts).toHaveLength(2)
            expect(json.posts[0].skyshareEntry).toBeDefined()
            expect(json.posts[0].skyshareEntry.sourceUri).toBe(
                json.posts[0].uri,
            )
            expect(json.posts[1].skyshareEntry).toBeUndefined()
        })

        it("トップレベルreplyと複数postsを組み合わせた場合、先頭postは指定replyへ、2件目は先頭post自身へチェーンする", async () => {
            const applyWrites = mockApplyWrites()
            const reply = {
                root: {
                    uri: "at://did:plc:author/app.bsky.feed.post/3lroot",
                    cid: "bafyroot",
                },
                parent: {
                    uri: "at://did:plc:author/app.bsky.feed.post/3lparent",
                    cid: "bafyparent",
                },
            }
            const res = await sendThread(
                [{ text: "1件目" }, { text: "2件目" }],
                applyWrites,
                { reply },
            )
            expect(res.status).toBe(200)
            const writesArg = applyWrites.mock.calls[0][0].writes
            const firstWrite = findPostWrite(writesArg, "1件目")
            const secondWrite = findPostWrite(writesArg, "2件目")
            expect(firstWrite.value.reply).toEqual(reply)
            const firstPostUri = `at://did:plc:author/app.bsky.feed.post/${firstWrite.rkey}`
            expect(secondWrite.value.reply.root.uri).toBe(reply.root.uri)
            expect(secondWrite.value.reply.parent.uri).toBe(firstPostUri)
        })

        it("スレッド内の特定投稿のみgate指定した場合、該当rkeyにのみgateレコードが作成される", async () => {
            const applyWrites = mockApplyWrites()
            const gate = {
                replyAudience: "nobody",
                allowMentioned: false,
                allowFollower: false,
                allowFollowing: false,
                listUris: [],
                allowQuote: true,
            }
            const res = await sendThread(
                [
                    { text: "1件目", gate },
                    { text: "2件目" },
                ],
                applyWrites,
            )
            expect(res.status).toBe(200)
            const writesArg = applyWrites.mock.calls[0][0].writes
            const firstWrite = findPostWrite(writesArg, "1件目")
            const secondWrite = findPostWrite(writesArg, "2件目")
            const gateWrites = writesArg.filter(
                (w: { collection: string }) =>
                    w.collection === "app.bsky.feed.threadgate" ||
                    w.collection === "app.bsky.feed.postgate",
            )
            expect(gateWrites.length).toBeGreaterThan(0)
            for (const w of gateWrites) {
                expect(w.rkey).toBe(firstWrite.rkey)
                expect(w.rkey).not.toBe(secondWrite.rkey)
            }
        })
    })

    describe("スレッド投稿の異常系", () => {
        it("2件目でcreateEntry:trueなのに画像が無い場合、全体を400で拒否しapplyWritesは呼ばれない", async () => {
            const applyWrites = vi.fn()
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildThreadFormData([
                        { text: "1件目" },
                        { text: "2件目", createEntry: true },
                    ]),
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent({
                    com: { atproto: { repo: { applyWrites } } },
                }),
                session: fakeSession,
            })
            expect(res.status).toBe(400)
            expect(applyWrites).not.toHaveBeenCalled()
        })

        it("2件目でfacetsのbyteEndが本文バイト長を超える場合、全体を400で拒否しapplyWritesは呼ばれない", async () => {
            const applyWrites = vi.fn()
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildThreadFormData([
                        { text: "1件目", imagesCount: 1 },
                        {
                            text: "foo",
                            facets: [
                                {
                                    index: { byteStart: 0, byteEnd: 100 },
                                    features: [
                                        {
                                            $type: "app.bsky.richtext.facet#link",
                                            uri: "https://example.com",
                                        },
                                    ],
                                },
                            ],
                        },
                    ]),
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent({
                    com: { atproto: { repo: { applyWrites } } },
                }),
                session: fakeSession,
            })
            expect(res.status).toBe(400)
            expect(applyWrites).not.toHaveBeenCalled()
        })

        it("2件目で画像枚数とメタデータ件数が不一致の場合、全体を400で拒否しapplyWritesは呼ばれない", async () => {
            const applyWrites = vi.fn()
            const request = new Request(
                "https://skyshare.nekono.dev/v2/entry/",
                {
                    method: "POST",
                    headers: authHeaders,
                    body: buildThreadFormData([
                        { text: "1件目" },
                        {
                            imagesCount: 2,
                            imagesMeta: [{ width: 100, height: 100 }],
                        },
                    ]),
                },
            )
            const res = await callRoute(POST, request, {
                agent: createFakeAgent({
                    com: { atproto: { repo: { applyWrites } } },
                }),
                session: fakeSession,
            })
            expect(res.status).toBe(400)
            expect(applyWrites).not.toHaveBeenCalled()
        })

        it("2件目の画像アップロードが失敗した場合は500を返す", async () => {
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
                    body: buildThreadFormData([
                        { text: "1件目" },
                        { text: "2件目", imagesCount: 1 },
                    ]),
                },
            )
            const res = await callRoute(POST, request, {
                agent,
                session: fakeSession,
            })
            expect(res.status).toBe(500)
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
