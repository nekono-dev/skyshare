/**
 * ライブテスト: ログイン済み状態の確認。
 *
 * 責務と処理概要:
 * - セットアップで保存したセッションにより、`GET /v2/bsky/session`が
 *   検証用アカウントをアクティブアカウントとして返すことを確認する。
 */
import { expect, test } from "../fixtures"
import { loadLiveAccount } from "./env"

test("e2elive/AC-3: ログイン済み状態で検証用アカウントがアクティブになっている", async ({
    request,
}) => {
    const account = loadLiveAccount()!
    const res = await request.get("/v2/bsky/session/")
    expect(res.status()).toBe(200)
    const body = (await res.json()) as {
        accounts: { handle: string; isActive: boolean }[]
    }
    const active = body.accounts.find(a => a.isActive)
    expect(active, "アクティブなアカウント").toBeTruthy()
    // identifierがメールアドレスの場合はハンドルと一致しないため、ハンドル形式のときだけ比較する
    if (!account.identifier.includes("@")) {
        expect(active!.handle.toLowerCase()).toBe(
            account.identifier.replace(/^@/, "").toLowerCase(),
        )
    }
})
