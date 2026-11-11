/**
 * Verifies entry API validation and response behavior.
 */
// 不正なヘッダ・未認証・返信の所有違い・対象がない場合の状態コードを、現行の値で固定する。
// 成功系の応答は e2e が守るため、ここでは扱わない。振る舞いを変えるためのテストではない。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ENTRY_COLLECTION } from "@/lib/atproto/nsid"
import { createAtpAgent } from "@/lib/atproto/agentFactory"
import { TEST_DID, TEST_HANDLE } from "../../fixtures/identities"
import { DELETE, PUT, POST } from "@/pages/v2/entry"

/** 別のアカウント（架空。TEST_DID のエントリや投稿ではないことを確かめる） */
const OTHER_DID = "did:plc:testfixturebob00000000000"

/** 偽の Bluesky（outboundService）へ向くエージェント。認証状態は不要な経路だけを通す */
const agent = () => createAtpAgent("https://pds.test")

/** 認証済みの locals（エージェントとセッション） */
const authedLocals = () => ({
    agent: agent(),
    session: { did: TEST_DID, handle: TEST_HANDLE },
})

/** 偽の Bluesky に存在しないエントリの AT URI（自分のリポジトリ） */
const missingEntryUri = `at://${TEST_DID}/${ENTRY_COLLECTION}/3lxmissing`

/** 他人のリポジトリのエントリの AT URI */
const otherEntryUri = `at://${OTHER_DID}/${ENTRY_COLLECTION}/3lxother`

/** 新規投稿（本文 1 件）の multipart。reply を任意で付ける */
const postForm = (reply?: unknown) => {
    const form = new FormData()
    form.append("posts[0][text]", "失敗系の本文")
    if (reply !== undefined) form.append("reply", JSON.stringify(reply))
    return form
}

/** 更新・削除の JSON ボディ */
const jsonBody = (value: unknown) => JSON.stringify(value)

/** 有効な cookie ヘッダ（架空の値） */
const COOKIE = "atp_session=fixture"

/** POST /v2/entry を呼ぶ */
const post = (opts: {
    form?: FormData
    cookie?: boolean
    contentType?: string
    locals?: object
}) => {
    const headers: Record<string, string> = {}
    if (opts.cookie !== false) headers.cookie = COOKIE
    if (opts.contentType) headers["content-type"] = opts.contentType
    const request = new Request("https://skyshare.test/v2/entry", {
        method: "POST",
        headers,
        body: opts.form ?? postForm(),
    })
    return POST({ request, locals: opts.locals ?? {} } as never)
}

/** PUT /v2/entry を呼ぶ */
const put = (opts: { body: string; cookie?: boolean; locals?: object }) => {
    const headers: Record<string, string> = {
        "content-type": "application/json",
    }
    if (opts.cookie !== false) headers.cookie = COOKIE
    const request = new Request("https://skyshare.test/v2/entry", {
        method: "PUT",
        headers,
        body: opts.body,
    })
    return PUT({ request, locals: opts.locals ?? {} } as never)
}

/** DELETE /v2/entry を呼ぶ */
const del = (opts: { body: string; cookie?: boolean; locals?: object }) => {
    const headers: Record<string, string> = {
        "content-type": "application/json",
    }
    if (opts.cookie !== false) headers.cookie = COOKIE
    const request = new Request("https://skyshare.test/v2/entry", {
        method: "DELETE",
        headers,
        body: opts.body,
    })
    return DELETE({ request, locals: opts.locals ?? {} } as never)
}

describe("POST /v2/entry failure responses", () => {
    /** 警告ログの検査用（現行は所有の検証の失敗を warn に記録する） */
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns 400 when the cookie header is missing", async () => {
        const res = await post({ cookie: false, locals: authedLocals() })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 400 when the body is not multipart/form-data", async () => {
        const request = new Request("https://skyshare.test/v2/entry", {
            method: "POST",
            headers: {
                cookie: COOKIE,
                "content-type": "application/json",
            },
            body: jsonBody({ posts: [{ text: "json では受けない" }] }),
        })
        const res = await POST({
            request,
            locals: authedLocals(),
        } as never)
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 401 when there is no session", async () => {
        const res = await post({ locals: {} })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
    })

    it("returns 400 when the reply ref points to another account's post", async () => {
        const ownedReplyPost = {
            uri: `at://${TEST_DID}/app.bsky.feed.post/3lxmine`,
            cid: "bafyreplyroot",
        }
        const foreignPost = {
            uri: `at://${OTHER_DID}/app.bsky.feed.post/3lxforeign`,
            cid: "bafyreplyforeign",
        }
        const res = await post({
            form: postForm({ root: foreignPost, parent: ownedReplyPost }),
            locals: authedLocals(),
        })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
        // スキーマの不一致ではなく、所有の検証（フェーズ 6）で弾かれたことを確かめる
        expect(warnSpy).toHaveBeenCalledWith(
            "createEntry: reply ref not owned by caller",
        )
    })
})

describe("PUT /v2/entry failure responses", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns 400 when the cookie header is missing", async () => {
        const res = await put({
            cookie: false,
            body: jsonBody({
                uri: missingEntryUri,
                heading: "見出し",
                caption: "説明",
            }),
            locals: authedLocals(),
        })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 401 when there is no session", async () => {
        const res = await put({
            body: jsonBody({
                uri: missingEntryUri,
                heading: "見出し",
                caption: "説明",
            }),
            locals: {},
        })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
    })

    it("returns 400 when the body is not valid JSON", async () => {
        const res = await put({
            body: "{不正なJSON",
            locals: authedLocals(),
        })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 400 when the uri belongs to another account", async () => {
        const res = await put({
            body: jsonBody({
                uri: otherEntryUri,
                heading: "見出し",
                caption: "説明",
            }),
            locals: authedLocals(),
        })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 404 when the entry does not exist", async () => {
        const res = await put({
            body: jsonBody({
                uri: missingEntryUri,
                heading: "見出し",
                caption: "説明",
            }),
            locals: authedLocals(),
        })
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: "Not Found" })
    })
})

describe("DELETE /v2/entry failure responses", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns 400 when the cookie header is missing", async () => {
        const res = await del({
            cookie: false,
            body: jsonBody({ uri: missingEntryUri }),
            locals: authedLocals(),
        })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 401 when there is no session", async () => {
        const res = await del({
            body: jsonBody({ uri: missingEntryUri }),
            locals: {},
        })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "Unauthorized" })
    })

    it("returns 400 when the body has an unknown key", async () => {
        const res = await del({
            body: jsonBody({
                uri: missingEntryUri,
                deleteBskyThread: true,
            }),
            locals: authedLocals(),
        })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 400 when the uri belongs to another account", async () => {
        const res = await del({
            body: jsonBody({ uri: otherEntryUri }),
            locals: authedLocals(),
        })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: "Bad Request" })
    })

    it("returns 404 when the entry does not exist and the bsky post is to be deleted", async () => {
        const res = await del({
            body: jsonBody({
                uri: missingEntryUri,
                deleteBskyPost: true,
            }),
            locals: authedLocals(),
        })
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: "Not Found" })
    })
})

describe("POST /v2/entry success response shape", () => {
    it("returns 200 with only content-type and no cache-control", async () => {
        const res = await post({ form: postForm(), locals: authedLocals() })
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("application/json")
        expect(res.headers.get("cache-control")).toBeNull()
        expect(res.headers.getSetCookie()).toEqual([])
    })
})
