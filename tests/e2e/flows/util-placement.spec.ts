// util-placement で移した振る舞いの確認（tasks.md 7.4）。既存の e2e の流れ（six flows）が覆わない操作を、
// 画面の見た目ではなく検査できる値（aria 属性・body のスタイル・window.open の URL・ブラウザのログ）で確かめる。
//   (a) Dropdown のキーボード操作（Dropdown/rules の navigation・結線）
//   (b) Overlay のスクロールロック（Overlay/rules/scrollLock.ts の結線）
//   (c) 自動ポップアップの intent URL（lib/share/intent ・ IntentShareDialog/openIntentPopup.ts の結線）
// (d) WebShare API（navigator.share）は headless Chromium では使えないため、この spec では扱わない（手動確認）。
import { expect, test, type ConsoleMessage, type Page } from "@playwright/test"
import { fakeRequestPaths, loginWithAppPassword } from "./support"

/**
 * ブラウザのログ（console の error・warning と、未捕捉の例外）を集める。
 * 集めた行は発生した時点で標準出力へ `[e2e-log]` の接頭辞で出す（途中で失敗しても残すため）。
 * 戻り値の `lines` で、未捕捉の例外（pageerror）の有無を検査する。
 */
const collectLogs = (page: Page, label: string) => {
    const lines: string[] = []
    const record = (line: string) => {
        lines.push(line)
        console.log(`[e2e-log] ${line}`)
    }
    page.on("console", (msg: ConsoleMessage) => {
        if (msg.type() === "error" || msg.type() === "warning") {
            record(`[${label}][console.${msg.type()}] ${msg.text()}`)
        }
    })
    page.on("pageerror", err => {
        record(`[${label}][pageerror] ${err.message}`)
    })
    return lines
}

