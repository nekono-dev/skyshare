/**
 * ライブテスト: 分岐したスレッド。
 *
 * 責務と処理概要:
 * - `specs/timeline/tasks.md`の分岐に関する手動確認項目を自動化する（`specs/e2elive/design.md §8`）。
 * - 同一投稿Aに自己返信が2系統ある状態（A→B→C と A→D→E）を、`createdAt`を指定して
 *   PDSへ直接作る。Bの投稿日時はAの1秒後、Dは1時間後のため、投稿日時が直前の投稿に
 *   最も近い側（A→B→C）がメインスレッドとして採用される。
 *   - Timelineでは採用された系統（A→B→C）だけが1つのグループとして表示され、D・Eは表示されない。
 *   - ルートAの「リンク・Bluesky投稿を削除」では、A・B・Cだけが削除され、D・Eは残る。
 */
import { expect, test } from "./liveTest"
import { getPublicPostText, makePng } from "./helpers"
import { createEntryRecord, createPost } from "./pds"

test.describe.configure({ timeout: 180_000 })

test("e2elive/AC-16: 分岐したスレッドは採用された系統だけが表示され、ルートの削除で採用されなかった側は残る", async ({
    page,
    agent,
    tag,
}) => {
    const base = Date.now() - 3 * 60 * 60 * 1000
    const at = (offsetMs: number) => new Date(base + offsetMs).toISOString()
    const text = (name: string) => `${tag} branch ${name}`

    const a = await createPost(agent, {
        text: text("A"),
        images: [makePng(300, 200)],
        createdAt: at(0),
    })
    const reply = (parent: typeof a, name: string, offsetMs: number) =>
        createPost(agent, {
            text: text(name),
            createdAt: at(offsetMs),
            reply: { root: a, parent },
        })
    const b = await reply(a, "B", 1_000)
    const c = await reply(b, "C", 2_000)
    const d = await reply(a, "D", 60 * 60 * 1000)
    const e = await reply(d, "E", 60 * 60 * 1000 + 1_000)
    await createEntryRecord(agent, {
        source: a,
        visual: makePng(300, 200),
        caption: text("A"),
    })

    // Timeline: A→B→Cが1グループ（展開すると2件）。D・Eは表示されない
    const card = page
        .locator("article")
        .filter({ hasText: text("A") })
        .first()
    await expect(async () => {
        await page.goto("/")
        await expect(card).toBeVisible({ timeout: 25_000 })
        // 展開ボタンが「（2件）」になるまで（AppViewへの反映を）待つ
        await expect(
            page.getByRole("button", { name: "スレッドを展開（2件）" }).first(),
        ).toBeVisible({ timeout: 25_000 })
    }).toPass({ timeout: 150_000 })
    await page
        .getByRole("button", { name: "スレッドを展開（2件）" })
        .first()
        .click()
    await expect(page.getByText(text("B"))).toBeVisible()
    await expect(page.getByText(text("C"))).toBeVisible()
    await expect(page.getByText(text("D"))).toHaveCount(0)
    await expect(page.getByText(text("E"))).toHaveCount(0)

    // ルートAの削除: 採用された系統（A・B・C）だけが削除される
    await card.getByRole("button", { name: "投稿を削除" }).click()
    await page
        .getByRole("button", { name: "リンク・Bluesky投稿を削除" })
        .click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("3件の投稿")
    await expect(dialog.locator("article")).toHaveCount(3)
    await dialog.getByRole("button", { name: "全て削除" }).click()

    for (const p of [a, b, c]) {
        await expect
            .poll(() => getPublicPostText(p.uri), { timeout: 60_000 })
            .toBeNull()
    }
    // 採用されなかった側（D・E）は残る
    expect(await getPublicPostText(d.uri)).toBe(text("D"))
    expect(await getPublicPostText(e.uri)).toBe(text("E"))
})
