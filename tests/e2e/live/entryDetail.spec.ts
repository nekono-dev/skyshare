/**
 * ライブテスト: 実PDS上のEntryの詳細ページ（`entries/[slug].astro`）の表示。
 *
 * 責務と処理概要:
 * - `specs/postcardlayout/tasks.md`の「実PDS上のEntryでの`[slug].astro`の表示確認」を自動化する
 *   （受け入れ条件は`specs/postcardlayout/requirements.md`）。前提の投稿・entryはPDSへ直接作る。
 *   - 単発投稿（画像1枚）: 投稿カード1件、画像はサムネイル、タップで拡大表示が開き、
 *     Escで閉じてフォーカスがサムネイルへ戻る。
 *   - スレッド（画像1・3・4枚）: 投稿ごとの独立したカードが古い順にすべて展開された状態で並び、
 *     枚数ごとのサムネイルが表示される。360px幅でページ全体に横スクロールが出ない。
 *   - JavaScriptを無効にしても、投稿カードとサムネイルが表示される（NFR-1）。
 * - 画像5枚以上のEntry（gallery）は`multiImage.spec.ts`で確認する。
 */
import { expect, test } from "./liveTest"
import { gotoAndFindCard, makePng } from "./helpers"
import { createEntryRecord, createPost, createThread } from "./pds"

test.describe.configure({ timeout: 180_000 })

/** `/entries/`のカードから、そのEntryの詳細ページのパスを取得する */
const detailPath = async (
    page: import("@playwright/test").Page,
    text: string,
) => {
    const card = await gotoAndFindCard(page, "/entries/", text)
    const href = await card
        .getByRole("link", { name: "Entryを開く" })
        .getAttribute("href")
    expect(href).toBeTruthy()
    return href!
}

test("単発投稿のEntry詳細: 投稿カード1件・サムネイル・拡大表示の開閉とフォーカス復帰", async ({
    page,
    agent,
    tag,
}) => {
    const text = `${tag} detail single`
    const post = await createPost(agent, { text, images: [makePng(400, 300)] })
    await createEntryRecord(agent, {
        source: post,
        visual: makePng(1200, 630),
        caption: text,
    })

    await page.goto(await detailPath(page, text))
    const items = page.locator("ol > li")
    await expect(items).toHaveCount(1, { timeout: 60_000 })
    await expect(items.first()).toContainText(text)
    await expect(page.getByTestId("entry-visual")).toBeVisible()

    const thumb = items.first().getByRole("button", { name: "画像1/1を拡大" })
    await expect(thumb).toBeVisible()
    await thumb.click()
    const dialog = page.getByRole("dialog", { name: "画像の拡大表示" })
    await expect(dialog).toBeVisible()
    // 1枚の拡大表示には切り替え操作・位置表示が無い
    await expect(dialog.getByRole("button", { name: "次の画像" })).toHaveCount(
        0,
    )
    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect(thumb).toBeFocused()
})

test("スレッドのEntry詳細: 投稿ごとのカードが古い順にすべて展開され、枚数ごとのサムネイルが出る。360px幅で横スクロールが出ない", async ({
    page,
    agent,
    tag,
}) => {
    const t = (n: number) => `${tag} detail thread ${n}/3`
    const posts = await createThread(agent, [
        { text: t(1), images: [makePng(400, 300)] },
        {
            text: t(2),
            images: [makePng(300, 400), makePng(300, 300), makePng(400, 300)],
        },
        {
            text: t(3),
            images: [
                makePng(300, 300),
                makePng(400, 300),
                makePng(300, 400),
                makePng(500, 300),
            ],
        },
    ])
    await createEntryRecord(agent, {
        source: posts[0],
        visual: makePng(1200, 630),
        caption: t(1),
    })

    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto(await detailPath(page, t(1)))
    const items = page.locator("ol > li")
    await expect(items).toHaveCount(3, { timeout: 60_000 })
    const texts = await items.allTextContents()
    expect(texts[0]).toContain(t(1))
    expect(texts[1]).toContain(t(2))
    expect(texts[2]).toContain(t(3))

    // 枚数ごとのサムネイル（1・3・4枚）
    for (const [i, count] of [1, 3, 4].entries()) {
        await expect(
            items.nth(i).getByRole("button", { name: /を拡大/ }),
        ).toHaveCount(count)
    }

    // ページ全体に横スクロールが出ない
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow).toBe(false)
})

test("JavaScriptを無効にしても、Entry詳細の投稿カードとサムネイルが表示される", async ({
    page,
    browser,
    agent,
    tag,
}) => {
    const text = `${tag} detail nojs`
    const post = await createPost(agent, { text, images: [makePng(400, 300)] })
    await createEntryRecord(agent, {
        source: post,
        visual: makePng(1200, 630),
        caption: text,
    })
    const path = await detailPath(page, text)

    // ログイン済みのCookieを引き継ぎ、JavaScriptだけを無効にした文脈で開く
    const context = await browser.newContext({
        storageState: await page.context().storageState(),
        javaScriptEnabled: false,
        ignoreHTTPSErrors: true,
        baseURL: "https://localhost:4321",
    })
    try {
        const noJs = await context.newPage()
        await noJs.goto(path)
        const items = noJs.locator("ol > li")
        await expect(items).toHaveCount(1, { timeout: 60_000 })
        await expect(items.first()).toContainText(text)
        await expect(items.first().locator("img")).not.toHaveCount(0)
    } finally {
        await context.close()
    }
})
