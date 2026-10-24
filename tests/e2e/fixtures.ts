/**
 * e2eテスト共通のPlaywrightフィクスチャ。
 *
 * 責務と処理概要:
 * - 全specの`test`の代わりに、このファイルが再エクスポートする`test`を使う。
 * - `page.goto`の完了後、Astroの`client:load`アイランド（`<astro-island ssr>`）が
 *   すべてハイドレーションされるまで待つ。ハイドレーション前のクリック・キー入力は
 *   イベントハンドラ未接続のため無視され、テストが不安定になる原因だった。
 * - Astro dev toolbar（`<astro-dev-toolbar>`）を取り除く。toolbarはislandのpropsを
 *   shadow DOM内に表示することがあり、`getByText`がそこにも一致して
 *   strict mode violationを起こすため。
 * - `net::ERR_NETWORK_CHANGED`による`goto`の失敗は再試行する。
 * - 待機が上限を超えても失敗にはせず、そのまま各テストの検証へ進める
 *   （ハイドレーション自体の不具合は各テストの検証で検出する）。
 */
import { expect, test as base } from "@playwright/test"

export { expect }

/** ハイドレーション待ちの上限（ミリ秒） */
const HYDRATION_TIMEOUT_MS = 10_000

/**
 * `goto`を実行する。実行環境のネットワークインターフェース変動で起きる
 * `net::ERR_NETWORK_CHANGED`だけは、一過性のため最大3回まで再試行する。
 */
const gotoWithRetry = async <A extends unknown[], R>(
    goto: (...args: A) => Promise<R>,
    args: A,
): Promise<R> => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await goto(...args)
        } catch (err) {
            const transient = String(err).includes("ERR_NETWORK_CHANGED")
            if (!transient || attempt >= 3) throw err
        }
    }
}

export const test = base.extend({
    page: async ({ page }, use) => {
        await page.addInitScript(() => {
            const remove = () =>
                document
                    .querySelectorAll("astro-dev-toolbar")
                    .forEach(el => el.remove())
            new MutationObserver(remove).observe(document, {
                childList: true,
                subtree: true,
            })
        })
        const originalGoto = page.goto.bind(page)
        page.goto = (async (...args: Parameters<typeof originalGoto>) => {
            const res = await gotoWithRetry(originalGoto, args)
            await page
                .waitForFunction(
                    () => !document.querySelector("astro-island[ssr]"),
                    undefined,
                    { timeout: HYDRATION_TIMEOUT_MS },
                )
                .catch(() => {})
            return res
        }) as typeof page.goto
        await use(page)
    },
})

/**
 * ログインのフォームで、アプリパスワードのタブを選ぶ（既定は OAuth のタブ）。
 *
 * 処理の趣旨:
 * - ハイドレーションの前に押したクリックは無視されるため、ハンドルの入力欄が出るまで選び直す。
 *
 * Input: `scope`（ページ、またはログインのフォームのロケーター）、`name`（タブの名前。既定は日本語と英語の両方に一致する）
 * Output: なし（入力欄が表示された状態で戻る）
 *
 * 例: `await choosePasswordTab(page.locator("#login-form"))`
 */
export const choosePasswordTab = async (
    scope: Pick<import("@playwright/test").Page, "getByRole" | "locator">,
    name: string | RegExp = /^(アプリパスワード|App password)$/,
): Promise<void> => {
    await expect(async () => {
        await scope.getByRole("tab", { name }).click()
        await expect(scope.locator("#username")).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 30_000 })
}
