import { beforeEach, describe, expect, it, vi } from "vitest"

import { runShareDispatch } from "@/components/post/ThreadComposer/shareDispatch"
import * as webShare from "@/util/share/webShare"
import * as intent from "@/util/share/intent"

vi.mock("@/util/share/webShare", async importOriginal => {
    const actual = await importOriginal<typeof webShare>()
    return {
        ...actual,
        canShareWithWebApi: vi.fn(),
        shareWithWebApi: vi.fn(),
    }
})

vi.mock("@/util/share/intent", async importOriginal => {
    const actual = await importOriginal<typeof intent>()
    return {
        ...actual,
        openIntentPopupFor: vi.fn(),
    }
})

const ENTRY_URL = "https://skyshare.nekono.dev/entries/abc"
const LONG_TEXT = "あ".repeat(200)

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
    skyshareUri: ENTRY_URL,
    linkCardUrl: "",
    imageEntry: null,
    manualImageAttach: false,
    truncateIntentText: false,
    popupIntentInsteadOfWebshare: false,
    autoPopupTarget: "x" as const,
    mastodonInstanceDomain: "",
    popupWindow: null,
    ...overrides,
})

/** `openIntentPopupFor` に渡された共有文・宛先・オプションを取り出す。 */
const popupText = (callIndex = 0) =>
    vi.mocked(intent.openIntentPopupFor).mock.calls[callIndex][1]
const popupTarget = (callIndex = 0) =>
    vi.mocked(intent.openIntentPopupFor).mock.calls[callIndex][0]
const popupOptions = (callIndex = 0) =>
    vi.mocked(intent.openIntentPopupFor).mock.calls[callIndex][2]

beforeEach(() => {
    vi.mocked(webShare.canShareWithWebApi).mockReset()
    vi.mocked(webShare.shareWithWebApi).mockReset()
    vi.mocked(intent.openIntentPopupFor).mockReset()
})

describe("runShareDispatch - 自動ポップアップするSNS", () => {
    it("「投稿時に選択する」の場合、ポップアップ/WebShareAPIを実行せず投稿先選択ダイアログを開く", async () => {
        const close = vi.fn()
        const result = await runShareDispatch(
            buildParams({
                popupIntentInsteadOfWebshare: true,
                autoPopupTarget: "ask",
                popupWindow: { close } as unknown as Window,
            }),
        )

        expect(intent.openIntentPopupFor).not.toHaveBeenCalled()
        expect(webShare.shareWithWebApi).not.toHaveBeenCalled()
        expect(close).toHaveBeenCalledTimes(1)
        expect(result.openShareDialog).toBe(true)
        expect(result.forcedAutoPopupTarget).toBeNull()
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(false)
    })

    it.each(["x", "taittsuu", "mastodon"] as const)(
        "%sが選ばれている場合、そのSNSへ自動ポップアップする",
        async target => {
            vi.mocked(intent.openIntentPopupFor).mockReturnValue(true)
            const result = await runShareDispatch(
                buildParams({
                    popupIntentInsteadOfWebshare: true,
                    autoPopupTarget: target,
                    mastodonInstanceDomain: "example.com",
                }),
            )

            expect(popupTarget()).toBe(target)
            expect(webShare.shareWithWebApi).not.toHaveBeenCalled()
            expect(result.openShareDialog).toBe(false)
            expect(result.forcedAutoPopupTarget).toBeNull()
        },
    )

    it("Mastodonのドメインが未設定なら既定ドメインで自動ポップアップする", async () => {
        vi.mocked(intent.openIntentPopupFor).mockReturnValue(true)
        await runShareDispatch(
            buildParams({
                popupIntentInsteadOfWebshare: true,
                autoPopupTarget: "mastodon",
                mastodonInstanceDomain: "",
            }),
        )
        expect(popupOptions()?.instanceDomain).toBe("mastodon.social")
    })

    it("Mastodonのドメインが不正な場合、ポップアップを開かず投稿先選択ダイアログを開く（選択値は変更しない）", async () => {
        const result = await runShareDispatch(
            buildParams({
                popupIntentInsteadOfWebshare: true,
                autoPopupTarget: "mastodon",
                mastodonInstanceDomain: "https://example.com/",
            }),
        )

        expect(intent.openIntentPopupFor).not.toHaveBeenCalled()
        expect(result.openShareDialog).toBe(true)
        expect(result.forcedAutoPopupTarget).toBeNull()
    })

    it("ブロックされた場合、投稿先選択ダイアログを開き、選択値を「投稿時に選択する」へ変更させる", async () => {
        vi.mocked(intent.openIntentPopupFor).mockReturnValue(false)
        const result = await runShareDispatch(
            buildParams({ popupIntentInsteadOfWebshare: true }),
        )

        expect(result.openShareDialog).toBe(true)
        expect(result.forcedAutoPopupTarget).toBe("ask")
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(false)
    })

    it("ポップアップOFFの場合は選択値を参照せずWebShareAPIを試す", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(true)
        vi.mocked(webShare.shareWithWebApi).mockResolvedValue({ ok: true })
        await runShareDispatch(buildParams({ autoPopupTarget: "ask" }))

        expect(webShare.shareWithWebApi).toHaveBeenCalledTimes(1)
        expect(intent.openIntentPopupFor).not.toHaveBeenCalled()
    })
})

