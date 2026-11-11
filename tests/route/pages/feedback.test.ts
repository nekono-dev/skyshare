/**
 * Verifies feedback submission responses and rate limiting.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
    token: "token-fixture" as string | undefined,
    limit: vi.fn(async () => ({ success: true })),
    createGithubIssue: vi.fn(
        async () =>
            ({ number: 7, url: "https://github.com/owner/repo/issues/7" }) as {
                number: number
                url: string
            } | null,
    ),
}))

vi.mock("@/lib/feedback/env", () => ({
    getFeedbackEnv: async () => ({
        FEEDBACK_GITHUB_TOKEN: state.token,
        FEEDBACK_RATE_LIMITER: { limit: state.limit },
    }),
}))
vi.mock("@/lib/feedback/githubIssue", () => ({
    createGithubIssue: state.createGithubIssue,
}))
vi.mock("@/lib/site/buildInfo", () => ({
    buildInfo: { version: "1.0.0", commit: null, repository: "owner/repo" },
}))

import { POST } from "@/pages/v2/feedback"
import { TEST_DID, TEST_HANDLE } from "../../fixtures/identities"

const environment = {
    os: "Linux",
    browser: "Chrome",
    userAgent: "UA-fixture",
    standalone: false,
    version: "1.0.0",
    commit: "",
}
const validBody = {
    kind: "bug",
    title: "落ちる",
    steps: "押した",
    reproducibility: "always",
    environment,
}

const call = (opts: {
    body?: unknown
    cookie?: string | null
    session?: boolean
}) => {
    const headers: Record<string, string> = {
        "content-type": "application/json",
    }
    if (opts.cookie !== null)
        headers.cookie = opts.cookie ?? "atp_session=fixture"
    const request = new Request("https://skyshare.test/v2/feedback", {
        method: "POST",
        headers,
        body: JSON.stringify(opts.body ?? validBody),
    })
    const locals =
        opts.session === false
            ? {}
            : { session: { did: TEST_DID, handle: TEST_HANDLE } }
    return POST({ request, locals } as never)
}

describe("POST /v2/feedback", () => {
    beforeEach(() => {
        state.token = "token-fixture"
        state.limit.mockReset().mockResolvedValue({ success: true })
        state.createGithubIssue.mockReset().mockResolvedValue({
            number: 7,
            url: "https://github.com/owner/repo/issues/7",
        })
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    it("returns 400 when the cookie header is missing", async () => {
        expect((await call({ cookie: null })).status).toBe(400)
    })

    it("returns 401 when there is no session", async () => {
        expect((await call({ session: false })).status).toBe(401)
    })

    it("returns 400 for a body that does not match the schema", async () => {
        expect((await call({ body: { kind: "unknown" } })).status).toBe(400)
    })

    it("returns 503 when the GitHub token is not configured, and never creates an issue", async () => {
        state.token = undefined
        expect((await call({})).status).toBe(503)
        expect(state.createGithubIssue).not.toHaveBeenCalled()
    })

    it("returns 429 when the per-account rate limit is exceeded, and never creates an issue", async () => {
        state.limit.mockResolvedValue({ success: false })
        expect((await call({})).status).toBe(429)
        expect(state.createGithubIssue).not.toHaveBeenCalled()
    })

    it("returns 500 when the issue cannot be created", async () => {
        state.createGithubIssue.mockResolvedValue(null)
        expect((await call({})).status).toBe(500)
    })

    it("returns 200 with the created issue, not cached, and limits by the account DID", async () => {
        const res = await call({})
        expect(res.status).toBe(200)
        expect(res.headers.get("cache-control")).toBe("no-store")
        expect(await res.json()).toEqual({
            number: 7,
            url: "https://github.com/owner/repo/issues/7",
        })
        expect(state.limit).toHaveBeenCalledWith({ key: TEST_DID })
    })
})
