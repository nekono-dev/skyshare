/**
 * ライブテスト: スレッド投稿 → entry作成 → 表示 → 削除（実アカウント）。
 *
 * 責務と処理概要:
 * - 手動確認としていた次の項目を自動化する。
 *   - `specs/threadpost/tasks.md`: 複数segmentの順次投稿がBluesky上でスレッドになる／
 *     画像を含むスレッドでentryが1件だけ作られ、そのsourceがスレッド先頭を指す。
 *   - `specs/timeline/tasks.md`・`specs/entry/frontend/tasks.md`: Timelineでのスレッド折りたたみ表示、
 *     entry一覧・詳細ページの表示、「リンク・Bluesky投稿を削除」の最終確認（削除予定一覧）と
 *     確定後のスレッド全体の削除。
 * - 作成した投稿は本文の識別子（`makeRunTag`）で特定し、成否に関わらず終了時に削除する。
 */
import { expect, test } from "../fixtures"
import { loadLiveAccount } from "./env"
import { createPdsAgent, deleteByTag, makeRunTag } from "./pds"
import {
    gotoAndFindCard,
    getPublicPostText,
    getPublicThreadTexts,
    listEntries,
    makePng,
} from "./helpers"

test.describe.configure({ timeout: 120_000 })

test("e2elive/AC-10: スレッドを投稿し、entry・Timelineの表示を確認して、スレッドごと削除できる", async ({
    page,
    request,
}) => {
    const tag = makeRunTag()
    const text1 = `${tag} thread 1/3`
    const text2 = `${tag} thread 2/3`
    const text3 = `${tag} thread 3/3`

    try {
        // --- 投稿（画像付きの1件目・テキストのみの2件目・画像付きの3件目） ---
        await page.goto("/post/")
        const segment0 = page.getByTestId("thread-segment-0")
        const editor0 = segment0.getByTestId("segment-editor")
        await editor0.locator("[data-post-body-editor]").click()
        await page.keyboard.type(text1)
        await editor0
            .locator('input[type="file"][accept="image/*"]')
            .setInputFiles({
                name: "e2e.png",
                mimeType: "image/png",
                buffer: makePng(300, 200),
            })
        await expect(
            editor0.getByRole("button", { name: "サムネ調整" }),
        ).toBeVisible()

        const segment1 = page.getByTestId("thread-segment-1")
        await expect(async () => {
            await page.getByRole("button", { name: "スレッドに追加" }).click()
            await expect(segment1).toBeVisible({ timeout: 1_000 })
        }).toPass({ timeout: 15_000 })
        await segment1
            .getByTestId("segment-editor")
            .locator("[data-post-body-editor]")
            .click()
        await page.keyboard.type(text2)

        // 3件目は画像付き（画像segmentが2件になっても、entryは先頭の1件のみ作られる）
        const segment2 = page.getByTestId("thread-segment-2")
        await expect(async () => {
            await page.getByRole("button", { name: "スレッドに追加" }).click()
            await expect(segment2).toBeVisible({ timeout: 1_000 })
        }).toPass({ timeout: 15_000 })
        const editor2 = segment2.getByTestId("segment-editor")
        await editor2.locator("[data-post-body-editor]").click()
        await page.keyboard.type(text3)
        await editor2
            .locator('input[type="file"][accept="image/*"]')
            .setInputFiles({
                name: "e2e3.png",
                mimeType: "image/png",
                buffer: makePng(200, 300),
            })
        await expect(
            editor2.getByRole("button", { name: "サムネ調整" }),
        ).toBeVisible()

        await page.getByRole("button", { name: "すべて投稿" }).click()
        await expect(
            page.getByText(/Blueskyへの投稿に成功しました/),
        ).toBeVisible({ timeout: 60_000 })

        // --- entryは1件だけ作られ、sourceはスレッド先頭を指す ---
        let rootUri = ""
        await expect(async () => {
            const mine: { uri: string; sourceUri: string }[] = []
            for (const e of await listEntries(request)) {
                const t = await getPublicPostText(e.sourceUri)
                if (t?.includes(tag)) mine.push(e)
            }
            expect(mine).toHaveLength(1)
            rootUri = mine[0].sourceUri
            expect(await getPublicPostText(rootUri)).toBe(text1)
        }).toPass({ timeout: 30_000 })

        // --- Bluesky上で3件の自己返信スレッドになっている ---
        await expect
            .poll(() => getPublicThreadTexts(rootUri), { timeout: 30_000 })
            .toEqual([text1, text2, text3])

        // --- Timeline: スレッドが折りたたみ表示される ---
        await gotoAndFindCard(page, "/", text1)
        const expand = page.getByRole("button", {
            name: /スレッドを展開（2件）/,
        })
        await expect(expand.first()).toBeVisible()

        // --- entry一覧 → 詳細ページ: 3件の投稿が古い順に並ぶ ---
        const entryCard = await gotoAndFindCard(page, "/entries/", text1)
        const href = await entryCard
            .getByRole("link", { name: "Entryを開く" })
            .getAttribute("href")
        expect(href).toBeTruthy()
        await page.goto(href!)
        // ヘッダーカードにもキャプションとして本文が出るため、投稿リスト（ol）に絞る
        const list = page.locator("ol > li")
        await expect(list).toHaveCount(3, { timeout: 30_000 })
        const items = await list.allTextContents()
        expect(items[0]).toContain(text1)
        expect(items[1]).toContain(text2)
        expect(items[2]).toContain(text3)

        // --- 削除: 最終確認に削除予定の3件が並び、確定でスレッド全体が消える ---
        const card = await gotoAndFindCard(page, "/entries/", text1)
        await card.getByRole("button", { name: "削除" }).click()
        await page
            .getByRole("button", { name: "リンク・Bluesky投稿を削除" })
            .click()
        const dialog = page.getByRole("dialog")
        await expect(dialog).toContainText("スレッド（3件の投稿）")
        const rows = await dialog.locator("article").allTextContents()
        expect(rows).toHaveLength(3)
        expect(rows[0]).toContain(text1)
        expect(rows[1]).toContain(text2)
        expect(rows[2]).toContain(text3)
        await dialog.getByRole("button", { name: "全て削除" }).click()

        await expect(
            page.locator("article").filter({ hasText: text1 }),
        ).toHaveCount(0, { timeout: 30_000 })
        await expect
            .poll(() => getPublicPostText(rootUri), { timeout: 30_000 })
            .toBeNull()
    } finally {
        await deleteByTag(await createPdsAgent(loadLiveAccount()!), tag)
    }
})
