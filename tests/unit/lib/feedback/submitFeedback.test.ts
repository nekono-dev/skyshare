/**
 * 送信の判定（設定の確認・回数の制限・Issue の登録）の単体テスト（src-pages-thin 3.1・要件 3.1〜3.3）。
 *
 * 責務と処理概要:
 * - 認証情報・リポジトリの欠落は 503、回数の制限は 429、登録の失敗は 500 を、戻り値の失敗として返すことを固定する。
 * - 成功は作成した Issue の番号と URL を返すことを固定する。
 * - 外部トークンの値は、戻り値にもエラーの内容にも含まれないことを固定する。
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    getFeedbackEnv: vi.fn(),
    createGithubIssue: vi.fn(),
}))

vi.mock("@/lib/feedback/env", () => ({
    getFeedbackEnv: mocks.getFeedbackEnv,
}))

vi.mock("@/lib/feedback/githubIssue", () => ({
    createGithubIssue: mocks.createGithubIssue,
}))

vi.mock("@/lib/site/buildInfo", () => ({
    buildInfo: {
        version: "1.2.3",
        commit: "0123456789abcdef0123456789abcdef01234567",
        repository: "owner/repo",
    },
}))

import { submitFeedback } from "@/lib/feedback/submitFeedback"
import type { FeedbackSubmission } from "@/lib/feedback/submission"

const TOKEN = "github_pat_SECRET_TOKEN_VALUE_123"

const session = { did: "did:plc:reporter", handle: "reporter.example" }

const submission: FeedbackSubmission = {
    kind: "bug",
    title: "画像が送れない",
    steps: "投稿画面で画像を選ぶ",
    reproducibility: "always",
    environment: {
        os: "Android",
        browser: "Chrome",
        userAgent: "UA",
        standalone: false,
        version: "1.2.3",
        commit: "0123456789abcdef0123456789abcdef01234567",
    },
}

const fakeEnv = (overrides: { token?: string; allowed?: boolean } = {}) => ({
    FEEDBACK_GITHUB_TOKEN: "token" in overrides ? overrides.token : TOKEN,
    FEEDBACK_RATE_LIMITER: {
        limit: vi.fn(async () => ({ success: overrides.allowed ?? true })),
    },
})

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("submitFeedback", () => {
    it("returns 503 when the token is missing and does not create an issue", async () => {
        const env = fakeEnv({ token: undefined })
        mocks.getFeedbackEnv.mockResolvedValue(env)

        const result = await submitFeedback({ session, submission })

        expect(result).toEqual({ ok: false, status: 503 })
        expect(mocks.createGithubIssue).not.toHaveBeenCalled()
        expect(env.FEEDBACK_RATE_LIMITER.limit).not.toHaveBeenCalled()
    })

    it("returns 503 and logs the same fields when the token is missing", async () => {
        mocks.getFeedbackEnv.mockResolvedValue(fakeEnv({ token: undefined }))

        await submitFeedback({ session, submission })

        expect(console.error).toHaveBeenCalledWith(
            "feedback POST: not configured",
            { token: false, repository: true },
        )
    })

    it("returns 503 when the repository is missing", async () => {
        const { buildInfo } = await import("@/lib/site/buildInfo")
        const original = buildInfo.repository
        buildInfo.repository = null
        try {
            mocks.getFeedbackEnv.mockResolvedValue(fakeEnv())

            const result = await submitFeedback({ session, submission })

            expect(result).toEqual({ ok: false, status: 503 })
            expect(mocks.createGithubIssue).not.toHaveBeenCalled()
        } finally {
            buildInfo.repository = original
        }
    })

    it("returns 429 when the rate limiter refuses and does not create an issue", async () => {
        mocks.getFeedbackEnv.mockResolvedValue(fakeEnv({ allowed: false }))

        const result = await submitFeedback({ session, submission })

        expect(result).toEqual({ ok: false, status: 429 })
        expect(mocks.createGithubIssue).not.toHaveBeenCalled()
    })

    it("limits by the session DID", async () => {
        const env = fakeEnv()
        mocks.getFeedbackEnv.mockResolvedValue(env)
        mocks.createGithubIssue.mockResolvedValue({
            number: 1,
            url: "https://github.com/owner/repo/issues/1",
        })

        await submitFeedback({ session, submission })

        expect(env.FEEDBACK_RATE_LIMITER.limit).toHaveBeenCalledWith({
            key: session.did,
        })
    })

    it("returns 500 when the GitHub issue creation fails", async () => {
        mocks.getFeedbackEnv.mockResolvedValue(fakeEnv())
        mocks.createGithubIssue.mockResolvedValue(null)

        const result = await submitFeedback({ session, submission })

        expect(result).toEqual({ ok: false, status: 500 })
    })

    it("returns the created issue number and url as the ok value", async () => {
        mocks.getFeedbackEnv.mockResolvedValue(fakeEnv())
        mocks.createGithubIssue.mockResolvedValue({
            number: 12,
            url: "https://github.com/owner/repo/issues/12",
        })

        const result = await submitFeedback({ session, submission })

        expect(result).toEqual({
            ok: true,
            value: {
                number: 12,
                url: "https://github.com/owner/repo/issues/12",
            },
        })
    })

    it("passes the token, repository and built issue to createGithubIssue", async () => {
        mocks.getFeedbackEnv.mockResolvedValue(fakeEnv())
        mocks.createGithubIssue.mockResolvedValue({
            number: 1,
            url: "https://github.com/owner/repo/issues/1",
        })

        await submitFeedback({ session, submission })

        expect(mocks.createGithubIssue).toHaveBeenCalledTimes(1)
        const [opts] = mocks.createGithubIssue.mock.calls[0] as [
            {
                token: string
                repository: string
                issue: { title: string; labels: string[] }
            },
        ]
        expect(opts.token).toBe(TOKEN)
        expect(opts.repository).toBe("owner/repo")
        expect(opts.issue.title).toBe("画像が送れない")
        expect(opts.issue.labels).toEqual(["bug"])
    })

    it("never includes the token value in the result or in a thrown error", async () => {
        mocks.getFeedbackEnv.mockResolvedValue(fakeEnv({ allowed: false }))
        const limited = await submitFeedback({ session, submission })
        expect(JSON.stringify(limited)).not.toContain(TOKEN)

        mocks.getFeedbackEnv.mockResolvedValue(fakeEnv())
        mocks.createGithubIssue.mockResolvedValue(null)
        const failed = await submitFeedback({ session, submission })
        expect(JSON.stringify(failed)).not.toContain(TOKEN)

        mocks.getFeedbackEnv.mockResolvedValue(fakeEnv())
        mocks.createGithubIssue.mockRejectedValue(new Error("boom"))
        const thrown = await submitFeedback({ session, submission }).catch(
            (err: unknown) => err,
        )
        expect(String(thrown)).not.toContain(TOKEN)
    })
})
