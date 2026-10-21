/**
 * タイムラインの投稿カードのentry操作（specs/timeline）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - entryを開くリンクが操作の列の右端に置かれることを、ゲスト表示のカードで確認する。
 * - 起点に画像が無く返信に画像があるスレッドで、事後にentryを作成するとき、
 *   APIへ送られる派生元が代表画像の素材（返信）ではなく起点の投稿になることを、APIの応答を
 *   差し替えて確認する。
 */
import { expect, test } from "@playwright/test"

const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
)

test("[timeline/AC-9] entryを開くリンクが、操作の列の右端に表示される", async ({
    page,
}) => {
    await page.goto("/?guest")
    const card = page.locator("article", { hasText: "スレッドB・1件目" })
    const link = card.getByRole("link", { name: "Entryを開く" })
    await expect(link).toBeVisible()

    // 操作の列（フッター）の中で、リンクが他の操作より右にある
    const footer = card.locator("footer")
    const linkBox = (await link.boundingBox())!
    const controls = footer.locator("button, a:not([href*='/entries/'])")
    expect(await controls.count()).toBeGreaterThan(0)
    for (const control of await controls.all()) {
        const box = (await control.boundingBox())!
        expect(box.x + box.width).toBeLessThanOrEqual(linkBox.x + 1)
    }
    // リンクの右端は、操作の列の右端に寄っている
    const footerBox = (await footer.boundingBox())!
    expect(
        footerBox.x + footerBox.width - (linkBox.x + linkBox.width),
    ).toBeLessThan(40)
})

test("[timeline/AC-6] 代表画像の素材が返信でも、entryの作成で起点の投稿のURIが送られる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const rootUri = "at://did:plc:t/app.bsky.feed.post/3root"
    const replyUri = "at://did:plc:t/app.bsky.feed.post/3reply"
    const author = {
        did: "did:plc:t",
        handle: "t.test",
        displayName: "テスト",
    }
    await page.route(/\/v2\/bsky\/session\/?$/, route =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                accounts: [{ ...author, isActive: true }],
            }),
        }),
    )
    // 起点は画像なし、返信にだけ画像がある
    await page.route(/\/v2\/entries\/?(\?.*)?$/, route =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                threads: [
                    {
                        rootPost: {
                            uri: rootUri,
                            cid: "bafyroot",
                            url: "https://bsky.app/profile/t.test/post/3root",
                            indexedAt: "2026-09-06T10:00:00.000Z",
                            text: "起点の投稿（画像なし）",
                            author,
                            images: [],
                        },
                        replies: [
                            {
                                uri: replyUri,
                                cid: "bafyreply",
                                url: "https://bsky.app/profile/t.test/post/3reply",
                                indexedAt: "2026-09-06T10:01:00.000Z",
                                text: "返信の投稿（画像あり）",
                                author,
                                images: [
                                    {
                                        url: "/materials/sample-og.png",
                                        alt: "画像",
                                        cid: "bafkreiimage",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        }),
    )
    // 代表画像の素材は同一オリジンの画像取得APIから読む
    await page.route(/\/v2\/bsky\/images\/?(\?.*)?$/, route =>
        route.fulfill({ contentType: "image/png", body: PNG_1X1 }),
    )
    let requestBody = ""
    await page.route(/\/v2\/entry\/?$/, route => {
        if (route.request().method() !== "POST") return route.continue()
        requestBody = route.request().postData() ?? ""
        return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "stop" }),
        })
    })

    await page.goto("/")
    const create = page
        .locator("article", { hasText: "起点の投稿（画像なし）" })
        .getByRole("button", { name: "Skyshare Entryを作成" })
    await expect(async () => {
        await create.click()
        expect(requestBody).not.toBe("")
    }).toPass({ timeout: 30_000 })

    // multipart の uri フィールドに、素材ではなく起点の投稿が入っている
    expect(requestBody).toMatch(
        new RegExp(`name="uri"\\r\\n\\r\\n${rootUri}\\r\\n`),
    )
    expect(requestBody).not.toContain(replyUri)
})
