/**
 * スマホ幅の投稿フォーム上部のボタンと、下書き・予約の画面のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 幅390の画面で、キャンセル・下書き・予約・投稿のボタンの文言が折り返されないことを検証する。
 * - 下書きの取得が終わるまでスピナーが出て、画面の上部に一覧が出ることを検証する。
 */
import { expect, test } from "./fixtures"
import { mockScheduleApi } from "./scheduleMocks"

test.use({ viewport: { width: 390, height: 844 } })

test("[thread-composer/AC-17] 画面幅390のとき、キャンセル・下書き・予約・投稿のボタンの文言がそれぞれ1行に収まる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    // ページ表示の投稿フォームは、入力が空のときキャンセルを出さない
    await page.locator("[data-post-body-editor]").first().click()
    await page.keyboard.type("本文")
    // 最も長い文言（すべて投稿）で確認するため、スレッドにする
    await page.getByRole("button", { name: "スレッドに追加" }).click()
    await expect(page.getByTestId("composer-submit")).toHaveText("すべて投稿")
    const buttons = [
        page.getByRole("button", { name: "キャンセル", exact: true }),
        page.getByRole("button", { name: "下書き・予約", exact: true }),
        page.getByTestId("composer-submit"),
    ]
    const boxes: { x: number; width: number }[] = []
    for (const button of buttons) {
        await expect(button).toBeVisible({ timeout: 60_000 })
        // 文言は折り返さず、1行の高さに収まる
        const lines = await button.evaluate(el => {
            const style = getComputedStyle(el)
            const inner =
                el.clientHeight -
                parseFloat(style.paddingTop) -
                parseFloat(style.paddingBottom)
            return Math.round(inner / parseFloat(style.lineHeight))
        })
        expect(lines).toBeLessThanOrEqual(1)
        boxes.push((await button.boundingBox())!)
    }
    // 折り返しを避けても、ボタン同士が重ならず、フォームの幅からはみ出さない
    const [cancel, drafts, submit] = boxes as [
        { x: number; width: number },
        { x: number; width: number },
        { x: number; width: number },
    ]
    expect(cancel.x + cancel.width).toBeLessThanOrEqual(drafts.x)
    expect(drafts.x + drafts.width).toBeLessThanOrEqual(submit.x)
    expect(submit.x + submit.width).toBeLessThanOrEqual(390)
})

test("[thread-composer/AC-18] 画面幅390で下書き・予約を開くと、取得が終わるまでスピナーが出て、画面の上部に一覧が出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    // 下書きの取得を遅らせて、読み込み中の表示を確認する
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => {
        release = resolve
    })
    await page.route(/\/v2\/bsky\/drafts\/?(\?.*)?$/, async route => {
        await gate
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ drafts: [] }),
        })
    })
    await page.goto("/post/")
    const open = page.getByRole("button", { name: "下書き・予約", exact: true })
    await expect(open).toBeEnabled({ timeout: 60_000 })
    await expect(async () => {
        await open.click()
        await expect(
            page.getByRole("dialog", { name: "下書き・予約" }),
        ).toBeVisible({
            timeout: 2_000,
        })
    }).toPass({ timeout: 20_000 })

    const dialog = page.getByRole("dialog", { name: "下書き・予約" })
    await expect(dialog.getByRole("status")).toBeVisible()
    const box = await dialog.boundingBox()
    // 画面の上部に固定される（中央寄せなら上端が大きく下がる）
    expect(box!.y).toBeLessThan(64)

    release()
    await expect(dialog.getByRole("status")).toHaveCount(0)
    await expect(dialog.getByText("下書きがありません。")).toBeVisible()
})
