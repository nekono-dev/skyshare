/**
 * Timeline一覧のスレッド表示（`ThreadCard`）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - ログイン不要のゲスト表示（`/?guest`）で、`GUEST_DUMMY_POSTS`に追加した
 *   スレッドA（entry未作成、ルートは画像なし・中間segmentのみ画像あり）・
 *   スレッドB（ルートにentry済み）・スレッドC（entry未作成、ルート自身が画像あり）
 *   の3つの固定フィクスチャを用いて、実Blueskyアカウント無しでスレッドグルーピング・
 *   展開/折りたたみ・事後entry作成ボタン（常にルートのカードに表示、FR-3）・
 *   スレッドタグが表示されないことを検証する。
 */
import { expect, test } from "./fixtures"

test.describe("Timeline一覧のスレッド表示", () => {
    test("[timeline/AC-1 timeline/AC-2] スレッドAが折りたたみ表示され、展開すると3件が時系列順に表示される。ルート自身は画像を持たないが、中間投稿の画像を元に事後entry作成ボタンがルート投稿のカードに表示される", async ({
        page,
    }) => {
        await page.goto("/?guest")

        const rootText = page.getByText(
            "スレッドA・1件目（ルート、画像なし）です。",
        )
        await expect(rootText).toBeVisible()

        // スレッドCも同じ件数(2件)のためボタン名だけでは一意にならない。
        // ルート投稿の記事要素の直後の兄弟要素として、そのスレッド自身の
        // 展開ボタンに絞り込む。
        const rootArticle = page.locator("article", {
            hasText: "スレッドA・1件目（ルート、画像なし）です。",
        })
        const expandButton = rootArticle.locator(
            "xpath=following-sibling::button[1]",
        )
        await expect(expandButton).toHaveText("スレッドを展開（2件）")
        await expect(expandButton).toBeVisible()

        // ルート投稿自身は画像を持たないが、中間投稿(guest-thread-a-mid)の画像を
        // Visual取得元として事後entry作成ボタンがルート投稿のカードに表示される
        // （FR-3、ボタンは常にルートのカードにのみ表示する）。
        await expect(
            rootArticle.getByRole("button", { name: "Skyshare Entryを作成" }),
        ).toBeVisible()

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

        // 事後entry作成ボタンは、画像の元になった中間投稿・末尾投稿のカードには
        // 表示されない（ボタンは常にルートのカードにのみ表示する）。
        const midCard = page.locator("article", {
            hasText: "スレッドA・2件目です。画像付きでentry未作成です。",
        })
        const tailCard = page.locator("article", {
            hasText: "スレッドA・3件目です。",
        })
        for (const card of [midCard, tailCard]) {
            await expect(
                card.getByRole("button", { name: "Skyshare Entryを作成" }),
            ).toHaveCount(0)
        }

        await page.getByRole("button", { name: "折りたたむ" }).click()
        await expect(midText).not.toBeVisible()
    })

    test("[timeline/AC-4] スレッドCはルートが画像を持ち、entry未作成のため、ルート投稿にのみ事後entry作成ボタンが表示される", async ({
        page,
    }) => {
        await page.goto("/?guest")

        const rootText = page.getByText(
            "スレッドC・1件目（ルート、画像あり）です。",
        )
        await expect(rootText).toBeVisible()

        const rootCard = page.locator("article", {
            hasText: "スレッドC・1件目（ルート、画像あり）です。",
        })
        await expect(
            rootCard.getByRole("button", { name: "Skyshare Entryを作成" }),
        ).toBeVisible()

        const expandButton = rootCard.locator(
            "xpath=following-sibling::button[1]",
        )
        await expect(expandButton).toHaveText("スレッドを展開（2件）")
        await expandButton.click()

        const midCard = page.locator("article", {
            hasText: "スレッドC・2件目です。",
        })
        const tailCard = page.locator("article", {
            hasText: "スレッドC・3件目です。",
        })
        await expect(
            midCard.getByRole("button", { name: "Skyshare Entryを作成" }),
        ).toHaveCount(0)
        await expect(
            tailCard.getByRole("button", { name: "Skyshare Entryを作成" }),
        ).toHaveCount(0)
    })

    test("[timeline/AC-8] スレッドBのルート投稿にスレッドタグは表示されない", async ({
        page,
    }) => {
        await page.goto("/?guest")

        await expect(
            page.getByText("スレッドB・1件目（ルート、entry作成済み）です。"),
        ).toBeVisible()

        const rootArticle = page.locator("article", {
            hasText: "スレッドB・1件目（ルート、entry作成済み）です。",
        })
        await expect(
            rootArticle.getByText("スレッド", { exact: true }),
        ).toHaveCount(0)
    })

    test("[timeline/AC-3 timeline/AC-11] スレッドに関係しない単独投稿は、従来通り個別カードとして表示される", async ({
        page,
    }) => {
        await page.goto("/?guest")

        await expect(
            page.getByText("これはゲスト用デモ表示のサンプル投稿です。"),
        ).toBeVisible()
        // 単独投稿には「スレッドを展開」ボタンが無い。
        await expect(
            page
                .locator("article", {
                    hasText: "これはゲスト用デモ表示のサンプル投稿です。",
                })
                .getByRole("button", { name: /スレッドを展開/ }),
        ).toHaveCount(0)
    })
})

