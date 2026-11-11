/**
 * Checks utility interactions through observable browser state and logs.
 * WebShare is unavailable in headless Chromium and is verified manually.
 */
import { expect, test, type ConsoleMessage, type Page } from "@playwright/test"
import { fakeRequestPaths, loginWithAppPassword } from "./support"

/**
 * Collects browser errors and warnings and prints them immediately so logs survive failures.
 * Returns the recorded lines for checking uncaught page errors.
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

        // Find the non-search language dropdown as a WAI-ARIA combobox.
        // Accept both labels because selecting English changes the accessible name.
        const combo = page.getByRole("combobox", {
            name: /^(表示言語|Language)$/,
        })
        await expect(combo).toBeVisible()
        await combo.focus()
        await expect(combo).toHaveAttribute("aria-expanded", "false")

        // Enter opens the listbox, which contains the system, Japanese, and English options.
        await page.keyboard.press("Enter")
        await expect(combo).toHaveAttribute("aria-expanded", "true")
        const listbox = page.getByRole("listbox")
        await expect(listbox).toBeVisible()
        const options = listbox.getByRole("option")
        await expect(options).toHaveCount(3)
        const idOf = async (i: number) =>
            (await options.nth(i).getAttribute("id")) ?? ""

        // Arrow keys move the active descendant to the matching option.
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
        // Navigation does not wrap at either end.
        await page.keyboard.press("ArrowDown")
        await expect(combo).toHaveAttribute(
            "aria-activedescendant",
            await idOf(2),
        )

        // Escape closes the list without changing the selected language.
        await page.keyboard.press("Escape")
        await expect(combo).toHaveAttribute("aria-expanded", "false")
        await expect(combo).not.toContainText("English")

        // Reopen the list and select English with End and Enter.
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
        // The body is not fixed before the dialog opens.
        expect(await bodyStyle()).toEqual({ position: "", width: "" })

        // The drafts and scheduled button opens a dialog inside the overlay.
        await page.getByRole("button", { name: "下書き・予約" }).click()
        const dialog = page.getByRole("dialog", { name: "下書き・予約" })
        await expect(dialog).toBeVisible()
        // While open, scroll locking fixes the body and sets its width to 100%.
        expect(await bodyStyle()).toEqual({ position: "fixed", width: "100%" })

        // Escape closes the dialog and restores the body styles.
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
        // Register the popup listener before the action so early popup logs are captured.
        const popupLogs: string[] = []
        const popupReady = new Promise<Page>(resolve => {
            page.on("popup", popup => {
                popupLogs.push(...collectLogs(popup, "c-popup"))
                resolve(popup)
            })
        })

        await loginWithAppPassword(page)
        // Enable popup sharing; the default setting is disabled.
        await page.goto("/settings/")
        await page.evaluate(() =>
            window.localStorage.setItem("popupIntentInsteadOfWebshare", "true"),
        )

        // Stub x.com so the test can inspect the intent URL without navigating externally.
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

        // Verify that the post API reached the fake PDS.
        await expect
            .poll(async () => (await fakeRequestPaths()).slice(before), {
                timeout: 30_000,
            })
            .toContain("POST /xrpc/com.atproto.repo.applyWrites")

        // The popup opened after posting navigates to the X intent URL.
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
