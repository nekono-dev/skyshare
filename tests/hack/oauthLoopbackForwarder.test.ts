import { describe, expect, test } from "vitest"
import { forwardLoopbackRequest } from "../../hack/oauthLoopbackForwarder"

describe("開発サーバーの戻り先の中継", () => {
    test("[oauth-client/6.1] ループバックの戻り先への遷移が、同じパスとクエリのまま開発サーバーのオリジンへ転送される", () => {
        expect(
            forwardLoopbackRequest(
                "GET",
                "/oauth/callback/?code=C&state=S&iss=https%3A%2F%2Fbsky.social",
                4321,
            ),
        ).toEqual({
            status: 302,
            location:
                "https://localhost:4321/oauth/callback/?code=C&state=S&iss=https%3A%2F%2Fbsky.social",
        })
        // 戻り先以外と、GET 以外は中継しない
        expect(forwardLoopbackRequest("GET", "/", 4321)).toEqual({
            status: 404,
        })
        expect(
            forwardLoopbackRequest("POST", "/oauth/callback/?code=C", 4321),
        ).toEqual({ status: 404 })
        // 別のホストを含む住所でも、転送先は開発サーバーのオリジンに固定する
        expect(
            forwardLoopbackRequest(
                "GET",
                "//evil.example/oauth/callback/",
                4321,
            ),
        ).toEqual({
            status: 302,
            location: "https://localhost:4321/oauth/callback/",
        })
    })
})
