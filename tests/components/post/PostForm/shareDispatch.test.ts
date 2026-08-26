import { beforeEach, describe, expect, it, vi } from "vitest"

import { runShareDispatch } from "@/components/post/PostForm/shareDispatch"
import * as webShare from "@/util/share/webShare"
import * as xIntent from "@/util/share/xIntent"

vi.mock("@/util/share/webShare", async importOriginal => {
    const actual = await importOriginal<typeof webShare>()
    return {
        ...actual,
        canShareWithWebApi: vi.fn(),
        shareWithWebApi: vi.fn(),
    }
})

vi.mock("@/util/share/xIntent", async importOriginal => {
    const actual = await importOriginal<typeof xIntent>()
    return {
        ...actual,
        openXIntentPopup: vi.fn(),
    }
})

/**
 * テスト用の基底パラメータを組み立てる。
 *
 * Input:
 * - `overrides`: 基底パラメータから上書きしたいフィールド
 *
 * Output:
 * - `runShareDispatch` に渡せる `ShareDispatchParams`
 */
const buildParams = (
    overrides: Partial<Parameters<typeof runShareDispatch>[0]> = {},
) => ({
    text: "投稿本文",
    skyshareUri: "at://example",
    imageEntry: null,
    manualImageAttach: false,
    crosspostToTaittsuu: false,
    crosspostToMastodon: false,
    mastodonInstanceDomain: "",
    popupIntentInsteadOfWebshare: false,
    noAutoPopupAfterPost: false,
    ...overrides,
})

describe("runShareDispatch - WebShareAPIフォールバック", () => {
    beforeEach(() => {
        vi.mocked(webShare.canShareWithWebApi).mockReset()
        vi.mocked(webShare.shareWithWebApi).mockReset()
        vi.mocked(xIntent.openXIntentPopup).mockReset()
    })

    it("WebShareAPI非対応の場合、即時にXポップアップを試行しPopupIntentInsteadOfWebshareをONにする", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(false)
        vi.mocked(xIntent.openXIntentPopup).mockReturnValue(true)

        const result = await runShareDispatch(buildParams())

        expect(webShare.shareWithWebApi).not.toHaveBeenCalled()
        expect(xIntent.openXIntentPopup).toHaveBeenCalledTimes(1)
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(true)
        expect(result.forcedNoAutoPopupOn).toBe(false)
        expect(result.forcedShowXIntentButtonOn).toBe(false)
        expect(result.textToKeep).toBeNull()
    })

    it("WebShareAPI非対応かつXポップアップも開けない場合、NoAutoPopupAfterPost/ShowXIntentButtonも強制ONにする", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(false)
        vi.mocked(xIntent.openXIntentPopup).mockReturnValue(false)

        const result = await runShareDispatch(buildParams())

        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(true)
        expect(result.forcedNoAutoPopupOn).toBe(true)
        expect(result.forcedShowXIntentButtonOn).toBe(true)
        expect(result.textToKeep).not.toBeNull()
    })

    it("WebShareAPI対応環境で実際の共有に失敗した場合、即時にXポップアップを試行する", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(true)
        vi.mocked(webShare.shareWithWebApi).mockResolvedValue({
            ok: false,
            reason: "failed",
        })
        vi.mocked(xIntent.openXIntentPopup).mockReturnValue(true)

        const result = await runShareDispatch(buildParams())

        expect(webShare.shareWithWebApi).toHaveBeenCalledTimes(1)
        expect(xIntent.openXIntentPopup).toHaveBeenCalledTimes(1)
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(true)
        expect(result.forcedNoAutoPopupOn).toBe(false)
        expect(result.forcedShowXIntentButtonOn).toBe(false)
        expect(result.textToKeep).toBeNull()
    })

    it("WebShareAPI対応環境で共有に失敗し、Xポップアップも開けない場合、NoAutoPopupAfterPost/ShowXIntentButtonを強制ONにする", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(true)
        vi.mocked(webShare.shareWithWebApi).mockResolvedValue({
            ok: false,
            reason: "failed",
        })
        vi.mocked(xIntent.openXIntentPopup).mockReturnValue(false)

        const result = await runShareDispatch(buildParams())

        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(true)
        expect(result.forcedNoAutoPopupOn).toBe(true)
        expect(result.forcedShowXIntentButtonOn).toBe(true)
        expect(result.textToKeep).not.toBeNull()
    })

    it("WebShareAPI対応環境で共有シートがキャンセルされた場合、Xポップアップは試行せずトグルも変更しない", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(true)
        vi.mocked(webShare.shareWithWebApi).mockResolvedValue({
            ok: false,
            reason: "aborted",
        })

        const result = await runShareDispatch(buildParams())

        expect(xIntent.openXIntentPopup).not.toHaveBeenCalled()
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(false)
        expect(result.forcedNoAutoPopupOn).toBe(false)
        expect(result.forcedShowXIntentButtonOn).toBe(false)
    })

    it("WebShareAPI対応環境で共有に成功した場合、Xポップアップは試行しない", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(true)
        vi.mocked(webShare.shareWithWebApi).mockResolvedValue({ ok: true })

        const result = await runShareDispatch(buildParams())

        expect(xIntent.openXIntentPopup).not.toHaveBeenCalled()
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(false)
        expect(result.textToKeep).toBeNull()
    })
})
