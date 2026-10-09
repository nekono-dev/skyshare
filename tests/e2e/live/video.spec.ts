/**
 * ライブテスト: 動画投稿（実アカウント）。
 *
 * 責務と処理概要:
 * - `specs/video/tasks.md`の手動確認項目のうち、動画の投稿・表示・事後entry作成を自動化する。
 *   - mp4・mov・webmを投稿すると、Bluesky上で`app.bsky.embed.video`の投稿になり、縦横比が保持され、
 *     entryが作られ、entry詳細ページに動画プレイヤーが表示される。
 *   - 既存の動画投稿（entryなし）からTimelineの「Skyshare Entryを作成」で作ったentryの詳細ページで、
 *     visualが表示され、動画が再生用プレイヤーで表示される。前提の「entryの無い動画投稿」は、
 *     UIから動画を投稿した後、PDSからentryだけを削除して用意する。
 * - 実際の動画アップロード・変換はBlueskyの動画サービスが行うため、完了まで時間がかかる。
 * - 作成した投稿は`liveTest`のフィクスチャが終了時に削除する。
 * - 対象外（手動確認のまま残す）: 300MB級のアップロード所要時間、トークン再発行、
 *   10分超の動画、Safari・Firefoxでの再生、iPhone実機のHEVC mov。
 */
import path from "node:path"
import type { Page } from "@playwright/test"
import { expect, test } from "./liveTest"
import { deleteEntriesOnly } from "./pds"
import { getPublicPostRecord, gotoAndFindCard, listEntries } from "./helpers"

/** 投稿する動画の形式（mov・webmもBlueskyの動画サービスがmp4へ変換する。AC-2） */
const SAMPLES = ["mp4", "mov", "webm"].map(ext => ({
    ext,
    file: path.resolve(`tests/fixtures/video-sample.${ext}`),
}))

test.describe.configure({ timeout: 240_000 })

/** 投稿フォームから動画付きの投稿を行い、投稿成功の表示まで待つ */
const postVideoViaUi = async (page: Page, text: string, file: string) => {
    await page.goto("/post/")
    const editor = page
        .getByTestId("thread-segment-0")
        .getByTestId("segment-editor")
    await editor.locator("[data-post-body-editor]").click()
    await page.keyboard.type(text)
    await editor
        .locator('input[type="file"][accept*="video/quicktime"]')
        .first()
        .setInputFiles(file)

    // Blueskyの動画サービスでの変換完了まで待つ
    await expect(
        page.getByTestId("video-preview").getByText("アップロード完了"),
    ).toBeVisible({ timeout: 150_000 })

    await page.getByRole("button", { name: "投稿", exact: true }).click()
    await expect(page.getByText(/Blueskyへの投稿に成功しました/)).toBeVisible({
        timeout: 60_000,
    })
}

/** `text`の投稿に紐づくentryが1件作られるまで待ち、そのURIとsourceのURIを返す */
const waitForEntry = async (
    request: Parameters<typeof listEntries>[0],
    text: string,
) => {
    let found: { uri: string; sourceUri: string } | undefined
    await expect(async () => {
        const mine: { uri: string; sourceUri: string }[] = []
        for (const e of await listEntries(request)) {
            const record = await getPublicPostRecord(e.sourceUri)
            if (!record?.text?.includes(text)) continue
            expect(record.embed?.$type).toBe("app.bsky.embed.video")
            expect(record.embed).toHaveProperty("aspectRatio")
            mine.push(e)
        }
        expect(mine).toHaveLength(1)
        found = mine[0]
    }).toPass({ timeout: 60_000 })
    return found!
}

for (const { ext, file } of SAMPLES) {
    test(`e2elive/AC-12: ${ext}を投稿すると動画投稿になりentryが作られ、詳細ページで再生用プレイヤーが表示される`, async ({
        page,
        request,
        tag,
    }) => {
        const text = `${tag} video ${ext}`
        await postVideoViaUi(page, text, file)
        await waitForEntry(request, text)

        const card = await gotoAndFindCard(page, "/entries/", text)
        const href = await card
            .getByRole("link", { name: "Entryを開く" })
            .getAttribute("href")
        await page.goto(href!)
        await expect(page.getByTestId("video-player")).toBeVisible({
            timeout: 30_000,
        })
    })
}

test("e2elive/AC-13: 既存の動画投稿からTimelineで事後にentryを作成すると、詳細ページでvisualと動画プレイヤーが表示される", async ({
    page,
    request,
    agent,
    tag,
}) => {
    const text = `${tag} video posthoc`
    await postVideoViaUi(page, text, SAMPLES[0].file)
    const created = await waitForEntry(request, text)

    // entryだけを削除して、「entryの無い既存の動画投稿」にする
    expect(await deleteEntriesOnly(agent, tag)).toBe(1)
    expect((await listEntries(request)).some(e => e.uri === created.uri)).toBe(
        false,
    )

    const card = await gotoAndFindCard(page, "/", text)
    await card.getByRole("button", { name: "Skyshare Entryを作成" }).click()
    await expect(card.getByText("Entryを開く")).toBeVisible({ timeout: 90_000 })

    const entries = await listEntries(request)
    expect(entries.filter(e => e.sourceUri === created.sourceUri)).toHaveLength(
        1,
    )

    const href = await card
        .getByRole("link", { name: "Entryを開く" })
        .getAttribute("href")
    await page.goto(href!)
    await expect(page.getByTestId("entry-visual")).toBeVisible({
        timeout: 30_000,
    })
    await expect(page.getByTestId("video-player")).toBeVisible()
})
