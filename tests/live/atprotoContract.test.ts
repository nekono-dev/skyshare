// 実 Bluesky（PDS）との契約を読み取り専用で確かめる。設定が無いときは全てスキップする（`npm run test:live`）。
// 投稿などの書き込みは行わない。パスワードは表示しない（失敗メッセージにも含めない）。
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
    PUBLIC_APPVIEW,
    readLiveConfig,
    sessionMismatches,
} from "../../scripts/lib/liveConfig.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const live = readLiveConfig({
    configPath: path.join(root, "config/live.json"),
    devVarsPath: path.join(root, ".dev.vars"),
})
const skipped = "skip" in live
if (skipped) console.warn(`live テストをスキップします: ${live.skip}`)

/** XRPC（PDS または AppView の API）を呼ぶ。応答の本文と HTTP ステータスを返す */
const xrpc = async (
    method: string,
    nsid: string,
    query?: Record<string, string>,
    body?: unknown,
    base: string = live.skip ? "https://invalid.example" : live.service,
) => {
    const url = new URL(`/xrpc/${nsid}`, base)
    for (const [key, value] of Object.entries(query ?? {}))
        url.searchParams.set(key, value)
    const response = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    })
    return {
        status: response.status,
        body: (await response.json().catch(() => ({}))) as Record<
            string,
            unknown
        >,
    }
}

describe.skipIf(skipped)("atproto の契約（読み取り専用）", () => {
    it("正しいパスワードでセッションを作り、DID とハンドルが設定と一致する", async () => {
        if (skipped) return
        const response = await xrpc(
            "POST",
            "com.atproto.server.createSession",
            undefined,
            {
                identifier: live.identifier,
                password: live.appPassword,
            },
        )
        expect(response.status).toBe(200)
        expect(sessionMismatches(response.body, live.identifier)).toEqual([])
    })

    it("誤ったパスワードは 401 と AuthenticationRequired で拒否される", async () => {
        if (skipped) return
        const response = await xrpc(
            "POST",
            "com.atproto.server.createSession",
            undefined,
            {
                identifier: live.identifier,
                password: `${live.appPassword}-wrong`,
            },
        )
        expect(response.status).toBe(401)
        expect(response.body.error).toBe("AuthenticationRequired")
    })

    it("ハンドルの解決とプロフィールの取得が、同じ DID とハンドルを返す", async () => {
        if (skipped) return
        const resolved = await xrpc(
            "GET",
            "com.atproto.identity.resolveHandle",
            { handle: live.identifier },
        )
        expect(resolved.status).toBe(200)
        const did = resolved.body.did
        expect(typeof did).toBe("string")

        // プロフィールは PDS では認証が要るため、公開の AppView で読む
        const profile = await xrpc(
            "GET",
            "app.bsky.actor.getProfile",
            { actor: live.identifier },
            undefined,
            PUBLIC_APPVIEW,
        )
        expect(profile.status).toBe(200)
        expect(profile.body.handle).toBe(live.identifier)
        expect(profile.body.did).toBe(did)
    })
})
