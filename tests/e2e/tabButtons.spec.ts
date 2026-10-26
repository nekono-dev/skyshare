/**
 * 共通のタブ部品（TabButtons）と、投稿フォームの下書き・予約の画面のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 下書き・予約の画面を開き、初期のタブ・選択中の見た目・押下とキー操作での切り替え・
 *   中身の表示の切り替え・狭い画面の寸法を検証する。
 */
import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"
import { mockScheduleApi } from "./scheduleMocks"

const openDraftsDialog = async (page: Page) => {
    const open = page.getByRole("button", { name: "下書き・予約", exact: true })
    await expect(open).toBeEnabled({ timeout: 60_000 })
    await expect(async () => {
        await open.click()
        await expect(page.getByRole("tablist")).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    return {
        drafts: page.getByRole("tab", { name: "下書き" }),
        schedules: page.getByRole("tab", { name: "予約" }),
    }
}

test("[thread-composer/4.2 tab-buttons/1.1] 下書き・予約の画面に2つのタブがあり、初めは下書きが選ばれ、選択中だけが太字と下線になる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    const { drafts, schedules } = await openDraftsDialog(page)
    await expect(drafts).toHaveAttribute("aria-selected", "true")
    await expect(schedules).toHaveAttribute("aria-selected", "false")
    const style = (tab: typeof drafts) =>
        tab.evaluate(el => {
            const s = getComputedStyle(el)
            return {
                weight: Number(s.fontWeight),
                underline:
                    s.borderBottomStyle !== "none" &&
                    s.borderBottomColor !== "rgba(0, 0, 0, 0)",
            }
        })
    expect(await style(drafts)).toEqual({ weight: 700, underline: true })
    const other = await style(schedules)
    expect(other.weight).toBeLessThan(700)
    expect(other.underline).toBe(false)
})

test("[tab-buttons/1.2 tab-buttons/2.1] タブを押すと選択と中身が移り、矢印キーで隣のタブへ移る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    const { drafts, schedules } = await openDraftsDialog(page)
    await schedules.click()
    await expect(schedules).toHaveAttribute("aria-selected", "true")
    await expect(page.getByTestId("schedule-list")).toBeVisible()
    await expect(page.getByText("予約はありません。")).toBeVisible()

    // 右の矢印キーは端で先頭へ戻り、フォーカスも移る
    await schedules.press("ArrowRight")
    await expect(drafts).toHaveAttribute("aria-selected", "true")
    await expect(drafts).toBeFocused()
    await expect(page.getByTestId("schedule-list")).toBeHidden()
    await drafts.press("End")
    await expect(schedules).toHaveAttribute("aria-selected", "true")
})

test.describe("狭い画面", () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test("[tab-buttons/1.3] 画面幅390のとき、各タブの高さが44ピクセル以上", async ({
        page,
    }) => {
        test.setTimeout(90_000)
        await mockScheduleApi(page)
        await page.goto("/post/")
        const { drafts, schedules } = await openDraftsDialog(page)
        for (const tab of [drafts, schedules]) {
            const box = (await tab.boundingBox())!
            expect(box.height).toBeGreaterThanOrEqual(44)
        }
    })
})
