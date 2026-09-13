/**
 * entry詳細ページ（`entries/[slug].astro`）のスレッド表示（`EntryThreadView`）の
 * ヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - `entries/[slug].astro`のスレッド表示ロジック自体は、実PDSレコード・ログインに
 *   依存するSSR取得（`app.bsky.feed.getPostThread`）を伴うため、実アカウントが無い
 *   このテスト環境では直接検証できない（実アカウントでの確認は手動確認タスクとして
 *   別途残す）。ここでは`entries/sample.astro`（単発投稿のフォールバック表示、既存）と
 *   `entries/sample-thread.astro`（スレッド表示、`[slug].astro`と同じ`EntryThreadView`を
 *   描画する新設サンプルページ）を用いて、コンポーネント自体の描画を検証する。
 * - `specs/entry/frontend/requirements.md`の受け入れ条件のうち、「先頭から後続投稿まで
 *   時系列順にすべて表示される」「単発投稿由来entryは従来通り単一投稿として表示される」を
 *   実ブラウザでのレンダリング結果として確認する。
 */
import { expect, test } from "@playwright/test"

test.describe("entry詳細ページのスレッド表示", () => {
    test("スレッド由来entryのサンプルページで、先頭から末尾まで時系列順にすべて表示される", async ({
        page,
    }) => {
        await page.goto("/entries/sample-thread/")

        await expect(page.getByText("サンプルスレッドEntry")).toBeVisible()
        await expect(
            page.getByText("スレッド1件目（先頭投稿）です。"),
        ).toBeVisible()
        await expect(
            page.getByText("スレッド2件目です。画像が付いています。"),
        ).toBeVisible()
        await expect(
            page.getByText("スレッド3件目（末尾投稿）です。"),
        ).toBeVisible()

        const texts = await page.locator("ol li p").allTextContents()
        expect(texts).toEqual([
            "スレッド1件目（先頭投稿）です。",
            "スレッド2件目です。画像が付いています。",
            "スレッド3件目（末尾投稿）です。",
        ])

        // スレッド由来であることを示す視覚的区別（FR-6）。
        await expect(page.getByText("スレッド", { exact: true })).toBeVisible()
    })

    test("単発投稿由来entryのサンプルページは、従来通り単一投稿として表示され、スレッド由来バッジも表示されない", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")

        // スレッド表示専用の要素（投稿順に並ぶリスト）が無いこと。
        await expect(page.locator("ol li")).toHaveCount(0)
        // FR-6: 単発投稿由来entryにはスレッド由来バッジを表示しない。
        await expect(page.getByText("スレッド", { exact: true })).toHaveCount(0)
    })
})
