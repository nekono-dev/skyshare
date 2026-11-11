/**
 * Verifies GitHub issue creation requests and response handling.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createGithubIssue } from "@/lib/feedback/githubIssue"

const issue = { title: "t", body: "b", labels: ["bug"] as ["bug"] }
const opts = { token: "token-fixture", repository: "owner/repo", issue }

const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    })

describe("createGithubIssue", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {})
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("returns the number and URL of the created issue", async () => {
        const fetchFn = vi.fn(async () =>
            jsonResponse(201, {
                number: 7,
                html_url: "https://github.com/owner/repo/issues/7",
            }),
        )
        expect(
            await createGithubIssue(opts, fetchFn as unknown as typeof fetch),
        ).toEqual({
            number: 7,
            url: "https://github.com/owner/repo/issues/7",
        })
    })

    it("sends the title, body, and labels with the token in the Authorization header", async () => {
        const fetchFn = vi.fn(async () =>
            jsonResponse(201, { number: 1, html_url: "https://x" }),
        )
        await createGithubIssue(opts, fetchFn as unknown as typeof fetch)
        const [url, init] = fetchFn.mock.calls[0] as unknown as [
            string,
            RequestInit,
        ]
        expect(url).toBe("https://api.github.com/repos/owner/repo/issues")
        expect((init.headers as Record<string, string>).Authorization).toBe(
            "Bearer token-fixture",
        )
        expect(JSON.parse(String(init.body))).toEqual({
            title: "t",
            body: "b",
            labels: ["bug"],
        })
    })

    it("returns null when GitHub answers with a status other than 201", async () => {
        const fetchFn = vi.fn(async () =>
            jsonResponse(422, { message: "Validation Failed" }),
        )
        expect(
            await createGithubIssue(opts, fetchFn as unknown as typeof fetch),
        ).toBeNull()
    })

    it("returns null when the created-issue response has no number or URL", async () => {
        const fetchFn = vi.fn(async () =>
            jsonResponse(201, { unexpected: true }),
        )
        expect(
            await createGithubIssue(opts, fetchFn as unknown as typeof fetch),
        ).toBeNull()
    })

    it("returns null when the request itself fails (network error)", async () => {
        const fetchFn = vi.fn(async () => {
            throw new TypeError("fetch failed")
        })
        expect(
            await createGithubIssue(opts, fetchFn as unknown as typeof fetch),
        ).toBeNull()
    })
})
