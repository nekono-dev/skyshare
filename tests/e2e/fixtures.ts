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
 * - 回答済みの確認（`/v2/surveys/{id}/respondent/`）に既定で「回答済み」を返し、アンケートの確認を出さない。
 *   検証用の設定が有効な間も既存の画面の確認に影響させないため。アンケートの spec は同じ宛先を後から登録して上書きする。
 * - 配信用のアンケート設定が取得できないときに、アンケートの確認を見送る理由を返す（`publishedSurveyConfigSkipReason`）。
 */
import type { APIRequestContext, BrowserContext } from "@playwright/test"
import { expect, test as base } from "@playwright/test"
import { surveyConfigSkipReason } from "../../hack/surveyE2eHarness.mjs"

export { expect }

/** ハイドレーション待ちの上限（ミリ秒） */
const HYDRATION_TIMEOUT_MS = 10_000

/** 回答済みの確認の宛先（`/v2/surveys/{surveyId}/respondent/`） */
const RESPONDENT_PATH = /\/v2\/surveys\/[^/]+\/respondent\/?$/

/** 配信用のアンケート設定の取得先（`npm run survey:render` が生成する） */
const SURVEY_CONFIG_PATH = "/surveys/index.json"

/**
 * 回答済みの確認（`/v2/surveys/{id}/respondent/`）の GET に「回答済み」を返す経路を登録する。
 *
 * 処理の趣旨:
 * - BrowserContext・Page のどちらにも登録できる（`browser.newPage` / `context.newPage` で作るページにも使う）。
 *   ページ単位の経路は文脈単位の経路より先に評価されるため、spec がページに後から登録した経路が既定より優先される。
 * - 同じ宛先への経路は、後から登録したものが先に評価される。GET 以外は素通しする（fallback）。
 *
 * Input: `target`（BrowserContext または Page）。ページ・文脈は、最初の goto の前に登録する
 * Output: 登録の完了
 *
 * 例: `const context = await browser.newContext(); await routeDefaultSurveyRespondent(context)`
 */
export const routeDefaultSurveyRespondent = async (
    target: Pick<BrowserContext, "route">,
): Promise<void> => {
    await target.route(
        url => RESPONDENT_PATH.test(url.pathname),
        route =>
            route.request().method() === "GET"
                ? route.fulfill({
                      status: 200,
                      contentType: "application/json",
                      body: JSON.stringify({ answered: true }),
                  })
                : route.fallback(),
    )
}

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
        // 既定では「回答済み」として、ログイン後のアンケートの確認を出さない
        await routeDefaultSurveyRespondent(page)
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
 * アンケートの確認の前に、配信用の設定が取得できるかを確かめる。取得できないときは見送る理由を返す。
 *
 * 処理の趣旨:
 * - `npm run test:e2e` が自分で起動した dev サーバーでは、起動の前に生成されている。
 *   起動済みの dev サーバーでは生成されないため、ここで確かめて理由を示して見送る。
 *
 * Input: `request`（baseURL を使う APIRequestContext）
 * Output: 取得できれば undefined、できなければ見送る理由の文言
 *
 * 例: `const reason = await publishedSurveyConfigSkipReason(request); test.skip(Boolean(reason), reason)`
 */
export const publishedSurveyConfigSkipReason = async (
    request: APIRequestContext,
): Promise<string | undefined> => {
    const available = await request
        .get(SURVEY_CONFIG_PATH)
        .then(res => res.ok())
        .catch(() => false)
    return surveyConfigSkipReason(available)
}

/**
 * ログインのフォームで、従来形式でのログイン（アプリパスワード）の折りたたみを開く（既定は閉じている）。
 *
 * 処理の趣旨:
 * - ハイドレーションの前に押したクリックは無視されるため、ハンドルの入力欄が出るまで押し直す。
 *   開いた後に押すと閉じるため、入力欄が出ていれば押さない。
 *
 * Input: `scope`（ページ、またはログインのフォームのロケーター）、`name`（折りたたみの名前。既定は日本語と英語の両方に一致する）
 * Output: なし（入力欄が表示された状態で戻る）
 *
 * 例: `await openPasswordLogin(page.locator("#login-form"))`
 */
export const openPasswordLogin = async (
    scope: Pick<import("@playwright/test").Page, "getByRole" | "locator">,
    name: string | RegExp = /^(従来形式でのログイン|Classic login)$/,
): Promise<void> => {
    await expect(async () => {
        if (!(await scope.locator("#username").isVisible())) {
            await scope.getByRole("button", { name }).click()
        }
        await expect(scope.locator("#username")).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 30_000 })
}
