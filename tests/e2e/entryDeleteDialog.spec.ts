/**
 * Entry削除確認ダイアログ（「リンク・Bluesky投稿を削除」の最終確認・旧entryの無効化）の
 * ヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - ログイン不要のゲスト表示（`/entries/?guest`・`/?guest`）の模擬動作
 *   （`specs/entry/frontend/design.md §3.4.4`）で、削除フローの状態遷移と表示内容を検証する。
 * - ゲスト表示は削除範囲の判定・削除の実行をアプリ内で模擬するため、全シナリオで
 *   `DELETE /v2/entry`と公開APIの`getPostThread`への通信が発生しないことも検証する。
 */
import { expect, test, type Page } from "@playwright/test"

/** 禁止された通信（DELETE /v2/entry、getPostThread）を記録する。 */
const watchForbiddenRequests = async (page: Page): Promise<string[]> => {
    const hits: string[] = []
    await page.route("**/v2/entry", async route => {
        if (route.request().method() === "DELETE") {
            hits.push(`DELETE ${route.request().url()}`)
        }
        await route.continue()
    })
    await page.route("**/app.bsky.feed.getPostThread*", async route => {
        hits.push(route.request().url())
        await route.abort()
    })
    return hits
}

const dialog = (page: Page) => page.getByRole("dialog")
const postList = (page: Page) =>
    dialog(page).getByRole("region", { name: "削除予定のBluesky投稿一覧" })
const deletePostButton = (page: Page) =>
    dialog(page).getByRole("button", { name: "リンク・Bluesky投稿を削除" })

