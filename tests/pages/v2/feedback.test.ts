/**
 * `src/pages/v2/feedback.ts` の統合テスト。
 *
 * - 認証情報と回数の制限のバインディングは `getFeedbackEnv` の差し替えで、
 *   ビルドの情報は `buildInfo` の差し替えで注入する。
 * - GitHub の API は `fetch` の差し替えで受け、送られた Issue を記録する。
 * - ルートが使う `src/lib/feedback/*` は実コードのまま通す。
 */
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { APIContext } from "astro"

const holder = vi.hoisted(() => ({
    env: undefined as unknown,
    build: {
        version: "2.0.0",
        commit: "0123456789abcdef0123456789abcdef01234567" as string | null,
        repository: "owner/repo" as string | null,
    },
}))
vi.mock("@/lib/feedback/env", () => ({
    getFeedbackEnv: async () => holder.env,
}))
vi.mock("@/lib/site/buildInfo", () => ({
    get buildInfo() {
        return holder.build
    },
}))

import { POST } from "@/pages/v2/feedback"

const DID = "did:plc:aaaa"
const session = { did: DID, handle: "alice.bsky.social" } as never

/** 同じキーの2件目を拒否するフェイクの回数の制限（期間内の1件目だけ通す） */
const createFakeLimiter = () => {
    const seen = new Set<string>()
    return {
        limit: vi.fn(async ({ key }: { key: string }) => {
            if (seen.has(key)) return { success: false }
            seen.add(key)
            return { success: true }
        }),
    }
}

const environment = {
    os: "Windows 11",
    browser: "Chrome 141",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    standalone: false,
    version: "2.0.0",
    commit: "0123456789abcdef0123456789abcdef01234567",
}
const bugBody = {
    kind: "bug",
    title: "投稿できない",
    steps: "本文を入れて送信した",
    reproducibility: "always",
    environment,
}
const enhancementBody = {
    kind: "enhancement",
    title: "下書きの並べ替え",
    description: "日付で並べ替えたい",
    environment,
}

const call = (body: unknown, locals: object = { session }) =>
    (POST as unknown as (c: APIContext) => Promise<Response>)({
        request: new Request("http://localhost/v2/feedback/", {
            method: "POST",
            headers: { cookie: "sid=1", "content-type": "application/json" },
            body: JSON.stringify(body),
        }),
        locals,
    } as unknown as APIContext)

let limiter: ReturnType<typeof createFakeLimiter>
let sent: { title: string; body: string; labels: string[] }[]
let githubStatus: number

beforeEach(() => {
    limiter = createFakeLimiter()
    holder.env = {
        FEEDBACK_GITHUB_TOKEN: "token",
        FEEDBACK_RATE_LIMITER: limiter,
    }
    holder.build = {
        version: "2.0.0",
        commit: "0123456789abcdef0123456789abcdef01234567",
        repository: "owner/repo",
    }
    sent = []
    githubStatus = 201
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init: RequestInit) => {
            sent.push(JSON.parse(String(init.body)))
            return new Response(
                JSON.stringify({
                    number: sent.length,
                    html_url: `https://github.com/owner/repo/issues/${sent.length}`,
                }),
                { status: githubStatus },
            )
        }),
    )
})

describe("POST /v2/feedback", () => {
    test("feedback-api/1.1,1.2: セッションのない送信は401になり、報告者はセッションのアカウントになる", async () => {
        expect((await call(bugBody, {})).status).toBe(401)
        // 入力に報告者を混ぜる送信は、未知の項目として拒否される
        expect((await call({ ...bugBody, did: "did:plc:other" })).status).toBe(
            400,
        )

        const res = await call(bugBody)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            number: 1,
            url: "https://github.com/owner/repo/issues/1",
        })
        expect(sent[0].body).toContain("`@alice.bsky.social`")
        expect(sent[0].body).toContain(`[${DID}]`)
    })

    test("feedback-api/2.1: 不具合の種別に新機能の提案の本文を付けた送信は400になる", async () => {
        expect(
            (await call({ ...bugBody, description: "提案の本文" })).status,
        ).toBe(400)
        const { steps: _steps, reproducibility: _r, ...rest } = bugBody
        expect(
            (await call({ ...rest, description: "提案の本文" })).status,
        ).toBe(400)
        expect(sent).toHaveLength(0)
    })

    test("feedback-api/2.2: 再現の頻度が4つの値以外の不具合の送信は400になる", async () => {
        expect(
            (await call({ ...bugBody, reproducibility: "often" })).status,
        ).toBe(400)
        for (const value of ["always", "sometimes", "no", "untested"]) {
            limiter = createFakeLimiter()
            holder.env = {
                FEEDBACK_GITHUB_TOKEN: "token",
                FEEDBACK_RATE_LIMITER: limiter,
            }
            expect(
                (await call({ ...bugBody, reproducibility: value })).status,
            ).toBe(200)
        }
    })

    test("feedback-api/2.3,2.4: 技術的な補足を省いた新機能の提案が登録される", async () => {
        const res = await call(enhancementBody)
        expect(res.status).toBe(200)
        expect(sent[0].labels).toEqual(["enhancement"])
        expect(sent[0].body).not.toContain("技術的な補足")
    })

    test("feedback-api/2.5,2.6: 101文字の件名と空白だけの本文は400、絵文字100個の件名は登録される", async () => {
        expect(
            (await call({ ...bugBody, title: "あ".repeat(101) })).status,
        ).toBe(400)
        expect((await call({ ...bugBody, steps: " \n\t" })).status).toBe(400)
        expect(
            (await call({ ...bugBody, steps: "a".repeat(2001) })).status,
        ).toBe(400)
        const family = "👨‍👩‍👧‍👦".repeat(100)
        expect((await call({ ...bugBody, title: family })).status).toBe(200)
        expect(sent[0].title).toBe(family)
    })

    test("feedback-api/1.3: 同じアカウントの2件目の送信は429になり、GitHub への登録が行われない", async () => {
        expect((await call(bugBody)).status).toBe(200)
        expect((await call(bugBody)).status).toBe(429)
        expect(sent).toHaveLength(1)
        expect(limiter.limit).toHaveBeenCalledWith({ key: DID })
    })

    test("feedback-api/1.3: 入力が不正な送信は回数を消費しない", async () => {
        expect((await call({ ...bugBody, title: "" })).status).toBe(400)
        expect(limiter.limit).not.toHaveBeenCalled()
        expect((await call(bugBody)).status).toBe(200)
    })

    test("feedback-api/1.4,1.5: 認証情報がないときは503、GitHub が失敗を返したときは500になる", async () => {
        holder.env = { FEEDBACK_RATE_LIMITER: limiter }
        expect((await call(bugBody)).status).toBe(503)

        holder.env = {
            FEEDBACK_GITHUB_TOKEN: "token",
            FEEDBACK_RATE_LIMITER: limiter,
        }
        holder.build = { ...holder.build, repository: null }
        expect((await call(bugBody)).status).toBe(503)
        expect(limiter.limit).not.toHaveBeenCalled()

        holder.build = { ...holder.build, repository: "owner/repo" }
        githubStatus = 422
        expect((await call(bugBody)).status).toBe(500)
    })

    test("壊れた JSON は400になる", async () => {
        const res = await (
            POST as unknown as (c: APIContext) => Promise<Response>
        )({
            request: new Request("http://localhost/v2/feedback/", {
                method: "POST",
                headers: { cookie: "sid=1" },
                body: "{",
            }),
            locals: { session },
        } as unknown as APIContext)
        expect(res.status).toBe(400)
    })
})
