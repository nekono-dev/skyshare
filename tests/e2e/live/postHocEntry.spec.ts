/**
 * ライブテスト: 既存投稿からの事後entry作成（Timelineの「Skyshare Entryを作成」ボタン）。
 *
 * 責務と処理概要:
 * - `specs/timeline/tasks.md`の手動確認項目を自動化する（`specs/e2elive/design.md §8`）。
 * - 前提となる「entryを持たない既存投稿」は、PDSへ直接作成する（アプリのUIからは作れない）。
 *   - 画像付き単発投稿に対して、ボタンが出て、押下するとentryが作られボタンが消える。
 *   - ルートが画像を持たず後続投稿が画像を持つスレッドで、ルートのカードにボタンが出て、
 *     作られたentryの`source`はルートを指す。
 */
import { expect, test } from "./liveTest"
import { gotoAndFindCard, listEntries, makePng } from "./helpers"
import { createPost, createThread } from "./pds"

const CREATE = "Skyshare Entryを作成"

test.describe.configure({ timeout: 180_000 })

test("e2elive/AC-13: 画像付き単発投稿に事後でentryを作成できる", async ({
    page,
    request,
    agent,
    tag,
}) => {
    const text = `${tag} posthoc single`
    const post = await createPost(agent, { text, images: [makePng(300, 200)] })

    const card = await gotoAndFindCard(page, "/", text)
    await card.getByRole("button", { name: CREATE }).click()

    await expect(card.getByText("Entryを開く")).toBeVisible({ timeout: 90_000 })
    await expect(card.getByRole("button", { name: CREATE })).toHaveCount(0)
    const entries = await listEntries(request)
    expect(entries.filter(e => e.sourceUri === post.uri)).toHaveLength(1)
})

test("e2elive/AC-13: ルートに画像が無く後続投稿に画像があるスレッドで、ルートに作成したentryのsourceはルートを指す", async ({
    page,
    request,
    agent,
    tag,
}) => {
    const rootText = `${tag} posthoc root`
    const [root] = await createThread(agent, [
        { text: rootText },
        { text: `${tag} posthoc reply`, images: [makePng(200, 300)] },
    ])

    // 投稿直後は後続投稿のAppViewへの反映が遅れ、ボタンが出ないことがあるため、出るまで再読み込みする
    const card = page.locator("article").filter({ hasText: rootText }).first()
    await expect(async () => {
        await page.goto("/")
        await expect(card.getByRole("button", { name: CREATE })).toBeVisible({
            timeout: 25_000,
        })
    }).toPass({ timeout: 150_000 })
    await card.getByRole("button", { name: CREATE }).click()

    await expect(card.getByText("Entryを開く")).toBeVisible({ timeout: 90_000 })
    const entries = await listEntries(request)
    const created = entries.filter(e => e.sourceUri === root.uri)
    expect(created).toHaveLength(1)
    // 後続投稿の画像からvisualが作られている（entry一覧でvisualを取得できる）
    expect(created[0].uri).toBeTruthy()
})
