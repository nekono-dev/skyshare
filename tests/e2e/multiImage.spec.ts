/**
 * 複数画像（5枚以上）添付のヘッドレスブラウザによる動作確認（specs/image-picker）。
 *
 * 責務と処理概要:
 * - `/post/?guest`の投稿フォームで、11枚選択時に10枚で止まり通知が出ること、
 *   5枚目以降に「Visual対象外」ラベルが付くこと、クロップダイアログが先頭4スロットのみで
 *   あること、先頭画像の削除でラベルが繰り上がることを検証する。
 * - `/?guest`のTimelineで、画像6枚のフィクスチャ投稿に先頭4枚のサムネイルと「+2」が
 *   表示されることを検証する（ゲスト表示では事後entry作成ボタンが無効のため、
 *   事後作成時の取得枚数は検証対象外）。
 * - 実Blueskyアカウントが必要な投稿そのもの（gallery embedの作成）は手動確認に委ねる。
 */
import { expect, test, type Page } from "@playwright/test"

const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
)

const pngFiles = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
        name: `test${i}.png`,
        mimeType: "image/png",
        buffer: PNG_1X1,
    }))

/** 投稿フォームを開き、先頭セグメントのエディタ領域を返す。 */
const openComposer = async (page: Page) => {
    await page.goto("/post/?guest")
    // 全Astroアイランド（ImagePickerを含む）のハイドレーション完了を待つ。
    // 完了したアイランドからは`ssr`属性が外れる。
    await page.waitForFunction(
        () => document.querySelector("astro-island[ssr]") === null,
    )
    const editor = page
        .getByTestId("thread-segment-0")
        .getByTestId("segment-editor")
    await expect(editor).toBeVisible()
    // Reactのハイドレーション完了前にファイルを投入するとchangeイベントが失われるため、
    // 本文入力が反映されること（=ハンドラが有効）を確認してから返す。
    const body = editor.locator("[data-post-body-editor]")
    await body.click()
    await page.keyboard.type("x")
    await expect(body).toContainText("x")
    return editor
}

test.describe("複数画像の投稿フォーム", () => {
    test("[image-picker/AC-5] 画像サムネイルの「×」「alt」ボタンは大きく縁取りされ、マウスオーバーで色が変わる", async ({
        page,
    }) => {
        const editor = await openComposer(page)
        await editor
            .locator('input[type="file"][accept="image/*"]')
            .setInputFiles(pngFiles(1))

        const thumb = page.getByTestId("image-thumb").first()
        await expect(thumb).toBeVisible()
        for (const name of [/削除/, /altテキスト/]) {
            const button = thumb.getByRole("button", { name })
            expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(
                36,
            )
            // 縁取りがあり、マウスオーバーで背景色が変わる
            await expect(button).toHaveCSS("border-top-width", "2px")
            const before = await button.evaluate(
                el => getComputedStyle(el).backgroundColor,
            )
            await button.hover()
            await expect
                .poll(() =>
                    button.evaluate(el => getComputedStyle(el).backgroundColor),
                )
                .not.toBe(before)
        }
    })

    test("[image-picker/AC-1 image-picker/AC-2 image-picker/AC-3] 11枚選択すると10枚で止まり通知が出る。5枚目以降にVisual対象外ラベルが付く", async ({
        page,
    }) => {
        const editor = await openComposer(page)
        await editor
            .locator('input[type="file"][accept="image/*"]')
            .setInputFiles(pngFiles(11))

        await expect(page.getByTestId("image-thumb")).toHaveCount(10)
        await expect(page.getByText("画像は最大10枚までです")).toBeVisible()

        const thumbs = page.getByTestId("image-thumb")
        for (let i = 0; i < 10; i++) {
            const badge = thumbs.nth(i).getByText("Visual対象外")
            if (i < 4) {
                await expect(badge).toHaveCount(0)
            } else {
                await expect(badge).toHaveCount(1)
            }
        }
    })

    test("[entry-visual/AC-6] クロップダイアログには先頭4枚のスロットだけが表示される", async ({
        page,
    }) => {
        const editor = await openComposer(page)
        await editor
            .locator('input[type="file"][accept="image/*"]')
            .setInputFiles(pngFiles(6))
        await expect(page.getByTestId("image-thumb")).toHaveCount(6)

        await editor.getByRole("button", { name: "サムネ調整" }).click()
        await expect(page.getByTestId("crop-slot")).toHaveCount(4)
    })

    test("[image-picker/AC-4] 先頭画像を削除すると、繰り上がった5枚目のラベルが消える", async ({
        page,
    }) => {
        const editor = await openComposer(page)
        await editor
            .locator('input[type="file"][accept="image/*"]')
            .setInputFiles(pngFiles(6))
        await expect(page.getByTestId("image-thumb")).toHaveCount(6)
        await expect(page.getByText("Visual対象外")).toHaveCount(2)

        await page.getByRole("button", { name: "画像1を削除" }).click()
        await expect(page.getByTestId("image-thumb")).toHaveCount(5)
        await expect(page.getByText("Visual対象外")).toHaveCount(1)
    })
})

test.describe("複数画像のTimeline表示", () => {
    test("画像6枚の投稿に全6枚のサムネイルが横スクロールで表示される", async ({
        page,
    }) => {
        await page.goto("/?guest")
        const card = page.locator("article", {
            hasText: "画像を6枚添付した投稿の表示です。",
        })
        await expect(card).toBeVisible()
        await expect(card.locator("img[loading='lazy']")).toHaveCount(6)
    })
})
