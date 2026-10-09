/**
 * iOS Safari（WebKit + iPhone エミュレーション）でのDropdownの、ソフトウェアキーボード表示中の挙動。
 *
 * 責務と処理概要:
 * - `specs/dropdown/tasks.md`の「iOS Safari 実機での、キーボード表示中のスクロール」の手動確認項目の
 *   うち、エミュレーションで検証できる部分を自動化する。
 * - Playwrightは仮想キーボードを再現できないため、キーボードの表示はビューポート高さの縮小で
 *   代用する（キーボードが画面下部を覆い、見える領域が縮む状況に相当する）。
 *   実機のキーボード・タッチ慣性スクロールそのものの検証にはならない（本物の実機確認は別途）。
 * - 検証内容: キーボード表示相当の縮小・スクロール・リサイズの後も、パネルは閉じず、
 *   トリガーの直下/直上に付いてきて、見える領域に収まる。親のoverflowで切れない。
 * - ファイル名の`.ios.spec.ts`は、`playwright.config.ts`でiPhoneエミュレーション用projectだけが
 *   実行する目印（デスクトップのprojectは除外する）。
 */
import { expect, test } from "./fixtures"
import type { Locator } from "@playwright/test"

const clickUntilOpen = async (trigger: Locator, target: Locator) => {
    await expect(async () => {
        await trigger.click()
        await expect(target).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
}

/**
 * パネルが親のoverflowで切れていないか（四隅・中央の最前面要素がパネル自身か）。
 * 画面に固定されたナビ等（`position: fixed`の要素）が上に重なる点は、親のクリップではなく
 * ページのスクロールで見えるようになるため、判定から除く（`specs/dropdown/requirements.md FR-2`）。
 */
const panelNotClipped = (list: Locator) =>
    list.evaluate(el => {
        const panel = el.parentElement as HTMLElement
        const r = panel.getBoundingClientRect()
        return [
            [r.left + 6, r.top + 6],
            [r.right - 6, r.bottom - 6],
            [r.left + r.width / 2, r.top + r.height / 2],
        ].map(([x, y]) => {
            const hit = document.elementFromPoint(x, y)
            if (!hit) return false
            if (panel.contains(hit)) return true
            for (let el: Element | null = hit; el; el = el.parentElement) {
                if (getComputedStyle(el).position === "fixed") return true
            }
            return false
        })
    })

/** パネルがトリガーの直下または直上にあるときの、間隔のずれ（px） */
const gapToTrigger = async (trigger: Locator, list: Locator) => {
    const t = (await trigger.boundingBox())!
    const p = (await list.boundingBox())!
    return Math.min(
        Math.abs(p.y - (t.y + t.height + 4)),
        Math.abs(t.y - (p.y + p.height + 4)),
    )
}

test.beforeEach(async ({ page }) => {
    await page.goto("/post/?guest", { timeout: 60_000 })
    await expect(page.getByRole("combobox", { name: "投稿言語" })).toBeVisible({
        timeout: 60_000,
    })
})

test("キーボード表示中（見える領域が縮んだ状態）に開くと、パネルは見える領域に収まり、スクロールしてもトリガーに付いてくる", async ({
    page,
}) => {
    const trigger = page.getByRole("combobox", { name: "投稿言語" })
    const list = page.getByRole("listbox")

    // キーボード表示相当: 見える領域を縮めてから開く
    const size = page.viewportSize()!
    await page.setViewportSize({
        width: size.width,
        height: Math.round(size.height * 0.55),
    })
    await page.waitForTimeout(300)
    await trigger.scrollIntoViewIfNeeded()
    await clickUntilOpen(trigger, list)

    // 開いた時点で、パネルは見える領域に収まる
    const vh = page.viewportSize()!.height
    const p = (await list.boundingBox())!
    expect(p.y).toBeGreaterThanOrEqual(-1)
    expect(p.y + p.height).toBeLessThanOrEqual(vh + 1)
    expect(await panelNotClipped(list)).toEqual([true, true, true])

    // スクロールしても閉じず、トリガーに付いてくる
    await page.evaluate(() => window.scrollBy(0, 40))
    await page.waitForTimeout(300)
    await expect(list).toBeVisible()
    expect(await gapToTrigger(trigger, list)).toBeLessThanOrEqual(6)
})

test("開いた後にキーボードが出て（見える領域が縮んで）スクロールしても、パネルは閉じず、トリガーに付いてくる", async ({
    page,
}) => {
    const trigger = page.getByRole("combobox", { name: "投稿言語" })
    const list = page.getByRole("listbox")
    await clickUntilOpen(trigger, list)
    // 検索モード（入力欄にフォーカス＝実機ではキーボードが出る状態）
    await trigger.click()
    await expect(trigger).toHaveAttribute("inputmode", "text")

    const size = page.viewportSize()!
    await page.setViewportSize({
        width: size.width,
        height: Math.round(size.height * 0.55),
    })
    await page.waitForTimeout(300)
    await expect(list).toBeVisible()

    await page.evaluate(() => window.scrollBy(0, 60))
    await page.waitForTimeout(300)
    await expect(list).toBeVisible()
    expect(await gapToTrigger(trigger, list)).toBeLessThanOrEqual(6)

    // キーボードが閉じて（見える領域が戻って）も、パネルは開いたまま付いてくる
    await page.setViewportSize(size)
    await page.waitForTimeout(300)
    await expect(list).toBeVisible()
    expect(await gapToTrigger(trigger, list)).toBeLessThanOrEqual(6)
})
