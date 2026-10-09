/**
 * 画像サムネイル（`ImageGallery`）と拡大表示（`ImageLightbox`）のヘッドレスブラウザによる動作確認
 * （specs/image-gallery）。
 *
 * - `entries/sample/` の投稿のうち、画像付きの3投稿（画像1・3・5枚）を使う。
 */
import { expect, test } from "./fixtures"
import { type Page } from "@playwright/test"

const gotoThread = async (page: Page) => {
    await page.goto("/entries/sample/")
    await expect(page.getByText("スレッド3件目です。")).toBeVisible()
}

const card = (page: Page, text: string) => page.locator("li", { hasText: text })

test.describe("サムネイルのレイアウト", () => {
    test("[image-gallery/AC-1] 1枚はクランプ済みの縦横比で object-fit: cover", async ({
        page,
    }) => {
        await gotoThread(page)
        const button = card(page, "スレッド1件目").getByRole("button", {
            name: "画像1/1を拡大",
        })
        const box = await button.locator("..").boundingBox()
        expect(box!.width / box!.height).toBeCloseTo(1200 / 630, 1)
        await expect(button.locator("img")).toHaveCSS("object-fit", "cover")
    })

    test("[image-gallery/AC-2] 3枚は 2:1 のコンテナで左1枚・右2枚", async ({
        page,
    }) => {
        await gotoThread(page)
        const buttons = card(page, "スレッド2件目").getByRole("button", {
            name: /を拡大/,
        })
        await expect(buttons).toHaveCount(3)
        const container = await buttons.first().locator("..").boundingBox()
        expect(container!.width / container!.height).toBeCloseTo(2, 1)
        const [a, b, c] = await Promise.all(
            [0, 1, 2].map(i => buttons.nth(i).boundingBox()),
        )
        expect(a!.height).toBeGreaterThan(b!.height * 1.5)
        expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1)
        expect(c!.y).toBeGreaterThan(b!.y)
    })

    test("[image-gallery/AC-3] 5枚は高さ固定の横スクロールで縦横比を維持する", async ({
        page,
    }) => {
        // 5枚の合計幅がカード幅を超える幅（モバイル幅）で確認する
        await page.setViewportSize({ width: 480, height: 900 })
        await gotoThread(page)
        const buttons = card(page, "スレッド3件目").getByRole("button", {
            name: /を拡大/,
        })
        await expect(buttons).toHaveCount(5)
        const strip = buttons.first().locator("..")
        const overflow = await strip.evaluate(el => ({
            scrollable: el.scrollWidth > el.clientWidth,
            height: el.clientHeight,
        }))
        expect(overflow.scrollable).toBe(true)
        expect(overflow.height).toBe(160)
        const ratios = [1200 / 630, 600 / 800, 1, 800 / 600, 400 / 900]
        for (let i = 0; i < 5; i++) {
            const box = await buttons.nth(i).boundingBox()
            expect(box!.width / box!.height).toBeCloseTo(ratios[i], 1)
        }
    })
})

