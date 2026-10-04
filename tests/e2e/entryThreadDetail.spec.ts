/**
 * entry詳細ページ（`entries/[slug].astro`）のスレッド表示（`EntryDetailView`）の
 * ヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - `entries/[slug].astro`のスレッド表示ロジック自体は、実PDSレコード・ログインに
 *   依存するSSR取得（`app.bsky.feed.getPostThread`）を伴うため、実アカウントが無い
 *   このテスト環境では直接検証できない（実アカウントでの確認は手動確認タスクとして
 *   別途残す）。ここでは`entries/sample.astro`（スレッド表示、`[slug].astro`と同じ`EntryDetailView`を
 *   描画するサンプルページ）を用いて、コンポーネント自体の描画を検証する。
 * - `specs/entry/frontend/requirements.md`の受け入れ条件のうち、「先頭から後続投稿まで
 *   時系列順にすべて表示される」
 *   実ブラウザでのレンダリング結果として確認する。
 */
import { expect, test } from "@playwright/test"

test.describe("entry詳細ページのスレッド表示", () => {
    test("スレッド由来entryのサンプルページで、先頭から末尾まで時系列順にすべて表示される", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")

        await expect(page.getByText("サンプルスレッドEntry")).toBeVisible()
        await expect(
            page.getByText(
                "スレッド1件目（先頭投稿）です。画像が1枚付いています。",
            ),
        ).toBeVisible()
        await expect(
            page.getByText("スレッド2件目です。画像が3枚付いています。"),
        ).toBeVisible()
        await expect(
            page.getByText("スレッド3件目です。画像が5枚付いています。"),
        ).toBeVisible()

        const items = await page.locator("ol > li").allTextContents()
        expect(items).toHaveLength(5)
        expect(items[0]).toContain("スレッド1件目")
        expect(items[1]).toContain("スレッド2件目")
        expect(items[2]).toContain("スレッド3件目")
        expect(items[3]).toContain("スレッド4件目")
        expect(items[4]).toContain("スレッド5件目")

        // スレッドバッジは表示せず、Entryのカード画像（View）が表示される。
        await expect(
            page.locator("header").getByText("スレッド", { exact: true }),
        ).toHaveCount(0)
        await expect(page.getByTestId("entry-visual")).toBeVisible()
    })
})
