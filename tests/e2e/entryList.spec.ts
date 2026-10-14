/**
 * Entry一覧ページ（`/entries`、`EntryCard`、`EntryEditForm`）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - ログイン不要のゲスト表示（`/entries/?guest`）でカードが正しくレンダリングされ、
 *   削除ボタンが有効（削除フローはアプリ内で模擬される）であることを確認する。
 *   参照先の投稿が削除済みのカードは背景色で識別され、編集ボタンは無効になる。
 * - APIの応答を差し替えた状態で、見出しの編集が更新APIへ送られることを確認する。
 * - 削除フロー自体の検証は`entryDeleteDialog.spec.ts`で行う。
 */
import { expect, test } from "@playwright/test"

test.describe("Entry一覧ページ", () => {
    test("[entry-list/AC-6] ゲスト表示でカードが表示され、削除ボタンが有効な状態でレンダリングされる", async ({
        page,
    }) => {
        await page.goto("/entries/?guest")

        const deleteButton = page.getByRole("button", { name: "削除" }).first()
        await expect(deleteButton).toBeVisible()
        await expect(deleteButton).toBeEnabled()
    })

    test("[entry-list/AC-7] 参照先の投稿が削除済みのカードは、背景色で識別するクラスを持つ", async ({
        page,
    }) => {
        await page.goto("/entries/?guest")

        await expect(
            page.getByRole("button", { name: "削除" }).first(),
        ).toBeVisible()
        await expect(
            page.locator('[class*="card-muted"]').first(),
        ).toBeVisible()
    })

    test("[entry-list/AC-8] ゲスト表示では、編集ボタンが無効になる", async ({
        page,
    }) => {
        await page.goto("/entries/?guest")

        const editButton = page.getByRole("button", { name: "編集" }).first()
        await expect(editButton).toBeVisible()
        await expect(editButton).toBeDisabled()
    })

    test("[entry-list/AC-9] 見出しを編集して保存すると、更新APIへ新しい見出しが送られる", async ({
        page,
    }) => {
        test.setTimeout(90_000)
        const entryUri = "at://did:plc:test/dev.nekono.skyshare.entry/3abc"
        await page.route(/\/v2\/bsky\/session\/?$/, route =>
            route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    accounts: [
                        {
                            did: "did:plc:test",
                            handle: "test.bsky.social",
                            isActive: true,
                        },
                    ],
                }),
            }),
        )
        await page.route("**/v2/entries/skyshare**", route =>
            route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    entries: [
                        {
                            uri: entryUri,
                            cid: "bafy",
                            createdAt: "2026-01-01T00:00:00.000Z",
                            sourceUri:
                                "at://did:plc:test/app.bsky.feed.post/3x",
                            sourceCid: "bafy2",
                            heading: "元の見出し",
                            caption: "元のキャプション",
                            orphaned: false,
                        },
                    ],
                }),
            }),
        )
        let putBody: unknown
        await page.route(/\/v2\/entry\/?$/, route => {
            if (route.request().method() !== "PUT") return route.continue()
            putBody = route.request().postDataJSON()
            return route.fulfill({ status: 200 })
        })

        await page.goto("/entries/")
        const editButton = page.getByRole("button", { name: "編集" }).first()
        const dialog = page.getByRole("dialog", { name: "Entry編集" })
        await expect(async () => {
            await editButton.click()
            await expect(dialog).toBeVisible({ timeout: 2_000 })
        }).toPass({ timeout: 30_000 })

        await dialog.getByLabel("見出し").fill("新しい見出し")
        await dialog.getByRole("button", { name: "保存" }).click()
        await expect(dialog).toBeHidden()
        expect(putBody).toMatchObject({
            uri: entryUri,
            heading: "新しい見出し",
            caption: "元のキャプション",
        })
    })

    test("[entry-list/AC-10] 日本語34文字の見出しを入力すると、見出しの表示が102/100のバイト数になり誤りの状態になる", async ({
        page,
    }) => {
        test.setTimeout(90_000)
        await page.route(/\/v2\/bsky\/session\/?$/, route =>
            route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    accounts: [
                        {
                            did: "did:plc:test",
                            handle: "test.bsky.social",
                            isActive: true,
                        },
                    ],
                }),
            }),
        )
        await page.route("**/v2/entries/skyshare**", route =>
            route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    entries: [
                        {
                            uri: "at://did:plc:test/dev.nekono.skyshare.entry/3abc",
                            cid: "bafy",
                            createdAt: "2026-01-01T00:00:00.000Z",
                            sourceUri:
                                "at://did:plc:test/app.bsky.feed.post/3x",
                            sourceCid: "bafy2",
                            heading: "元の見出し",
                            caption: "元のキャプション",
                            orphaned: false,
                        },
                    ],
                }),
            }),
        )
        await page.goto("/entries/")
        const editButton = page.getByRole("button", { name: "編集" }).first()
        const dialog = page.getByRole("dialog", { name: "Entry編集" })
        await expect(async () => {
            await editButton.click()
            await expect(dialog).toBeVisible({ timeout: 2_000 })
        }).toPass({ timeout: 30_000 })

        await dialog.getByLabel("見出し").fill("あ".repeat(34))
        await expect(dialog.getByText("102/100:見出し")).toBeVisible()
        await dialog.getByLabel("見出し").fill("あ".repeat(33))
        await expect(dialog.getByText("99/100:見出し")).toBeVisible()
    })
})
