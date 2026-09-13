/**
 * Timeline一覧のスレッド表示（`ThreadCard`）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - ログイン不要のゲスト表示（`/?guest`）で、`GUEST_DUMMY_POSTS`に追加した
 *   スレッドA（entry未作成、中間segmentに画像あり）・スレッドB（ルートにentry済み）
 *   の2つの固定フィクスチャを用いて、実Blueskyアカウント無しでスレッドグルーピング・
 *   展開/折りたたみ・事後entry作成ボタン・スレッド由来バッジを検証する。
 */
import { expect, test } from "@playwright/test"

test.describe("Timeline一覧のスレッド表示", () => {
    test("スレッドAが折りたたみ表示され、展開すると3件が時系列順に表示され、中間投稿に事後entry作成ボタンが出る", async ({
        page,
    }) => {
        await page.goto("/?guest")

        const rootText = page.getByText(
            "スレッドA・1件目（ルート、画像なし）です。",
        )
        await expect(rootText).toBeVisible()

        const expandButton = page.getByRole("button", {
            name: "返信を表示（2件）",
        })
        await expect(expandButton).toBeVisible()

        // 展開前は後続投稿が表示されていない。
        await expect(
            page.getByText("スレッドA・2件目です。画像付きでentry未作成です。"),
        ).not.toBeVisible()

        await expandButton.click()

        const midText = page.getByText(
            "スレッドA・2件目です。画像付きでentry未作成です。",
        )
        const tailText = page.getByText("スレッドA・3件目です。")
        await expect(midText).toBeVisible()
        await expect(tailText).toBeVisible()

        // 時系列順（root→mid→tail）でDOM上に並んでいることを確認する。
        const rootBox = await rootText.boundingBox()
        const midBox = await midText.boundingBox()
        const tailBox = await tailText.boundingBox()
        expect(rootBox?.y).toBeLessThan(midBox!.y)
        expect(midBox?.y).toBeLessThan(tailBox!.y)

        // 中間投稿（画像あり・entry未作成）に事後entry作成ボタンが表示される（FR-3）。
        // 一覧内の無関係な単独投稿(guest3)にも同名ボタンがあるため、投稿カード単位で絞り込む。
        const midCard = page.locator("article", {
            hasText: "スレッドA・2件目です。画像付きでentry未作成です。",
        })
        await expect(
            midCard.getByRole("button", { name: "Skyshare Entryを作成" }),
        ).toBeVisible()

        // 末尾投稿（画像なし）には表示されない。
        const tailCard = page.locator("article", {
            hasText: "スレッドA・3件目です。",
        })
        await expect(
            tailCard.getByRole("button", { name: "Skyshare Entryを作成" }),
        ).toHaveCount(0)

        await page.getByRole("button", { name: "折りたたむ" }).click()
        await expect(midText).not.toBeVisible()
    })

    test("スレッドBはルート投稿にスレッド由来バッジが表示される", async ({
        page,
    }) => {
        await page.goto("/?guest")

        await expect(
            page.getByText("スレッドB・1件目（ルート、entry作成済み）です。"),
        ).toBeVisible()

        const badge = page.getByText("スレッド", { exact: true })
        await expect(badge).toBeVisible()
    })

    test("スレッドに関係しない単独投稿は、従来通り個別カードとして表示される", async ({
        page,
    }) => {
        await page.goto("/?guest")

        await expect(
            page.getByText("これはゲスト用デモ表示のサンプル投稿です。"),
        ).toBeVisible()
        // 単独投稿には「返信を表示」ボタンが無い。
        await expect(
            page
                .locator("article", {
                    hasText: "これはゲスト用デモ表示のサンプル投稿です。",
                })
                .getByRole("button", { name: /返信を表示/ }),
        ).toHaveCount(0)
    })
})
