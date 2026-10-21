/**
 * ライブテスト: 事後entry作成のvisualの生成元（画素確認）。
 *
 * 責務と処理概要:
 * - `specs/timeline/tasks.md`の手動確認項目「ルートが画像を持たないスレッドに画像付きreplyを
 *   追加した場合、事後作成したentryのvisualがそのreplyの画像から生成される」を自動化する。
 * - ルートはテキストのみ、後続のreplyが単色（シアン）の画像を持つスレッドをPDSへ直接作り、
 *   Timelineの「Skyshare Entryを作成」で作ったentryのvisualが、その色を主に含むことを確認する。
 */
import { expect, test } from "./liveTest"
import { colorFractions, listEntries, makeSolidPng } from "./helpers"
import { createThread } from "./pds"

test.describe.configure({ timeout: 180_000 })

const CYAN: [number, number, number] = [0, 255, 255]

test("e2elive/AC-14: ルートに画像が無いスレッドの事後entryは、後続replyの画像からvisualが作られる", async ({
    page,
    request,
    agent,
    tag,
}) => {
    const rootText = `${tag} visual root`
    const [root] = await createThread(agent, [
        { text: rootText },
        { text: `${tag} visual reply`, images: [makeSolidPng(400, 300, CYAN)] },
    ])

    const card = page.locator("article").filter({ hasText: rootText }).first()
    const create = card.getByRole("button", { name: "Skyshare Entryを作成" })
    await expect(async () => {
        await page.goto("/")
        await expect(create).toBeVisible({ timeout: 25_000 })
    }).toPass({ timeout: 150_000 })
    await create.click()
    await expect(card.getByText("Entryを開く")).toBeVisible({ timeout: 90_000 })

    const entry = (await listEntries(request)).find(
        e => e.sourceUri === root.uri,
    )
    expect(entry?.visualUrl).toBeTruthy()
    const { fractions } = await colorFractions(page, entry!.visualUrl!, [CYAN])
    // visualは、replyの画像（シアン）で大部分が占められる
    expect(fractions[0]).toBeGreaterThan(0.5)
})
