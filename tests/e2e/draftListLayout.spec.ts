/**
 * スマホ幅の投稿フォーム上部のボタンと、下書き・予約の画面のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 幅390の画面で、キャンセル・下書き・予約・投稿のボタンの文言が折り返されないことを検証する。
 * - 下書きの取得が終わるまでスピナーが出て、画面の上部に一覧が出て、閉じるのボタンが切れないことを検証する。
 * - 画像とURLを入れても、セグメントの添付の行が折り返されず、追加操作が別の行に出ることを検証する。
 * - 横幅の限られたツールバーのボタンの文字と左右余白が、スマホ幅の値になることを検証する。
 */
import type { Locator, Page } from "@playwright/test"
import { expect, test } from "./fixtures"
import { mockScheduleApi, PNG_1PX } from "./scheduleMocks"

/** 本文を入力する（ページ表示の投稿フォームは、入力が空のときキャンセルを出さない） */
const typeBody = async (page: Page, text: string) => {
    const editor = page.locator("[data-post-body-editor]").first()
    await expect(editor).toBeVisible({ timeout: 60_000 })
    await editor.click()
    await page.keyboard.type(text)
    await expect(editor).toContainText(text)
}

/** 要素の中心の縦位置（同じ行に並んでいるかの判定に使う） */
const centerY = async (locator: Locator) => {
    const box = (await locator.boundingBox())!
    return box.y + box.height / 2
}

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

test("[thread-composer/AC-19] 画面幅390で画像を添付しURLを入力しても、添付の行が1行に並び、サムネ調整とリンクカードを取得は別の行に出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    await typeBody(page, "予約テスト https://example.com")
    const segment = page.getByTestId("thread-segment-0")
    await segment
        .locator('input[type="file"][accept="image/*"]')
        .setInputFiles({
            name: "a.png",
            mimeType: "image/png",
            buffer: PNG_1PX,
        })
    const actions = page.getByTestId("thread-segment-0-media-actions")
    await expect(
        actions.getByRole("button", { name: "サムネ調整" }),
    ).toBeVisible()
    await expect(
        actions.getByRole("button", { name: "リンクカードを取得" }),
    ).toBeVisible()

    // 添付・予約・追加・言語は同じ行に並ぶ
    const row = [
        segment.locator('input[type="file"][accept="image/*"]').locator(".."),
        page.getByTestId("schedule-picker-button"),
        segment.getByRole("button", { name: "スレッドに追加" }),
        segment.locator("#thread-segment-0-language"),
    ]
    const base = await centerY(row[0]!)
    for (const control of row.slice(1)) {
        expect(Math.abs((await centerY(control)) - base)).toBeLessThan(4)
    }
    // 追加操作は、添付の行より下の別の行に出る
    expect(await centerY(actions)).toBeGreaterThan(base + 20)
})

test("[thread-composer/AC-20] 画面幅390で下書き・予約を開くと、閉じるのボタンの全体がダイアログの内側に見える", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    const open = page.getByRole("button", { name: "下書き・予約", exact: true })
    await expect(open).toBeEnabled({ timeout: 60_000 })
    const dialog = page.getByRole("dialog", { name: "下書き・予約" })
    await expect(async () => {
        await open.click()
        await expect(dialog).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    const close = dialog.getByRole("button", { name: "閉じる" })
    const closeBox = (await close.boundingBox())!
    const dialogBox = (await dialog.boundingBox())!
    expect(closeBox.y).toBeGreaterThanOrEqual(dialogBox.y)
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(
        dialogBox.y + dialogBox.height,
    )
})

test("[design-tokens/AC-7] 画面幅390で、横幅の限られたツールバーのボタンは文字が16px、青系統の左右余白が14px、白系統の左右余白が6pxになる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    await typeBody(page, "本文")
    const metrics = (locator: Locator) =>
        locator.evaluate(el => {
            const style = getComputedStyle(el)
            return {
                fontSize: style.fontSize,
                paddingLeft: style.paddingLeft,
                paddingRight: style.paddingRight,
            }
        })
    expect(await metrics(page.getByTestId("composer-submit"))).toEqual({
        fontSize: "16px",
        paddingLeft: "14px",
        paddingRight: "14px",
    })
    expect(
        await metrics(
            page.getByRole("button", { name: "キャンセル", exact: true }),
        ),
    ).toEqual({ fontSize: "16px", paddingLeft: "6px", paddingRight: "6px" })
})
