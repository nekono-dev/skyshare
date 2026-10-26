/**
 * 「タイムラインを表示しない」設定のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - `.kiro/specs/timeline-hidden` の受け入れ条件の恒久テスト。
 * - ログイン不要のゲスト表示（`?guest`）で、設定ページでの切り替え・トップページの
 *   一覧の取得の有無・新規投稿ボタンの有無・「投稿フォームを固定表示しない」の無効化を検証する。
 */
import { expect, test } from "./fixtures"
import { type Page } from "@playwright/test"

const LABEL_TIMELINE_HIDDEN = "タイムラインを表示しない"
const LABEL_PINNED = "投稿フォームを固定表示しない"
const GUEST_NOTICE = /これはゲスト表示です/

/** 全Astroアイランドのハイドレーション完了を待つ（完了すると`ssr`属性が外れる）。 */
const waitHydrated = async (page: Page) => {
    await page.waitForFunction(
        () => document.querySelector("astro-island[ssr]") === null,
    )
}

/**
 * 投稿フォームの「詳細オプション」を、閉じていれば開く。
 * 初期状態で開くかどうかはマウント後の設定読み込みで決まるため、`aria-expanded` を見て判断する。
 */
const openMoreOptions = async (page: Page) => {
    const trigger = page.getByRole("button", { name: "詳細オプション" })
    await expect(trigger).toBeVisible()
    await expect(async () => {
        if ((await trigger.getAttribute("aria-expanded")) !== "true") {
            await trigger.click()
        }
        await expect(trigger).toHaveAttribute("aria-expanded", "true", {
            timeout: 1_000,
        })
    }).toPass({ timeout: 10_000 })
}

test.describe("タイムラインを表示しない設定", () => {
    test("[timeline-hidden/1.2 timeline-hidden/2.1 timeline-hidden/2.2 timeline-hidden/2.3 timeline-hidden/1.3] 設定ページでONにすると、トップページは一覧を取得せず投稿フォームとゲスト表示の案内だけを表示し、新規投稿ボタンとハイドレーション警告が出ない", async ({
        page,
    }) => {
        await page.goto("/settings/?guest")
        await waitHydrated(page)
        const displayGroup = page.locator("section", {
            has: page.getByRole("heading", { level: 2, name: "表示" }),
        })
        const hiddenSwitch = displayGroup.getByRole("switch", {
            name: LABEL_TIMELINE_HIDDEN,
        })
        await expect(hiddenSwitch).not.toBeChecked()
        await hiddenSwitch.setChecked(true, { force: true })
        await expect
            .poll(() =>
                page.evaluate(() =>
                    window.localStorage.getItem("timelineHidden"),
                ),
            )
            .toBe("true")

        const entryRequests: string[] = []
        page.on("request", request => {
            if (new URL(request.url()).pathname === "/v2/entries/") {
                entryRequests.push(request.url())
            }
        })
        const warnings: string[] = []
        page.on("console", message => {
            if (
                ["warning", "error"].includes(message.type()) &&
                /hydrat|did not match|server-rendered/i.test(message.text())
            ) {
                warnings.push(message.text())
            }
        })

        await page.goto("/?guest")
        await waitHydrated(page)
        await expect(page.getByText(GUEST_NOTICE)).toBeVisible()
        await expect(
            page.getByRole("button", { name: "詳細オプション" }),
        ).toBeVisible()
        await expect(
            page.getByRole("button", { name: "新規投稿" }),
        ).toHaveCount(0)
        await expect(
            page.getByText("スレッドA・1件目（ルート、画像なし）です。"),
        ).toHaveCount(0)
        expect(entryRequests).toEqual([])
        expect(warnings).toEqual([])
    })

    test("[timeline-hidden/3.1 timeline-hidden/3.2] 固定表示しないをONにした後でタイムラインを表示しないをONにすると、固定表示しないのスイッチがOFFかつ操作不能になり、OFFに戻すとONの表示に戻る", async ({
        page,
    }) => {
        await page.goto("/settings/?guest")
        await waitHydrated(page)
        const pinned = page.getByRole("switch", { name: LABEL_PINNED })
        const hidden = page.getByRole("switch", { name: LABEL_TIMELINE_HIDDEN })

        await pinned.setChecked(true, { force: true })
        await expect(pinned).toBeChecked()

        await hidden.setChecked(true, { force: true })
        await expect(pinned).not.toBeChecked()
        await expect(pinned).toBeDisabled()

        // 投稿フォーム側の詳細オプションのスイッチも同じ状態になる。
        await page.goto("/?guest")
        await waitHydrated(page)
        await openMoreOptions(page)
        const composerPinned = page.getByRole("switch", { name: LABEL_PINNED })
        await expect(composerPinned).not.toBeChecked()
        await expect(composerPinned).toBeDisabled()

        await page.goto("/settings/?guest")
        await waitHydrated(page)
        await page
            .getByRole("switch", { name: LABEL_TIMELINE_HIDDEN })
            .setChecked(false, { force: true })
        await expect(
            page.getByRole("switch", { name: LABEL_PINNED }),
        ).toBeChecked()
        await expect(
            page.getByRole("switch", { name: LABEL_PINNED }),
        ).toBeEnabled()
    })
})
