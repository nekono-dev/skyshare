/**
 * Locks down share destination dispatch before the composer split.
 * Browser APIs are injected so tests can cover the dispatch decision without opening popups.
 */
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

describe("runShareDispatch destination dispatch", () => {
    it("opens the destination picker when the automatic popup target is ask", async () => {
        const result = await runShareDispatch(baseParams())

        expect(result.openShareDialog).toBe(true)
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(false)
        expect(result.forcedAutoPopupTarget).toBeNull()
    })

    it("closes the received post window when asking for a destination", async () => {
        const close = vi.fn()
        await runShareDispatch(
            baseParams({ popupWindow: { close } as unknown as Window }),
        )

        expect(close).toHaveBeenCalledTimes(1)
    })

    it("delegates to the destination picker when the instance domain is invalid", async () => {
        const result = await runShareDispatch(
            baseParams({
                autoPopupTarget: "mastodon",
                mastodonInstanceDomain: "不正な ドメイン",
            }),
        )

        expect(result.openShareDialog).toBe(true)
    })
})