test.describe("Entry削除確認ダイアログ（ゲスト模擬）", () => {
    test("/entries: 単発entryは最終確認を経て削除され、キャンセルでは削除されない", async ({
        page,
    }) => {
        const hits = await watchForbiddenRequests(page)
        await page.goto("/entries/?guest")

        const card = page.locator('article:not([role="dialog"] *)', {
            hasText: "画像投稿で、URL発行を行った際の表示です。",
        })
        const deleteButton = card.getByRole("button", { name: "削除" })
        await expect(deleteButton).toBeEnabled()
        await deleteButton.click()

        await expect(deletePostButton(page)).toBeEnabled()
        await deletePostButton(page).click()

        // 直後には削除されず、最終確認が表示される。
        await expect(dialog(page)).toContainText("Blueskyの投稿1件を削除します")
        await expect(card).toBeVisible()

        // キャンセルで選択肢表示に戻る。
        await dialog(page).getByRole("button", { name: "キャンセル" }).click()
        await expect(deletePostButton(page)).toBeVisible()
        await expect(card).toBeVisible()

        // 再度選んで確定するとカードが消える。
        await deletePostButton(page).click()
        await dialog(page).getByRole("button", { name: "全て削除" }).click()
        await expect(card).toHaveCount(0)

        expect(hits).toEqual([])
    })

    test("/entries: 「Skyshareリンクを削除」は最終確認なしでカードが消える", async ({
        page,
    }) => {
        const hits = await watchForbiddenRequests(page)
        await page.goto("/entries/?guest")

        const card = page.locator('article:not([role="dialog"] *)', {
            hasText: "画像投稿で、URL発行を行った際の表示です。",
        })
        await card.getByRole("button", { name: "削除" }).click()
        await dialog(page)
            .getByRole("button", { name: "Skyshareリンクを削除" })
            .click()
        await expect(card).toHaveCount(0)

        expect(hits).toEqual([])
    })

    test("/entries: 編集ボタンはゲスト表示で無効のまま", async ({ page }) => {
        await page.goto("/entries/?guest")
        await expect(
            page.getByRole("button", { name: "編集" }).first(),
        ).toBeDisabled()
    })

    test("/: スレッドBは2件の投稿・第三者返信の注意が表示され、確定でスレッド全体が消える", async ({
        page,
    }) => {
        const hits = await watchForbiddenRequests(page)
        await page.goto("/?guest")

        const rootArticle = page.locator('article:not([role="dialog"] *)', {
            hasText: "スレッドB・1件目（ルート、entry作成済み）です。",
        })
        await rootArticle.getByRole("button", { name: "投稿を削除" }).click()
        await deletePostButton(page).click()

        await expect(dialog(page)).toContainText("2件の投稿")
        await expect(dialog(page)).toContainText(
            "第三者からの返信は削除されず残ります",
        )
        await dialog(page).getByRole("button", { name: "全て削除" }).click()

        await expect(
            page.getByText("スレッドB・1件目（ルート、entry作成済み）です。"),
        ).toHaveCount(0)

        expect(hits).toEqual([])
    })

    test("/: スレッドDの旧entryは「リンク・Bluesky投稿を削除」が無効で、リンク削除ではグループが残る", async ({
        page,
    }) => {
        const hits = await watchForbiddenRequests(page)
        await page.goto("/?guest")

        const rootArticle = page.locator('article:not([role="dialog"] *)', {
            hasText: "スレッドD・1件目（ルート、画像なし）です。",
        })
        await rootArticle.locator("xpath=following-sibling::button[1]").click()

        const midArticle = page.locator('article:not([role="dialog"] *)', {
            hasText: "スレッドD・2件目です。",
        })
        await midArticle.getByRole("button", { name: "投稿を削除" }).click()

        await expect(deletePostButton(page)).toBeDisabled()
        await expect(dialog(page)).toContainText("旧仕様で作成されており")

        await dialog(page)
            .getByRole("button", { name: "Skyshareリンクを削除" })
            .click()

        // スレッドグループは一覧に残り、entryの表示のみ取り除かれる。
        await expect(
            page.getByText("スレッドD・1件目（ルート、画像なし）です。"),
        ).toBeVisible()
        await expect(midArticle).toBeVisible()
        await expect(
            midArticle.getByRole("button", { name: "投稿を削除" }),
        ).toHaveCount(0)

        expect(hits).toEqual([])
    })

    test("/: 判定不能のentryは「リンク・Bluesky投稿を削除」が無効で、理由が表示される", async ({
        page,
    }) => {
        const hits = await watchForbiddenRequests(page)
        await page.goto("/?guest")

        const card = page.locator('article:not([role="dialog"] *)', {
            hasText:
                "Bluesky投稿の状態を確認できない場合の表示確認用の投稿です。",
        })
        await card.getByRole("button", { name: "投稿を削除" }).click()

        await expect(deletePostButton(page)).toBeDisabled()
        await expect(dialog(page)).toContainText("状態を確認できない")

        expect(hits).toEqual([])
    })

    test("/entries: 最終確認にのみ削除予定投稿の一覧（本文・日時・サムネイル）が表示され、キャンセル後も再表示される", async ({
        page,
    }) => {
        const hits = await watchForbiddenRequests(page)
        await page.goto("/entries/?guest")

        const card = page.locator('article:not([role="dialog"] *)', {
            hasText: "画像投稿で、URL発行を行った際の表示です。",
        })
        await card.getByRole("button", { name: "削除" }).click()

        // 最初の選択肢表示には一覧が無い。
        await expect(postList(page)).toHaveCount(0)

        await deletePostButton(page).click()
        const items = postList(page).getByRole("article")
        await expect(items).toHaveCount(1)
        await expect(items.first()).toContainText(
            "画像投稿で、URL発行を行った際の表示です。",
        )
        await expect(items.first().locator("time")).toBeVisible()
        await expect(items.first().locator("img")).toHaveCount(1)

        // キャンセルで選択肢表示に戻り、再度開くと一覧が再表示される。
        await dialog(page).getByRole("button", { name: "キャンセル" }).click()
        await expect(postList(page)).toHaveCount(0)
        await deletePostButton(page).click()
        await expect(postList(page).getByRole("article")).toHaveCount(1)

        expect(hits).toEqual([])
    })

    test("/: スレッドBの一覧は古い順の2件で、画像の無い投稿にサムネイルが無く、低い画面でもボタンを押せる", async ({
        page,
    }) => {
        const hits = await watchForbiddenRequests(page)
        await page.setViewportSize({ width: 800, height: 320 })
        await page.goto("/?guest")

        const rootArticle = page.locator('article:not([role="dialog"] *)', {
            hasText: "スレッドB・1件目（ルート、entry作成済み）です。",
        })
        await rootArticle.getByRole("button", { name: "投稿を削除" }).click()
        await deletePostButton(page).click()

        const items = postList(page).getByRole("article")
        await expect(items).toHaveCount(2)
        await expect(items.nth(0)).toContainText("スレッドB・1件目")
        await expect(items.nth(1)).toContainText("スレッドB・2件目")
        await expect(items.nth(1).locator("img")).toHaveCount(0)

        // 一覧がスクロール領域であり、確定ボタンが画面内で押下できる。
        await expect(postList(page)).toHaveCSS("overflow-y", "auto")
        // 各行が潰れていない（内容の高さが確保されている）。
        for (const index of [0, 1]) {
            const row = items.nth(index)
            const box = await row.boundingBox()
            const scrollHeight = await row.evaluate(el => el.scrollHeight)
            expect(box!.height).toBeGreaterThanOrEqual(scrollHeight)
        }
        const confirm = dialog(page).getByRole("button", {
            name: "全て削除",
        })
        await confirm.scrollIntoViewIfNeeded()
        await expect(confirm).toBeInViewport()
        await confirm.click()

        await expect(page.getByText("スレッドB・2件目です。")).toHaveCount(0)
        expect(hits).toEqual([])
    })
})