describe("runShareDispatch - 長文省略", () => {
    it.each(["x", "taittsuu"] as const)(
        "%s宛でONなら本文を省略する",
        async target => {
            vi.mocked(intent.openIntentPopupFor).mockReturnValue(true)
            await runShareDispatch(
                buildParams({
                    popupIntentInsteadOfWebshare: true,
                    autoPopupTarget: target,
                    text: LONG_TEXT,
                    truncateIntentText: true,
                }),
            )

            expect(popupText().endsWith(`...\n${ENTRY_URL}`)).toBe(true)
            expect(popupText().length).toBeLessThan(LONG_TEXT.length)
        },
    )

    it("OFFなら省略しない", async () => {
        vi.mocked(intent.openIntentPopupFor).mockReturnValue(true)
        await runShareDispatch(
            buildParams({
                popupIntentInsteadOfWebshare: true,
                text: LONG_TEXT,
                truncateIntentText: false,
            }),
        )
        expect(popupText()).toBe(`${LONG_TEXT}\n${ENTRY_URL}`)
    })

    it("Mastodon宛はONでも省略しない", async () => {
        vi.mocked(intent.openIntentPopupFor).mockReturnValue(true)
        await runShareDispatch(
            buildParams({
                popupIntentInsteadOfWebshare: true,
                autoPopupTarget: "mastodon",
                mastodonInstanceDomain: "example.com",
                text: LONG_TEXT,
                truncateIntentText: true,
            }),
        )
        expect(popupText()).toBe(`${LONG_TEXT}\n${ENTRY_URL}`)
    })

    it("skyshare URLが無くても、ONなら本文のみを省略する", async () => {
        vi.mocked(intent.openIntentPopupFor).mockReturnValue(true)
        await runShareDispatch(
            buildParams({
                popupIntentInsteadOfWebshare: true,
                manualImageAttach: true,
                text: LONG_TEXT,
                truncateIntentText: true,
            }),
        )
        expect(popupText().endsWith("...")).toBe(true)
        expect(popupText().length).toBeLessThan(LONG_TEXT.length)
    })

    it("WebShareAPIに渡す共有文は省略しない", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(true)
        vi.mocked(webShare.shareWithWebApi).mockResolvedValue({ ok: true })
        await runShareDispatch(
            buildParams({ text: LONG_TEXT, truncateIntentText: true }),
        )

        const shared = vi.mocked(webShare.shareWithWebApi).mock.calls[0][0]
        expect(shared.text).toBe(`${LONG_TEXT}\n${ENTRY_URL}`)
    })

    it("WebShareAPI非対応でXポップアップへフォールバックする場合は省略する", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(false)
        vi.mocked(intent.openIntentPopupFor).mockReturnValue(true)
        await runShareDispatch(
            buildParams({ text: LONG_TEXT, truncateIntentText: true }),
        )

        expect(popupTarget()).toBe("x")
        expect(popupText().endsWith(`...\n${ENTRY_URL}`)).toBe(true)
    })
})

