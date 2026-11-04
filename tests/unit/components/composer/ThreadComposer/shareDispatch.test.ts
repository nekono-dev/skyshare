// 共有先への送信の分岐（投稿先の選択ダイアログを開くか、ポップアップを開くか）を、分割の前の値で固定する（要件 1.5）。
// WebShare API と実際のポップアップは対象外。ポップアップの参照は、閉じる呼び出しを確かめるだけにする。
import { describe, expect, it, vi } from "vitest"
import {
    runShareDispatch,
    type ShareDispatchParams,
} from "@/components/composer/ThreadComposer/rules/shareDispatch"

// ブラウザ依存の実体は注入する。このテストではポップアップ/WebShare を実行しない分岐のみ見るため、
// 呼ばれたら失敗になるダミーを渡す（呼ばれないことも暗黙に確かめる）。
const unusedBrowser = {
    openIntentPopup: () => {
        throw new Error("ポップアップは呼ばれない想定")
    },
    canShareWithWebApi: () => {
        throw new Error("WebShareAPI は呼ばれない想定")
    },
    shareWithWebApi: async () => {
        throw new Error("WebShareAPI は呼ばれない想定")
    },
}

const baseParams = (
    overrides: Partial<ShareDispatchParams> = {},
): ShareDispatchParams => ({
    browser: unusedBrowser,
    text: "本文",
    skyshareUri: "at://did:example/app.bsky.feed.post/1",
    linkCardUrl: "",
    imageEntry: null,
    manualImageAttach: false,
    truncateIntentText: false,
    popupIntentInsteadOfWebshare: true,
    autoPopupTarget: "ask",
    mastodonInstanceDomain: "",
    misskeyInstanceDomain: "",
    popupWindow: null,
    ...overrides,
})

describe("runShareDispatch（共有先への送信の分岐）", () => {
    it("自動ポップアップ先が「選択」のとき、ポップアップを開かず投稿先の選択ダイアログを開く", async () => {
        const result = await runShareDispatch(baseParams())

        expect(result.openShareDialog).toBe(true)
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(false)
        expect(result.forcedAutoPopupTarget).toBeNull()
    })

    it("選択のときは、受け取った投稿ウィンドウを閉じる", async () => {
        const close = vi.fn()
        await runShareDispatch(
            baseParams({ popupWindow: { close } as unknown as Window }),
        )

        expect(close).toHaveBeenCalledTimes(1)
    })

    it("インスタンスの共有先で、ドメインが不正なとき、投稿先の選択ダイアログに委ねる", async () => {
        const result = await runShareDispatch(
            baseParams({
                autoPopupTarget: "mastodon",
                mastodonInstanceDomain: "不正な ドメイン",
            }),
        )

        expect(result.openShareDialog).toBe(true)
    })
})
