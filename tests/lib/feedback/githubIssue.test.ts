/**
 * GitHub の Issue の作成の呼び出しの検証。
 *
 * 責務と処理概要:
 * - 送る要求（URL・見出し・本文）と、201 とそれ以外の応答の扱いを、fetch の差し替えで検証する。
 */
import { describe, expect, it, vi } from "vitest"
import { createGithubIssue } from "@/lib/feedback/githubIssue"

const issue = { title: "t", body: "b", labels: ["bug"] as ["bug"] }

describe("createGithubIssue", () => {
    it("Issue の作成を送り、201 の番号と URL を返す", async () => {
        const fetchFn = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        number: 7,
                        html_url: "https://github.com/o/r/issues/7",
                    }),
                    { status: 201 },
                ),
        )
        const created = await createGithubIssue(
            { token: "secret", repository: "o/r", issue },
            fetchFn as unknown as typeof fetch,
        )
        expect(created).toEqual({
            number: 7,
            url: "https://github.com/o/r/issues/7",
        })
        const [url, init] = fetchFn.mock.calls[0] as unknown as [
            string,
            RequestInit,
        ]
        expect(url).toBe("https://api.github.com/repos/o/r/issues")
        expect(init.method).toBe("POST")
        const headers = init.headers as Record<string, string>
        expect(headers.Authorization).toBe("Bearer secret")
        expect(headers["User-Agent"]).toBe("skyshare")
        expect(JSON.parse(String(init.body))).toEqual({
            title: "t",
            body: "b",
            labels: ["bug"],
        })
    })

    it("201 以外と通信の例外は null を返す", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {})
        const failed = vi.fn(
            async () => new Response("forbidden", { status: 403 }),
        )
        expect(
            await createGithubIssue(
                { token: "t", repository: "o/r", issue },
                failed as unknown as typeof fetch,
            ),
        ).toBeNull()
        const thrown = vi.fn(async () => {
            throw new Error("offline")
        })
        expect(
            await createGithubIssue(
                { token: "t", repository: "o/r", issue },
                thrown as unknown as typeof fetch,
            ),
        ).toBeNull()
    })
})
