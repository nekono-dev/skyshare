/**
 * Entry一覧ページ（`/entries`、`EntryCard`）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - ログイン不要のゲスト表示（`/entries/?guest`）でカードが正しくレンダリングされ、
 *   削除ボタンが有効（削除フローはアプリ内で模擬される）であることを確認する。
 * - 削除フロー自体の検証は`entryDeleteDialog.spec.ts`で行う。
 */
import { expect, test } from "@playwright/test"

test.describe("Entry一覧ページ", () => {
    test("ゲスト表示でカードが表示され、削除ボタンが有効な状態でレンダリングされる", async ({
        page,
    }) => {
        await page.goto("/entries/?guest")

        const deleteButton = page.getByRole("button", { name: "削除" }).first()
        await expect(deleteButton).toBeVisible()
        await expect(deleteButton).toBeEnabled()
    })
})
