/**
 * ライブテスト: entry削除フロー（最終確認・旧実装のentry・削除後の再表示）。
 *
 * 責務と処理概要:
 * - `specs/entry/frontend/tasks.md`・`specs/timeline/tasks.md`の削除に関する手動確認項目を
 *   自動化する（`specs/e2elive/design.md §8`）。前提のentry・投稿はPDSへ直接作成する。
 *   - 単発投稿: 「リンク・Bluesky投稿を削除」→ 最終確認 → キャンセルで選択肢に戻り、
 *     再度開くと一覧が再表示 → 確定で投稿が消える（`/entries`の導線）。
 *   - 単発投稿・スレッド: Timelineの導線で確定すると、グループ全体が消え、再読み込みしても
 *     再表示されず、Bluesky上の投稿もすべて消える。
 *   - 旧実装のentry（`source`が返信投稿）: 「リンク・Bluesky投稿を削除」がグレー表示で理由が出て、
 *     「Skyshareリンクを削除」後も投稿・スレッドグループは残る。
 */
import type { Page } from "@playwright/test"
import { expect, test } from "./liveTest"
import { getPublicPostText, gotoAndFindCard, makePng } from "./helpers"
import { createEntryRecord, createPost, createThread } from "./pds"

test.describe.configure({ timeout: 180_000 })

const LINK_ONLY = "Skyshareリンクを削除"
const LINK_AND_POST = "リンク・Bluesky投稿を削除"

/** 公開AppViewから投稿が消えるまで待つ */
const expectPostGone = (uri: string) =>
    expect.poll(() => getPublicPostText(uri), { timeout: 60_000 }).toBeNull()

/** 最終確認ダイアログの削除予定一覧の行を取得する */
const confirmRows = (page: Page) => page.getByRole("dialog").locator("article")

test("e2elive/AC-15: 単発投稿: 最終確認でキャンセルすると削除されず、再度開くと一覧が再表示され、確定で削除される（/entries）", async ({
    page,
    agent,
    tag,
}) => {
    const text = `${tag} del single entries`
    const post = await createPost(agent, { text, images: [makePng(300, 200)] })
    await createEntryRecord(agent, {
        source: post,
        visual: makePng(300, 200),
        caption: text,
    })

    const card = await gotoAndFindCard(page, "/entries/", text)
    await card.getByRole("button", { name: "削除" }).click()
    await page.getByRole("button", { name: LINK_AND_POST }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Blueskyの投稿1件を削除します。")
    await expect(confirmRows(page)).toHaveCount(1)
    await expect(confirmRows(page).first()).toContainText(text)

    // キャンセルすると削除されず、選択肢の表示へ戻る
    await dialog.getByRole("button", { name: "キャンセル" }).click()
    await expect(
        page.getByRole("button", { name: LINK_AND_POST }),
    ).toBeVisible()
    expect(await getPublicPostText(post.uri)).toBe(text)

    // 再度開くと一覧が再表示される
    await page.getByRole("button", { name: LINK_AND_POST }).click()
    await expect(confirmRows(page)).toHaveCount(1)

    await dialog.getByRole("button", { name: "全て削除" }).click()
    await expect(page.locator("article").filter({ hasText: text })).toHaveCount(
        0,
        { timeout: 30_000 },
    )
    await expectPostGone(post.uri)
})

test("e2elive/AC-15: 単発投稿: Timelineの導線で確定すると、カードが消え、再読み込みしても再表示されない", async ({
    page,
    agent,
    tag,
}) => {
    const text = `${tag} del single timeline`
    const post = await createPost(agent, { text, images: [makePng(300, 200)] })
    await createEntryRecord(agent, {
        source: post,
        visual: makePng(300, 200),
    })

    const card = await gotoAndFindCard(page, "/", text)
    await card.getByRole("button", { name: "投稿を削除" }).click()
    await page.getByRole("button", { name: LINK_AND_POST }).click()
    await expect(confirmRows(page)).toHaveCount(1)
    await page
        .getByRole("dialog")
        .getByRole("button", { name: "全て削除" })
        .click()

    await expect(page.locator("article").filter({ hasText: text })).toHaveCount(
        0,
        { timeout: 30_000 },
    )
    await expectPostGone(post.uri)
    await page.reload()
    await expect(page.locator("article").filter({ hasText: text })).toHaveCount(
        0,
    )
})

test("e2elive/AC-15: スレッド: Timelineの導線で確定すると、グループ全体が消え、再読み込みしても再表示されず、全投稿が削除される", async ({
    page,
    agent,
    tag,
}) => {
    const rootText = `${tag} del thread 1/3`
    const posts = await createThread(agent, [
        { text: rootText, images: [makePng(300, 200)] },
        { text: `${tag} del thread 2/3` },
        { text: `${tag} del thread 3/3` },
    ])
    await createEntryRecord(agent, {
        source: posts[0],
        visual: makePng(300, 200),
    })

    // 全投稿がAppViewに反映され、スレッドとして折りたたまれるまで再読み込みする
    const card = page.locator("article").filter({ hasText: rootText }).first()
    await expect(async () => {
        await page.goto("/")
        await expect(
            // アカウントに元からあるスレッドも含まれるため、最新（先頭）のものを見る
            page.getByRole("button", { name: "スレッドを展開（2件）" }).first(),
        ).toBeVisible({ timeout: 25_000 })
    }).toPass({ timeout: 150_000 })

    await card.getByRole("button", { name: "投稿を削除" }).click()
    await page.getByRole("button", { name: LINK_AND_POST }).click()
    await expect(page.getByRole("dialog")).toContainText("3件の投稿")
    await expect(confirmRows(page)).toHaveCount(3)
    await page
        .getByRole("dialog")
        .getByRole("button", { name: "全て削除" })
        .click()

    await expect(page.locator("article").filter({ hasText: tag })).toHaveCount(
        0,
        { timeout: 30_000 },
    )
    for (const p of posts) await expectPostGone(p.uri)
    await page.reload()
    await expect(page.locator("article").filter({ hasText: tag })).toHaveCount(
        0,
    )
})

test("e2elive/AC-16: 旧実装のentry（sourceが返信投稿）: 投稿ごとの削除は選べず理由が表示され、リンクのみ削除しても投稿は残る", async ({
    page,
    agent,
    tag,
}) => {
    const rootText = `${tag} legacy root`
    const replyText = `${tag} legacy reply`
    const [root, reply] = await createThread(agent, [
        { text: rootText, images: [makePng(300, 200)] },
        { text: replyText, images: [makePng(200, 300)] },
    ])
    await createEntryRecord(agent, {
        source: reply,
        visual: makePng(200, 300),
        caption: replyText,
    })

    const card = await gotoAndFindCard(page, "/entries/", replyText)
    await card.getByRole("button", { name: "削除" }).click()

    await expect(
        page.getByRole("button", { name: LINK_AND_POST }),
    ).toBeDisabled()
    await expect(page.getByText(/旧仕様で作成されており/)).toBeVisible()

    await page.getByRole("button", { name: LINK_ONLY }).click()
    await expect(
        page.locator("article").filter({ hasText: replyText }),
    ).toHaveCount(0, { timeout: 30_000 })

    // 投稿は残り、Timelineのスレッドグループも残る
    expect(await getPublicPostText(root.uri)).toBe(rootText)
    expect(await getPublicPostText(reply.uri)).toBe(replyText)
    await gotoAndFindCard(page, "/", rootText)
})
