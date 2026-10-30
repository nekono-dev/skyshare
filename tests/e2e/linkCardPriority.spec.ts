/**
 * 「Skyshareのリンクカードを優先表示」（`.kiro/specs/link-card-priority`）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - `/post/?guest` と `/settings/` で、切り替えの位置・既定値・画像を自分で添付との連動を検証する。
 * - `/?guest` のタイムラインで、本文にURLを持つentry付きの投稿（ゲスト表示の `guest-rich-text`）を
 *   Xへ共有したときの共有文を、開いたポップアップのURL（intentの`text`）で検証する。
 * - 投稿フォームからの共有はゲスト表示では skyshare URL が発行されないため、
 *   共有文の組み立ては単体テスト（`tests/lib/share/shareBody.test.ts`）で検証する。
 */
import { expect, routeDefaultSurveyRespondent, test } from "./fixtures"
import { type BrowserContext, type Locator, type Page } from "@playwright/test"

const LABEL_MANUAL_ATTACH_COMPOSER = "画像を自分で添付する（URLを発行しない）"
const LABEL_MANUAL_ATTACH_SETTINGS = "画像を自分で添付する"
const LABEL_PRIORITY = "Skyshareのリンクカードを優先表示"
const RICH_TEXT_POST = "ハッシュタグ・メンション・URLを含む投稿の表示です。"
const DIALOG_NAME = "共有先を選択"

/** 全Astroアイランドのハイドレーション完了を待つ（完了すると`ssr`属性が外れる）。 */
const waitHydrated = async (page: Page) => {
    await page.waitForFunction(
        () => document.querySelector("astro-island[ssr]") === null,
    )
}

/** 初期表示前に localStorage へ値を入れる（初回ナビゲーション時のみ）。 */
const seedStorage = async (page: Page, values: Record<string, string>) => {
    await page.addInitScript((entries: Record<string, string>) => {
        if (window.sessionStorage.getItem("__seeded") === "1") return
        window.sessionStorage.setItem("__seeded", "1")
        Object.entries(entries).forEach(([key, value]) =>
            window.localStorage.setItem(key, value),
        )
    }, values)
}

/** 外部SNSへの実アクセスを空の200応答に置き換える。 */
const stubExternalSns = (context: BrowserContext) =>
    context.route(
        /^https:\/\/(x\.com|taittsuu\.com|mastodon\.social)\//,
        route => route.fulfill({ status: 200, body: "" }),
    )

/** a が b より文書順で前にあり、間に他の切り替え（switch）を挟まないか */
const isImmediatelyBefore = async (a: Locator, b: Locator) => {
    const handleA = await a.elementHandle()
    const handleB = await b.elementHandle()
    return a.page().evaluate(
        ([first, second]) => {
            const switches = Array.from(
                document.querySelectorAll('[role="switch"]'),
            )
            return switches.indexOf(second!) - switches.indexOf(first!) === 1
        },
        [handleA, handleB],
    )
}

/** タイムラインのリンク付き投稿の共有ダイアログからXを選び、共有文を返す。 */
const shareRichTextPostToX = async (page: Page) => {
    const card = page.locator("article", { hasText: RICH_TEXT_POST })
    const crosspost = card.getByRole("button", { name: "クロスポスト" })
    await expect(crosspost).toBeVisible({ timeout: 30_000 })
    await crosspost.click()
    const dialog = page.getByRole("dialog", { name: DIALOG_NAME })
    await expect(dialog).toBeVisible()
    const popupPromise = page.waitForEvent("popup")
    await dialog.getByRole("button", { name: "X に投稿" }).click()
    const popup = await popupPromise
    return new URL(popup.url()).searchParams.get("text") ?? ""
}

test.describe("Skyshareのリンクカードを優先表示", () => {
    test.beforeAll(async ({ browser }) => {
        // devサーバーの初回コンパイルを待つためのウォームアップ。
        test.setTimeout(90_000)
        const page = await browser.newPage({ ignoreHTTPSErrors: true })
        await routeDefaultSurveyRespondent(page.context())
        await page.goto("/post/?guest", { timeout: 60_000 })
        await page.close()
    })

    test("[link-card-priority/1.2 link-card-priority/1.3] 投稿フォームで画像を自分で添付の直後に表示され、既定はONで、手動添付をONにすると操作不能になる", async ({
        page,
    }) => {
        await page.goto("/post/?guest")
        await waitHydrated(page)
        const manual = page.getByRole("switch", {
            name: LABEL_MANUAL_ATTACH_COMPOSER,
        })
        const priority = page.getByRole("switch", { name: LABEL_PRIORITY })
        await expect(priority).toBeChecked()
        await expect(priority).toBeEnabled()
        expect(await isImmediatelyBefore(manual, priority)).toBe(true)

        await manual.setChecked(true, { force: true })
        await expect(priority).toBeDisabled()
    })

    test("[link-card-priority/1.2] 設定ページで画像を自分で添付の直後に表示される", async ({
        page,
    }) => {
        await page.goto("/settings/?guest")
        await waitHydrated(page)
        const manual = page.getByRole("switch", {
            name: LABEL_MANUAL_ATTACH_SETTINGS,
            exact: true,
        })
        const priority = page.getByRole("switch", { name: LABEL_PRIORITY })
        await expect(priority).toBeChecked()
        expect(await isImmediatelyBefore(manual, priority)).toBe(true)
        await manual.setChecked(true, { force: true })
        await expect(priority).toBeDisabled()
    })

    test("[link-card-priority/3.1] タイムラインのentryを持つカードの共有ダイアログでXを選ぶと、共有文に本文のURLが含まれない", async ({
        page,
        context,
    }) => {
        await stubExternalSns(context)
        await page.goto("/?guest")
        await waitHydrated(page)
        const text = await shareRichTextPostToX(page)
        expect(text).toContain("#skyshare")
        expect(text).not.toContain("https://example.com/")
        expect(text).toMatch(/\/entries\/sample\/$/)
    })

    test("[link-card-priority/2.3] 設定がOFFのとき、タイムラインの共有文に本文のURLが残る", async ({
        page,
        context,
    }) => {
        await stubExternalSns(context)
        await seedStorage(page, { preferSkyshareLinkCard: "false" })
        await page.goto("/?guest")
        await waitHydrated(page)
        const text = await shareRichTextPostToX(page)
        expect(text).toContain("https://example.com/")
    })

    test("[link-card-priority/1.4] 設定を保存した状態で投稿フォームを開いても、ハイドレーションの警告が出力されない", async ({
        page,
    }) => {
        const warnings: string[] = []
        page.on("console", message => {
            if (
                ["warning", "error"].includes(message.type()) &&
                /hydrat|did not match|server-rendered/i.test(message.text())
            ) {
                warnings.push(message.text())
            }
        })
        await seedStorage(page, { preferSkyshareLinkCard: "false" })
        await page.goto("/post/?guest")
        await waitHydrated(page)
        await expect(
            page.getByRole("switch", { name: LABEL_PRIORITY }),
        ).not.toBeChecked()
        expect(warnings).toEqual([])
    })
})
