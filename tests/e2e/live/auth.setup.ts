/**
 * ライブテストの事前ログイン（セットアップ）。
 *
 * 責務と処理概要:
 * - `loadLiveAccount()`の認証情報で`POST /v2/bsky/session`を1回だけ呼び、
 *   セッションCookieを含むブラウザ状態を`LIVE_STORAGE_STATE`へ保存する。
 *   以降のライブテストはこの状態から始まるため、テストごとにログインしない。
 * - 失敗時のエラーにはHTTPステータスのみを含め、認証情報は出力しない。
 * - 続けてPDSエージェントで前回の取りこぼしを掃除する（`specs/e2elive/design.md §7`）。
 */
import { expect, test as setup } from "../fixtures"
import { LIVE_STORAGE_STATE, loadLiveAccount, loadPeerAccount } from "./env"
import { createPdsAgent, sweepStale } from "./pds"

setup("検証用アカウントでログインする", async ({ request }) => {
    const account = loadLiveAccount()
    // projectは認証情報があるときだけ登録されるため、ここで`null`になることは通常ない
    expect(account, "検証用アカウントの認証情報が未設定").not.toBeNull()

    const res = await request.post("/v2/bsky/session/", {
        data: {
            identifier: account!.identifier,
            password: account!.password,
            service: account!.service,
        },
    })
    expect(res.status(), "ログインAPIのステータス").toBe(200)

    await request.storageState({ path: LIVE_STORAGE_STATE })

    // 異常終了した前回の取りこぼし（1時間より古い`[e2e `形式の投稿・entry）を回収する
    const agent = await createPdsAgent(account!)
    await sweepStale(agent)
    // 第三者アカウントが設定されていれば、その取りこぼしも回収する
    const peer = loadPeerAccount()
    if (peer) await sweepStale(await createPdsAgent(peer, "peer"))
})
