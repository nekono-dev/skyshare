/**
 * ライブテスト: 5枚以上の画像投稿（実アカウント）。
 *
 * 責務と処理概要:
 * - `specs/multiimage/tasks.md`の手動確認項目を自動化する。色の違う5枚の画像を添付して投稿し、
 *   - 投稿レコードが`app.bsky.embed.gallery`で、画像5枚が保存されること、
 *   - 公開AppViewのビュー（公式アプリが描画に使う形）でも画像5枚を持つこと、
 *   - entryが作成され、visualは先頭4枚だけから合成される（5枚目の色が含まれない）こと
 *   を確認する。
 * - 作成した投稿は`liveTest`のフィクスチャが終了時に削除する。
 */
import { expect, test } from "./liveTest"
import {
    colorFractions,
    gotoAndFindCard,
    type EntryListItem,
    getPublicPostEmbedView,
    getPublicPostRecord,
    listEntries,
    makeSolidPng,
} from "./helpers"

test.describe.configure({ timeout: 180_000 })

/** 1〜5枚目の色（互いに十分離れた色） */
const COLORS: [number, number, number][] = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
]

test("e2elive/AC-11: 画像5枚を添付して投稿すると、galleryとして保存されentryが作られ、visualは先頭4枚から作られる", async ({
    page,
    request,
    tag,
}) => {
    const text = `${tag} gallery`

    await page.goto("/post/")
    const editor = page
        .getByTestId("thread-segment-0")
        .getByTestId("segment-editor")
    await editor.locator("[data-post-body-editor]").click()
    await page.keyboard.type(text)
    await editor.locator('input[type="file"][accept="image/*"]').setInputFiles(
        COLORS.map((color, i) => ({
            name: `e2e-${i}.png`,
            mimeType: "image/png",
            buffer: makeSolidPng(400, 300, color),
        })),
    )
    await expect(
        editor.getByRole("button", { name: "サムネ調整" }),
    ).toBeVisible({ timeout: 30_000 })

    await page.getByRole("button", { name: "投稿", exact: true }).click()
    await expect(page.getByText(/Blueskyへの投稿に成功しました/)).toBeVisible({
        timeout: 60_000,
    })

    let entry: { sourceUri: string; visualUrl?: string } | undefined
    await expect(async () => {
        const mine: EntryListItem[] = []
        for (const e of await listEntries(request)) {
            const record = await getPublicPostRecord(e.sourceUri)
            if (record?.text?.includes(tag)) {
                expect(record.embed?.$type).toContain("gallery")
                mine.push(e)
            }
        }
        expect(mine).toHaveLength(1)
        entry = mine[0]
    }).toPass({ timeout: 60_000 })

    // 公開AppViewのビュー（公式アプリが描画に使う形）でも、galleryとして画像5枚を持つ
    await expect
        .poll(
            async () => {
                const view = await getPublicPostEmbedView(entry!.sourceUri)
                return [view?.$type, view?.items?.length]
            },
            { timeout: 60_000 },
        )
        .toEqual(["app.bsky.embed.gallery#view", 5])

    // visualは先頭4枚（赤・緑・青・黄）から合成され、5枚目（マゼンタ）を含まない
    expect(entry!.visualUrl).toBeTruthy()
    const { fractions } = await colorFractions(page, entry!.visualUrl!, COLORS)
    for (const f of fractions.slice(0, 4)) expect(f).toBeGreaterThan(0.05)
    expect(fractions[4]).toBeLessThan(0.002)

    // Entry詳細ページ: 5枚は高さ固定の横スクロール1行で全画像を表示し、拡大表示で全画像を切り替えられる
    await page.setViewportSize({ width: 480, height: 900 })
    const card = await gotoAndFindCard(page, "/entries/", text)
    await page.goto(
        (await card
            .getByRole("link", { name: "Entryを開く" })
            .getAttribute("href"))!,
    )
    const thumbs = page.getByRole("button", { name: /を拡大/ })
    await expect(thumbs).toHaveCount(5, { timeout: 60_000 })
    const strip = await thumbs
        .first()
        .locator("..")
        .evaluate(el => ({
            scrollable: el.scrollWidth > el.clientWidth,
            height: el.clientHeight,
        }))
    expect(strip.scrollable).toBe(true)
    expect(strip.height).toBe(160)
    await thumbs.first().click()
    const dialog = page.getByRole("dialog", { name: "画像の拡大表示" })
    await expect(dialog.getByText("1/5")).toBeVisible()
    for (const n of [2, 3, 4, 5]) {
        await dialog.getByRole("button", { name: "次の画像" }).click()
        await expect(dialog.getByText(`${n}/5`)).toBeVisible()
    }
})
