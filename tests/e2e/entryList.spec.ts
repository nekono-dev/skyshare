/**
 * Entry一覧ページ（`/entries`、`EntryCard`）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - entry/frontend Phase3（`EntryDeleteConfirmDialog`の`showThreadOption`拡張、
 *   `EntryCard`の`resolveThreadDeleteOption`呼び出し追加）がページのレンダリング自体を
 *   壊していないことを、ログイン不要のゲスト表示（`/entries/?guest`）で確認する。
 * - ゲスト表示では削除・編集ボタンは無効化されるため（実Bluesky操作を伴うため）、
 *   「スレッド全体を削除」選択肢の実際の出し分け・削除フロー自体は検証できない
 *   （実アカウントでの確認が必要、手動確認タスクとして別途残す）。
 */
import { expect, test } from "@playwright/test"

test.describe("Entry一覧ページ", () => {
    test("ゲスト表示でカードが表示され、削除ボタンが無効化された状態でレンダリングされる", async ({
        page,
    }) => {
        await page.goto("/entries/?guest")

        const deleteButton = page.getByRole("button", { name: "削除" }).first()
        await expect(deleteButton).toBeVisible()
        await expect(deleteButton).toBeDisabled()
    })
})