describe("runShareDispatch - WebShareAPIフォールバック", () => {
    it("WebShareAPI非対応の場合、即時にXポップアップを試行し、ポップアップONとX選択へ変更させる", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(false)
        vi.mocked(intent.openIntentPopupFor).mockReturnValue(true)

        const result = await runShareDispatch(buildParams())

        expect(webShare.shareWithWebApi).not.toHaveBeenCalled()
        expect(intent.openIntentPopupFor).toHaveBeenCalledTimes(1)
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(true)
        expect(result.forcedAutoPopupTarget).toBe("x")
        expect(result.openShareDialog).toBe(false)
    })

    it("WebShareAPI非対応かつXポップアップも開けない場合、投稿先選択ダイアログを開き、「投稿時に選択する」へ変更させる", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(false)
        vi.mocked(intent.openIntentPopupFor).mockReturnValue(false)

        const result = await runShareDispatch(buildParams())

        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(true)
        expect(result.forcedAutoPopupTarget).toBe("ask")
        expect(result.openShareDialog).toBe(true)
    })

    it("WebShareAPI対応環境で実際の共有に失敗した場合、即時にXポップアップを試行する", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(true)
        vi.mocked(webShare.shareWithWebApi).mockResolvedValue({
            ok: false,
            reason: "failed",
        })
        vi.mocked(intent.openIntentPopupFor).mockReturnValue(true)

        const result = await runShareDispatch(buildParams())

        expect(webShare.shareWithWebApi).toHaveBeenCalledTimes(1)
        expect(intent.openIntentPopupFor).toHaveBeenCalledTimes(1)
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(true)
        expect(result.forcedAutoPopupTarget).toBe("x")
        expect(result.openShareDialog).toBe(false)
    })

    it("WebShareAPI対応環境で共有に失敗し、Xポップアップも開けない場合、投稿先選択ダイアログを開く", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(true)
        vi.mocked(webShare.shareWithWebApi).mockResolvedValue({
            ok: false,
            reason: "failed",
        })
        vi.mocked(intent.openIntentPopupFor).mockReturnValue(false)

        const result = await runShareDispatch(buildParams())

        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(true)
        expect(result.forcedAutoPopupTarget).toBe("ask")
        expect(result.openShareDialog).toBe(true)
    })

    it("WebShareAPI対応環境で共有シートがキャンセルされた場合、Xポップアップは試行せず設定も変更しない", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(true)
        vi.mocked(webShare.shareWithWebApi).mockResolvedValue({
            ok: false,
            reason: "aborted",
        })

        const result = await runShareDispatch(buildParams())

        expect(intent.openIntentPopupFor).not.toHaveBeenCalled()
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(false)
        expect(result.forcedAutoPopupTarget).toBeNull()
        expect(result.openShareDialog).toBe(false)
    })

    it("WebShareAPI対応環境で共有に成功した場合、Xポップアップは試行しない", async () => {
        vi.mocked(webShare.canShareWithWebApi).mockReturnValue(true)
        vi.mocked(webShare.shareWithWebApi).mockResolvedValue({ ok: true })

        const result = await runShareDispatch(buildParams())

        expect(intent.openIntentPopupFor).not.toHaveBeenCalled()
        expect(result.forcedPopupIntentInsteadOfWebshareOn).toBe(false)
        expect(result.forcedAutoPopupTarget).toBeNull()
        expect(result.openShareDialog).toBe(false)
    })
})
