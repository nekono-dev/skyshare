/**
 * ThreadComposer（スレッド投稿UI）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - `.claude/skills/spec-driven-development/SKILL.md`が定める「UI実装の検証には
 *   Playwrightによるヘッドレスブラウザでの実動作確認を必須とする」方針の対象テスト。
 * - `/post/?guest`（ログイン不要のゲスト表示、`src/lib/guestMode.ts`）を使い、
 *   実Blueskyアカウント無しでセグメントの追加・画像添付・アクティブ切り替えを検証する
 *   （実際のBluesky投稿はゲスト表示ではスキップされるため対象外。投稿そのものの検証は
 *   ログイン可能な環境での手動確認に委ねる）。
 * - 主眼は、非アクティブ化に伴う`ImagePicker`の再マウントで画像プレビューが消える
 *   不具合（`specs/threadpost`のバグ修正）の回帰防止。
 */
import { expect, test, type Locator } from "@playwright/test"

/**
 * Astroアイランド（Reactコンポーネント）は、SSR直後はDOM上に見えていても
 * クライアント側のハイドレーションが完了するまでクリックイベントに反応しない
 * 瞬間があるため、`click()`が「見た目には成功したがReactのイベントハンドラには
 * 届いていなかった」場合に備え、効果（`target`が現れること）が出るまでクリックを
 * リトライする。
 */
const clickUntilEffect = async (trigger: Locator, target: Locator) => {
    await expect(async () => {
        await trigger.click()
        await expect(target).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
}

const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
)

test.describe("ThreadComposer", () => {
    // Astro dev サーバー(Vite)はオンデマンドコンパイルのため、このスイート最初の
    // ナビゲーションだけ本ページの依存モジュール一式（React・ImagePicker・
    // クロップ編集UI等）のコールドコンパイルが走り得る。個々のテストの
    // デフォルトタイムアウト内に収まらないことがあるため、実テストの前に
    // 長めのタイムアウトで一度だけウォームアップ・ナビゲーションしておく。
    test.beforeAll(async ({ browser }) => {
        // beforeAllフック自体のタイムアウト（configの`timeout`が既定値）を、
        // コールドコンパイルを待つのに十分な長さへこの1回だけ延長する。
        test.setTimeout(90_000)
        const page = await browser.newPage({ ignoreHTTPSErrors: true })
        await page.goto("/post/?guest", { timeout: 60_000 })
        await expect(page.getByTestId("thread-segment-0")).toBeVisible({
            timeout: 60_000,
        })
        await page.close()
    })

    test("セグメント追加後も、画像を添付したセグメントのプレビューが保持される", async ({
        page,
    }) => {
        await page.goto("/post/?guest")

        const segment0 = page.getByTestId("thread-segment-0")
        await expect(segment0).toBeVisible()

        // 先頭セグメントは常にアクティブな状態で開始する。
        const segment0Editor = segment0.getByTestId("segment-editor")
        await expect(segment0Editor).toBeVisible()

        // 本文を入力する。
        const editor0 = segment0Editor.locator("[data-post-body-editor]")
        await editor0.click()
        await page.keyboard.type("1件目のテスト投稿")
        await expect(editor0).toContainText("1件目のテスト投稿")

        // 画像を1枚添付する。
        await segment0Editor.locator('input[type="file"]').setInputFiles({
            name: "test.png",
            mimeType: "image/png",
            buffer: PNG_1X1,
        })

        // ImagePickerが画像を処理し終えると「サムネ調整」ボタンが現れる
        // （slots.length > 0 の目印。画像プレビュー自体はポータル先要素に描画される）。
        await expect(
            segment0Editor.getByRole("button", { name: "サムネ調整" }),
        ).toBeVisible()

        // 「スレッドに追加」で2セグメント目を追加する。
        const segment1 = page.getByTestId("thread-segment-1")
        await clickUntilEffect(
            page.getByRole("button", { name: "スレッドに追加" }),
            segment1,
        )
        await expect(segment1.getByTestId("segment-editor")).toBeVisible()

        // 先頭セグメントは非アクティブになり、簡略表示に切り替わる。
        const segment0Summary = segment0.getByTestId("segment-summary")
        await expect(segment0Summary).toBeVisible()
        await expect(segment0Editor).toBeHidden()

        // 非アクティブでも、画像を添付したセグメントにはサムネイルプレビューが表示される
        // （修正前は画像が付いていないかのような表示になっていた）。
        await expect(
            segment0Summary.getByTestId("segment-thumbnail"),
        ).toBeVisible()
        await expect(segment0Summary).toContainText("1件目のテスト投稿")

        // 先頭セグメントを再度アクティブにする。
        await segment0Summary.click()
        await expect(segment0Editor).toBeVisible()
        await expect(segment0Summary).toBeHidden()

        // ImagePickerが再マウントされても、以前に添付した画像の編集状態
        // （「サムネ調整」ボタンの存在＝slotsが保持されていること）が失われていない。
        await expect(
            segment0Editor.getByRole("button", { name: "サムネ調整" }),
        ).toBeVisible()
        await expect(editor0).toContainText("1件目のテスト投稿")
    })

    test("先頭セグメントは削除できず、2件目以降は削除できる", async ({
        page,
    }) => {
        await page.goto("/post/?guest")

        const segment1 = page.getByTestId("thread-segment-1")
        await clickUntilEffect(
            page.getByRole("button", { name: "スレッドに追加" }),
            segment1,
        )

        // 「スレッドに追加」直後は2件目がアクティブなため、削除ボタンは
        // 非アクティブなセグメントにのみ表示される（先頭セグメントをクリックして
        // アクティブに戻すと、2件目が非アクティブになり削除ボタンが現れる）。
        const segment0Summary = page
            .getByTestId("thread-segment-0")
            .getByTestId("segment-summary")
        await segment0Summary.click()
        const segment1Summary = segment1.getByTestId("segment-summary")
        await expect(
            segment1Summary.getByRole("button", {
                name: "このセグメントを削除",
            }),
        ).toBeVisible()

        // 先頭セグメントの簡略表示には削除ボタンが無い。
        await expect(
            segment0Summary.getByRole("button", {
                name: "このセグメントを削除",
            }),
        ).toHaveCount(0)

        await segment1Summary
            .getByRole("button", { name: "このセグメントを削除" })
            .click()
        await expect(segment1).toBeHidden()
    })
})