test.describe("Timelineの画像表示（specs/image-gallery）", () => {
    test("Entryを持つ投稿は visual を1枚だけ表示し、クリックしても拡大表示が開かない", async ({
        page,
    }) => {
        await page.goto("/?guest")
        const card = page.locator("article", {
            hasText: "画像投稿で、URL発行を行った際の表示です。",
        })
        await expect(card).toBeVisible()
        await expect(card.locator("img[loading='lazy']")).toHaveCount(1)
        await expect(card.locator("img[loading='lazy']")).toHaveAttribute(
            "src",
            /sample-og\.png/,
        )
        await expect(card.getByRole("button", { name: /を拡大/ })).toHaveCount(
            0,
        )
        await card.locator("img[loading='lazy']").click({ force: true })
        await expect(
            page.getByRole("dialog", { name: "画像の拡大表示" }),
        ).toHaveCount(0)
    })

    test("Entryを持つスレッドのルート投稿も visual のみで拡大できない", async ({
        page,
    }) => {
        await page.goto("/?guest")
        const card = page.locator("article", {
            hasText: "スレッドB・1件目（ルート、entry作成済み）です。",
        })
        await expect(card.locator("img[loading='lazy']")).toHaveCount(1)
        await expect(card.locator("img[loading='lazy']")).toHaveAttribute(
            "src",
            /sample-og\.png/,
        )
        await expect(card.getByRole("button", { name: /を拡大/ })).toHaveCount(
            0,
        )
    })

    test("Entryを持たない複数画像投稿はサムネイルから拡大表示を開閉できる", async ({
        page,
    }) => {
        await page.goto("/?guest")
        const card = page.locator("article", {
            hasText: "画像を6枚添付した投稿の表示です。",
        })
        const thumb = card.getByRole("button", { name: "画像1/6を拡大" })
        await thumb.click()
        const dialog = page.getByRole("dialog", { name: "画像の拡大表示" })
        await expect(dialog.getByText("1/6")).toBeVisible()
        await page.keyboard.press("Escape")
        await expect(dialog).toHaveCount(0)
        await expect(thumb).toBeFocused()
    })

    test("スレッドの返信投稿（Entryなし）の画像は拡大できる", async ({
        page,
    }) => {
        await page.goto("/?guest")
        const rootArticle = page.locator("article", {
            hasText: "スレッドA・1件目（ルート、画像なし）です。",
        })
        await rootArticle.locator("xpath=following-sibling::button[1]").click()
        const mid = page.locator("article", {
            hasText: "スレッドA・2件目です。画像付きでentry未作成です。",
        })
        await mid.getByRole("button", { name: /を拡大/ }).click()
        await expect(
            page.getByRole("dialog", { name: "画像の拡大表示" }),
        ).toBeVisible()
    })

    test("画像もEntryも持たない投稿に画像領域が無い", async ({ page }) => {
        await page.goto("/?guest")
        const card = page.locator("article", {
            hasText: "これはゲスト用デモ表示のサンプル投稿です。",
        })
        await expect(card.locator("img[loading='lazy']")).toHaveCount(0)
    })
})
