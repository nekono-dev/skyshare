/**
 * ライブテスト用認証情報の読み込み（`tests/e2e/live/env.ts`）の単体テスト。
 */
import { describe, expect, it } from "vitest"
import { loadLiveAccount, loadPeerAccount } from "../../e2e/live/env"

describe("loadLiveAccount", () => {
    it("e2elive/AC-2: 必須の2値が揃えば認証情報を返し、サービスの既定値はbsky.social", () => {
        expect(
            loadLiveAccount({
                SKYSHARE_E2E_IDENTIFIER: " a.bsky.social ",
                SKYSHARE_E2E_APP_PASSWORD: "aaaa-bbbb-cccc-dddd",
            }),
        ).toEqual({
            identifier: "a.bsky.social",
            password: "aaaa-bbbb-cccc-dddd",
            service: "https://bsky.social",
        })
    })

    it("サービスを指定できる", () => {
        expect(
            loadLiveAccount({
                SKYSHARE_E2E_IDENTIFIER: "a",
                SKYSHARE_E2E_APP_PASSWORD: "p",
                SKYSHARE_E2E_SERVICE: "https://pds.example",
            })?.service,
        ).toBe("https://pds.example")
    })

    it.each([
        [{}],
        [{ SKYSHARE_E2E_IDENTIFIER: "a" }],
        [{ SKYSHARE_E2E_APP_PASSWORD: "p" }],
        [{ SKYSHARE_E2E_IDENTIFIER: " ", SKYSHARE_E2E_APP_PASSWORD: "p" }],
    ])("e2elive/AC-1: 必須値が欠けていればnull（%j）", env => {
        expect(loadLiveAccount(env)).toBeNull()
    })
})

describe("loadPeerAccount", () => {
    it("必須の2値が揃えば認証情報を返す", () => {
        expect(
            loadPeerAccount({
                SKYSHARE_E2E_PEER_IDENTIFIER: "peer.bsky.social",
                SKYSHARE_E2E_PEER_APP_PASSWORD: "p",
            }),
        ).toEqual({
            identifier: "peer.bsky.social",
            password: "p",
            service: "https://bsky.social",
        })
    })

    it("どちらかが欠けていればnull", () => {
        expect(
            loadPeerAccount({ SKYSHARE_E2E_PEER_IDENTIFIER: "peer" }),
        ).toBeNull()
        expect(loadPeerAccount({})).toBeNull()
    })
})