test.describe("util-placement behaviors", () => {
    test("(a) language dropdown: keyboard opens, moves, selects and closes", async ({
        page,
    }) => {
        const logs = collectLogs(page, "a-dropdown")
        await loginWithAppPassword(page)
        await page.goto("/settings/")
        await page.waitForLoadState("networkidle")

        // 表示言語の Dropdown（非検索）。WAI-ARIA の combobox として見つける
        // 英語へ切り替えるとラベルも変わるため、両方の言語のラベルで探す
        const combo = page.getByRole("combobox", {
            name: /^(表示言語|Language)$/,
        })
        await expect(combo).toBeVisible()
        await combo.focus()
        await expect(combo).toHaveAttribute("aria-expanded", "false")

        // Enter で開く（一覧は listbox。選択肢は 3 件: システム・日本語・English）
        await page.keyboard.press("Enter")
        await expect(combo).toHaveAttribute("aria-expanded", "true")
        const listbox = page.getByRole("listbox")
        await expect(listbox).toBeVisible()
        const options = listbox.getByRole("option")
        await expect(options).toHaveCount(3)
        const idOf = async (i: number) =>
            (await options.nth(i).getAttribute("id")) ?? ""

        // 矢印キーで移動し、aria-activedescendant が対応する選択肢を指す
        await page.keyboard.press("End")
        await expect(combo).toHaveAttribute(
            "aria-activedescendant",
            await idOf(2),
        )
        await page.keyboard.press("Home")
        await expect(combo).toHaveAttribute(
            "aria-activedescendant",
            await idOf(0),
        )
        await page.keyboard.press("ArrowDown")
        await expect(combo).toHaveAttribute(
            "aria-activedescendant",
            await idOf(1),
        )
        await page.keyboard.press("ArrowDown")
        await expect(combo).toHaveAttribute(
            "aria-activedescendant",
            await idOf(2),
        )
        // 端では移動しない（循環しない）
        await page.keyboard.press("ArrowDown")
        await expect(combo).toHaveAttribute(
            "aria-activedescendant",
            await idOf(2),
        )

        // Escape で確定せずに閉じ、表示は変わらない
        await page.keyboard.press("Escape")
        await expect(combo).toHaveAttribute("aria-expanded", "false")
        await expect(combo).not.toContainText("English")

        // もう一度開き、End → Enter で English を確定する
        await page.keyboard.press("Enter")
        await expect(combo).toHaveAttribute("aria-expanded", "true")
        await page.keyboard.press("End")
        await page.keyboard.press("Enter")
        await expect(combo).toHaveAttribute("aria-expanded", "false")
        await expect(combo).toContainText("English")

        expect(logs.filter(l => l.includes("[pageerror]"))).toEqual([])
    })

    test("(b) overlay: body is scroll-locked while open and restored after Escape", async ({
        page,
    }) => {
        const logs = collectLogs(page, "b-overlay")
        await loginWithAppPassword(page)
        await page.goto("/post/")
        await page.waitForLoadState("networkidle")

        const bodyStyle = () =>
            page.evaluate(() => ({
                position: document.body.style.position,
                width: document.body.style.width,
            }))
        // 開く前は固定されていない
        expect(await bodyStyle()).toEqual({ position: "", width: "" })

        // 「下書き・予約」は Overlay の内側のダイアログを開く
        await page.getByRole("button", { name: "下書き・予約" }).click()
        const dialog = page.getByRole("dialog", { name: "下書き・予約" })
        await expect(dialog).toBeVisible()
        // 表示中は body が固定され、幅が 100% になる（scrollLock の acquire）
        expect(await bodyStyle()).toEqual({ position: "fixed", width: "100%" })

        // Escape で閉じると、body の固定が元に戻る（scrollLock の release）
        await page.keyboard.press("Escape")
        await expect(dialog).toBeHidden()
        expect(await bodyStyle()).toEqual({ position: "", width: "" })

        expect(logs.filter(l => l.includes("[pageerror]"))).toEqual([])
    })

    test("(c) auto popup: opens the X intent URL with the posted text", async ({
        page,
        context,
    }) => {
        const pageLogs = collectLogs(page, "c-post")
        // ポップアップの監視は、開く操作より前に登録する（開いた直後のログも取りこぼさないため）
        const popupLogs: string[] = []
        const popupReady = new Promise<Page>(resolve => {
            page.on("popup", popup => {
                popupLogs.push(...collectLogs(popup, "c-popup"))
                resolve(popup)
            })
        })

        await loginWithAppPassword(page)
        // 「WebShare の代わりにポップアップを開く」を有効にする（既定は無効のため、保存値で切り替える）
        await page.goto("/settings/")
        await page.evaluate(() =>
            window.localStorage.setItem("popupIntentInsteadOfWebshare", "true"),
        )

        // x.com へは実際に出ない（サンドボックス）。intent の URL だけを確かめるため、応答を固定する
        await context.route(/^https:\/\/x\.com\//, route =>
            route.fulfill({
                status: 200,
                contentType: "text/html; charset=utf-8",
                body: "<!doctype html><title>x</title>",
            }),
        )

        const before = (await fakeRequestPaths()).length
        await page.goto("/post/")
        await page.waitForLoadState("networkidle")
        const body = page.locator('[contenteditable="true"]').first()
        await expect(body).toBeVisible()
        await body.click()
        await page.keyboard.type("E2E の共有です")
        const submit = page.getByTestId("composer-submit")
        await expect(submit).toBeEnabled({ timeout: 15_000 })
        await submit.click()

        // 投稿の API が偽の PDS まで届いたことを確かめる（投稿の成功の確認）
        await expect
            .poll(async () => (await fakeRequestPaths()).slice(before), {
                timeout: 30_000,
            })
            .toContain("POST /xrpc/com.atproto.repo.applyWrites")

        // 投稿の直後に開いたポップアップが、X の intent の URL へ遷移する
        const popup = await popupReady
        await expect
            .poll(() => popup.url(), { timeout: 30_000 })
            .toMatch(/^https:\/\/x\.com\/intent\/tweet\?/)
        const text = new URL(popup.url()).searchParams.get("text") ?? ""
        expect(text).toContain("E2E の共有です")

        expect(
            [...pageLogs, ...popupLogs].filter(l => l.includes("[pageerror]")),
        ).toEqual([])
    })
})
