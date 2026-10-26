/**
 * スマホ幅（390px）でのデザイントークンの上書き（.kiro/specs/design-tokens）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - 幅390pxのビューポートで、フォントサイズ・ボタンの余白と高さ・フッターナビゲーション分の下余白・
 *   横スクロールの有無を実測する。
 * - 直書きのフォントサイズが無いことの検査は`tests/styles/hardcodedFontSize.test.ts`で行う。
 */
import { expect, openPasswordLogin, test } from "./fixtures"

test.use({ viewport: { width: 390, height: 844 } })

test("[design-tokens/1.1] 幅390pxの画面で、中サイズの本文のフォントサイズが18pxになる", async ({
    page,
}) => {
    await page.goto("/login/", { timeout: 60_000 })
    const fontSize = await page.evaluate(() => {
        const probe = document.createElement("span")
        probe.style.fontSize = "var(--font-size-md)"
        document.body.appendChild(probe)
        const size = getComputedStyle(probe).fontSize
        probe.remove()
        return size
    })
    expect(fontSize).toBe("18px")
})

test("[design-tokens/1.2] 幅390pxの画面で、トークンを参照するボタンの左右余白が16pxになる", async ({
    page,
}) => {
    await page.goto("/login/", { timeout: 60_000 })
    // アプリパスワードのログインのボタンは折りたたみの中にあるため、開いてから測る
    await openPasswordLogin(page)
    const button = page.getByRole("button", { name: "ログイン", exact: true })
    await expect(button).toBeVisible({ timeout: 60_000 })
    await expect(button).toHaveCSS("padding-left", "16px")
    await expect(button).toHaveCSS("padding-right", "16px")
})

test("[design-tokens/2.2] 幅390pxの画面で、表示されるすべてのボタンの高さが44px以上になる", async ({
    page,
}) => {
    for (const path of ["/post/?guest", "/?guest", "/login/"]) {
        await page.goto(path, { timeout: 60_000 })
        // プルダウンの開閉ボタン(入力欄の一種)は対象外
        // Astroのdevツールバー(開発時のみ表示される外部UI)のボタンも、アプリの画面ではないため対象外
        const buttons = page.locator('button:not([class*="base-select"])')
        await page.waitForLoadState("networkidle")
        const heights = await buttons.evaluateAll(elements =>
            elements
                .filter(
                    el =>
                        (el.getRootNode() as ShadowRoot).host?.tagName !==
                        "ASTRO-DEV-TOOLBAR",
                )
                .map(el => el.getBoundingClientRect())
                .filter(rect => rect.width > 0 && rect.height > 0)
                .map(rect => rect.height),
        )
        expect(heights.length, path).toBeGreaterThan(0)
        for (const height of heights) {
            expect(height, path).toBeGreaterThanOrEqual(44)
        }
    }
})

test("[design-tokens/3.1] 幅390pxの画面でページ末尾までスクロールしたとき、最後の要素がフッターナビゲーションと重ならない", async ({
    page,
}) => {
    await page.goto("/settings/?guest", { timeout: 60_000 })
    const footer = page.locator('[data-nav="footer"]')
    await expect(footer).toBeVisible({ timeout: 60_000 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const { contentBottom, footerTop } = await page.evaluate(() => {
        const footerEl = document.querySelector('[data-nav="footer"]')!
        let bottom = 0
        for (const el of document.body.querySelectorAll("*")) {
            // 下余白を持つ祖先要素ではなく、末尾の内容そのものの下端を測る
            if (el.children.length > 0) continue
            if (footerEl.contains(el)) continue
            const style = getComputedStyle(el)
            if (style.position === "fixed" || style.display === "none") continue
            const rect = el.getBoundingClientRect()
            if (rect.height > 0 && rect.width > 0) {
                bottom = Math.max(bottom, rect.bottom)
            }
        }
        return {
            contentBottom: bottom,
            footerTop: footerEl.getBoundingClientRect().top,
        }
    })
    expect(contentBottom).toBeLessThanOrEqual(footerTop)
})

test("[design-tokens/3.2] 幅390pxの画面で、文書の横幅が表示領域の横幅を超えない", async ({
    page,
}) => {
    for (const path of ["/login/", "/settings/?guest", "/entries/?guest"]) {
        await page.goto(path, { timeout: 60_000 })
        await page.waitForLoadState("networkidle")
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
        }))
        expect(scrollWidth, path).toBeLessThanOrEqual(innerWidth)
    }
})