test.describe("拡大表示", () => {
    test("[image-gallery/AC-5 image-gallery/AC-6 image-gallery/AC-7] 開く・矢印キーで切り替え・位置表示・先頭で前ボタン無効", async ({
        page,
    }) => {
        await gotoThread(page)
        await card(page, "スレッド2件目")
            .getByRole("button", { name: "画像1/3を拡大" })
            .click()
        const dialog = page.getByRole("dialog", { name: "画像の拡大表示" })
        await expect(dialog).toBeVisible()
        await expect(dialog.getByText("1/3")).toBeVisible()
        await expect(dialog.getByText("threeの画像1")).toBeVisible()
        await expect(
            dialog.getByRole("button", { name: "前の画像" }),
        ).toBeDisabled()
        await page.keyboard.press("ArrowRight")
        await expect(dialog.getByText("2/3")).toBeVisible()
        await page.keyboard.press("ArrowLeft")
        await expect(dialog.getByText("1/3")).toBeVisible()
        await dialog.getByRole("button", { name: "次の画像" }).click()
        await expect(dialog.getByText("2/3")).toBeVisible()
    })

    test("[image-gallery/AC-6] スワイプで次の画像になる", async ({ page }) => {
        await gotoThread(page)
        await card(page, "スレッド2件目")
            .getByRole("button", { name: "画像1/3を拡大" })
            .click()
        const area = page.getByRole("dialog").locator("[data-current=true] img")
        const box = (await area.boundingBox())!
        const y = box.y + box.height / 2
        await page.mouse.move(box.x + box.width * 0.8, y)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.2, y, { steps: 5 })
        await page.mouse.up()
        await expect(page.getByRole("dialog").getByText("2/3")).toBeVisible()
    })

    test("スワイプ中は画像が指に追従し、閾値未満なら元に戻る", async ({
        page,
    }) => {
        await gotoThread(page)
        await card(page, "スレッド2件目")
            .getByRole("button", { name: "画像1/3を拡大" })
            .click()
        const dialog = page.getByRole("dialog")
        const img = dialog.locator("[data-current=true] img")
        await expect(img).toBeVisible()
        await page.waitForTimeout(400)
        const before = (await img.boundingBox())!
        const y = before.y + before.height / 2
        await page.mouse.move(before.x + 200, y)
        await page.mouse.down()
        await page.mouse.move(before.x + 160, y, { steps: 4 })
        const during = (await img.boundingBox())!
        expect(during.x).toBeLessThan(before.x - 30)
        await page.mouse.up()
        await expect(dialog.getByText("1/3")).toBeVisible()
        await expect
            .poll(async () => Math.abs((await img.boundingBox())!.x - before.x))
            .toBeLessThan(1)
    })

    test("先頭で右へスワイプしても切り替わらない", async ({ page }) => {
        await gotoThread(page)
        await card(page, "スレッド2件目")
            .getByRole("button", { name: "画像1/3を拡大" })
            .click()
        const dialog = page.getByRole("dialog")
        const box = (await dialog
            .locator("[data-current=true] img")
            .boundingBox())!
        const y = box.y + box.height / 2
        await page.mouse.move(box.x + box.width * 0.2, y)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.8, y, { steps: 5 })
        await page.mouse.up()
        await expect(dialog.getByText("1/3")).toBeVisible()
    })

    for (const how of ["閉じるボタン", "Esc", "背景クリック"] as const) {
        test(`[image-gallery/AC-8 image-gallery/AC-12] ${how}で閉じ、フォーカスが開いたサムネイルへ戻る`, async ({
            page,
        }) => {
            await gotoThread(page)
            const thumb = card(page, "スレッド2件目").getByRole("button", {
                name: "画像2/3を拡大",
            })
            await thumb.click()
            const dialog = page.getByRole("dialog")
            await expect(dialog).toBeVisible()
            if (how === "閉じるボタン")
                await dialog.getByRole("button", { name: "閉じる" }).click()
            else if (how === "Esc") await page.keyboard.press("Escape")
            else await page.mouse.click(5, 300)
            await expect(dialog).toHaveCount(0)
            await expect(thumb).toBeFocused()
        })
    }

    test("[image-gallery/AC-8] 拡大表示中は背面がスクロールしない", async ({
        page,
    }) => {
        await gotoThread(page)
        await card(page, "スレッド3件目")
            .getByRole("button", { name: "画像1/5を拡大" })
            .click()
        const before = await page.evaluate(() => window.scrollY)
        await page.mouse.wheel(0, 600)
        await page.waitForTimeout(200)
        expect(await page.evaluate(() => window.scrollY)).toBe(before)
    })

    test("[image-gallery/AC-6] 1枚の投稿では前後ボタンと位置表示が無い", async ({
        page,
    }) => {
        await gotoThread(page)
        await card(page, "スレッド1件目")
            .getByRole("button", { name: "画像1/1を拡大" })
            .click()
        const dialog = page.getByRole("dialog")
        await expect(dialog).toBeVisible()
        await expect(
            dialog.getByRole("button", { name: "前の画像" }),
        ).toHaveCount(0)
        await expect(
            dialog.getByRole("button", { name: "次の画像" }),
        ).toHaveCount(0)
        await expect(dialog.getByText("1/1")).toHaveCount(0)
    })
})
