/**
 * 多言語対応（表示言語の判定・切り替え）のE2E。
 *
 * 責務と処理概要:
 * - ブラウザ言語による自動判定、ページ遷移後の維持、静的DOM（ナビ・タイトル）の書き換えを検証する。
 * - 英語環境は `test.use({ locale: "en-US" })`、日本語環境は既定（playwright.config.ts の `ja-JP`）。
 * - ゲスト表示（`?guest`）で実アカウント不要。
 */
import { expect, test, type Locator, type Page } from "@playwright/test"

test.describe("英語ブラウザ", () => {
    test.use({ locale: "en-US" })

    test("初期描画後にナビ・タイトル・lang が英語になり、遷移後も維持される", async ({
        page,
    }) => {
        await page.goto("/entries/?guest")

        await expect(page.locator("html")).toHaveAttribute("lang", "en")
        await expect(page).toHaveTitle("Entries | Skyshare")
        const sidebar = page.locator('nav[data-nav="sidebar"]')
        await expect(sidebar).toHaveAttribute("aria-label", "Main navigation")
        await expect(sidebar.locator('[data-nav-key="settings"]')).toHaveText(
            "Settings",
        )
        await expect(
            sidebar.locator('[data-nav-key="entries"]'),
        ).toHaveAttribute("aria-label", "Entries")

        // サイドバーから別ページへ遷移（View Transitions）
        await sidebar.locator('[data-nav-key="settings"]').click()
        await expect(page).toHaveURL(/\/settings\//)
        await expect(page.locator("html")).toHaveAttribute("lang", "en")
        await expect(page).toHaveTitle("Settings | Skyshare")
        await expect(sidebar.locator('[data-nav-key="settings"]')).toHaveText(
            "Settings",
        )
    })

    test("Entry詳細の投稿日時・元投稿リンクが英語で表示される", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        await expect(page.locator("astro-island[ssr]")).toHaveCount(0)

        await expect(page.getByTestId("entry-source-link")).toHaveText(
            "View original post",
        )
        await expect(page.locator("dl").getByText(/^Posted: /)).toBeVisible()
    })
})

test.describe("日本語ブラウザ", () => {
    test("既定どおり日本語のまま表示される", async ({ page }) => {
        await page.goto("/entries/?guest")

        await expect(page.locator("html")).toHaveAttribute("lang", "ja")
        await expect(page).toHaveTitle("Entry一覧 | Skyshare")
        const sidebar = page.locator('nav[data-nav="sidebar"]')
        await expect(sidebar.locator('[data-nav-key="settings"]')).toHaveText(
            "設定",
        )
    })
})

/**
 * Astroアイランドはハイドレーション完了前のクリックに反応しないことがあるため、
 * 効果（`target`が現れること）が出るまでクリックをリトライする。
 */
const clickUntilVisible = async (trigger: Locator, target: Locator) => {
    await expect(async () => {
        await trigger.click()
        await expect(target).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
}

test.describe("表示言語の切り替え（設定画面）", () => {
    test("English を選ぶと即座に英語になり、再読み込み・遷移後も維持され、システム設定で戻る", async ({
        page,
    }) => {
        await page.goto("/settings/?guest", { timeout: 60_000 })
        const localeTrigger = page.getByRole("combobox", { name: "表示言語" })
        await expect(localeTrigger).toBeVisible({ timeout: 60_000 })

        // 1. 日本語で表示され、トリガーは「システム設定に従う」
        await expect(page.locator("html")).toHaveAttribute("lang", "ja")
        await expect(localeTrigger).toHaveText("システム設定に従う")
        await expect(
            page.getByRole("heading", { name: "表示", exact: true }),
        ).toBeVisible()

        // 2. English を選ぶ → 再読み込みなしで英語になる
        await clickUntilVisible(localeTrigger, page.getByRole("listbox"))
        await page.getByRole("option", { name: "English" }).click()
        await expect(page.locator("html")).toHaveAttribute("lang", "en")
        await expect(
            page.getByRole("combobox", { name: "Language" }),
        ).toHaveText("English")
        await expect(
            page.getByRole("heading", { name: "Display", exact: true }),
        ).toBeVisible()
        await expect(
            page.getByRole("heading", { name: "Settings", exact: true }),
        ).toBeVisible()
        await expect(page).toHaveTitle("Settings | Skyshare")
        await expect(
            page
                .locator('nav[data-nav="sidebar"]')
                .locator('[data-nav-key="entries"]'),
        ).toHaveText("Entries")
        expect(
            await page.evaluate(() => localStorage.getItem("uiLocale")),
        ).toBe("en")

        // 3. 再読み込み後も英語が維持される
        await page.reload()
        await expect(page.locator("html")).toHaveAttribute("lang", "en")
        await expect(
            page.getByRole("combobox", { name: "Language" }),
        ).toHaveText("English", { timeout: 30_000 })
        await expect(page).toHaveTitle("Settings | Skyshare")

        // 4. 別ページへ遷移して戻っても維持される
        await page
            .locator('nav[data-nav="sidebar"]')
            .locator('[data-nav-key="entries"]')
            .click()
        await expect(page).toHaveURL(/\/entries\//)
        await expect(page.locator("html")).toHaveAttribute("lang", "en")
        await page
            .locator('nav[data-nav="sidebar"]')
            .locator('[data-nav-key="settings"]')
            .click()
        await expect(page).toHaveURL(/\/settings\//)
        await expect(
            page.getByRole("combobox", { name: "Language" }),
        ).toHaveText("English")

        // 5. システム設定に従う → 保存が削除され、ブラウザ言語（日本語）に戻る
        const trigger = page.getByRole("combobox", { name: "Language" })
        await clickUntilVisible(trigger, page.getByRole("listbox"))
        await page
            .getByRole("option", { name: "Follow system settings" })
            .click()
        await expect(page.locator("html")).toHaveAttribute("lang", "ja")
        await expect(
            page.getByRole("combobox", { name: "表示言語" }),
        ).toHaveText("システム設定に従う")
        expect(
            await page.evaluate(() => localStorage.getItem("uiLocale")),
        ).toBeNull()
    })
})

/** 日本語（ひらがな・カタカナ・漢字）を含むか。 */
const CJK = /[぀-ヿ㐀-鿿]/

/**
 * ページ内に残っている日本語の表示文言を集める（英語表示の取りこぼし検出用）。
 *
 * 処理の趣旨:
 * - 画面に見えるテキストに加え、placeholder / aria-label / title 属性も対象にする。
 * - 投稿言語の選択肢は各言語の自称表記（翻訳しない）のため、コンボボックス内は除外する。
 * - 幅計測用に描画される非表示要素（aria-hidden）も画面に見えないため除外する。
 * - ゲスト表示のダミー投稿の本文も英語辞書にあるため除外しない。
 *
 * Output:
 * - 日本語を含む文字列の配列（空であれば取りこぼしなし）
 */
const collectJapanese = (page: Page) =>
    page.evaluate((pattern: string) => {
        const cjk = new RegExp(pattern)
        const found: string[] = []
        // 投稿言語の選択肢（自称表記）と、画面に表示されない幅計測用の要素（aria-hidden）は除外する
        const isInsideCombobox = (el: Element | null) =>
            !!el?.closest(
                '[role="combobox"], [role="listbox"], [aria-hidden="true"]',
            )
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
        )
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent ?? ""
            const parent = node.parentElement
            if (
                cjk.test(text) &&
                parent &&
                parent.tagName !== "SCRIPT" &&
                parent.tagName !== "STYLE" &&
                !isInsideCombobox(parent)
            ) {
                found.push(text.trim())
            }
        }
        document
            .querySelectorAll("[placeholder], [aria-label], [title]")
            .forEach(el => {
                if (isInsideCombobox(el)) return
                for (const name of ["placeholder", "aria-label", "title"]) {
                    const value = el.getAttribute(name)
                    if (value && cjk.test(value)) found.push(`${name}=${value}`)
                }
            })
        return found
    }, CJK.source)

test.describe("英語ブラウザ: 画面ごとの翻訳漏れ（ゲスト表示）", () => {
    test.use({ locale: "en-US" })

    test("/post/?guest: 投稿フォームの文言が英語で、日本語が残らない", async ({
        page,
    }) => {
        await page.goto("/post/?guest", { timeout: 60_000 })
        await expect(
            page.getByRole("button", { name: "Post", exact: true }),
        ).toBeVisible({ timeout: 60_000 })
        await expect(
            page.locator('[data-placeholder="What\'s up?"]').first(),
        ).toBeVisible()
        await expect(page.getByRole("button", { name: "Drafts" })).toBeVisible()
        expect(await collectJapanese(page)).toEqual([])
    })

    test("/?guest: ダミー投稿が英語で、スレッドの件数が単数・複数で表示される", async ({
        page,
    }) => {
        await page.goto("/?guest", { timeout: 60_000 })
        await expect(
            page.getByText("Thread A, post 1 (root, no image)."),
        ).toBeVisible({ timeout: 60_000 })
        // スレッドAは返信2件、スレッドBは返信1件
        await expect(
            page
                .getByRole("button", { name: "Expand thread (2 replies)" })
                .first(),
        ).toBeVisible()
        await expect(
            page
                .getByRole("button", { name: "Expand thread (1 reply)" })
                .first(),
        ).toBeVisible()
        expect(await collectJapanese(page)).toEqual([])
    })

    test("/entries/?guest: 一覧・日時・削除ダイアログが英語になる", async ({
        page,
    }) => {
        await page.goto("/entries/?guest", { timeout: 60_000 })
        const card = page.locator("article").first()
        await expect(card).toBeVisible({ timeout: 60_000 })
        // 日時が英語の書式（月名を含む）で表示される
        await expect(card).toContainText(/Sep 6, 2026/)

        await card.getByRole("button", { name: "Delete" }).click()
        const dialog = page.getByRole("dialog")
        await expect(
            dialog.getByRole("button", {
                name: "Delete link and Bluesky post",
            }),
        ).toBeVisible()
        expect(await collectJapanese(page)).toEqual([])

        await dialog
            .getByRole("button", { name: "Delete link and Bluesky post" })
            .click()
        await expect(dialog).toContainText("This will delete 1 Bluesky post.")
    })

    test("/login/ と /help/: 案内文が英語になる", async ({ page }) => {
        await page.goto("/login/", { timeout: 60_000 })
        await expect(
            page.getByText("Persistent Skyshare-generated content"),
        ).toBeVisible({ timeout: 60_000 })
        await expect(page.getByLabel("Handle (the part after @)")).toBeVisible()
        expect(await collectJapanese(page)).toEqual([])

        await page.goto("/help/", { timeout: 60_000 })
        await expect(
            page.getByRole("heading", { name: "Past questions and fixes" }),
        ).toBeVisible()
        await expect(page.getByText("Can't select images")).toBeVisible({
            timeout: 30_000,
        })
        expect(await collectJapanese(page)).toEqual([])
    })
})

test.describe("日本語ブラウザ: 日時書式が従来どおり", () => {
    test("/entries/?guest: 日本語の書式で日時が表示される", async ({
        page,
    }) => {
        await page.goto("/entries/?guest", { timeout: 60_000 })
        const card = page.locator("article").first()
        await expect(card).toContainText(/2026\/09\/06/, { timeout: 60_000 })
    })
})

test.describe("APIエラーの表示（ログイン）", () => {
    for (const { locale, conflict, generic } of [
        {
            locale: "ja-JP",
            conflict:
                "連携できるアカウント数の上限に達しています。先に他のアカウントをログアウトしてください。",
            generic: "ログインに失敗しました。",
        },
        {
            locale: "en-US",
            conflict:
                "You have reached the maximum number of linked accounts. Please log out of another account first.",
            generic: "Login failed.",
        },
    ] as const) {
        test.describe(locale, () => {
            test.use({ locale })

            test("409 はアカウント数上限、500 は汎用のログイン失敗が表示される", async ({
                page,
            }) => {
                let status = 409
                await page.route(/\/v2\/bsky\/session\/?$/, async route => {
                    if (route.request().method() !== "POST") {
                        await route.continue()
                        return
                    }
                    // サーバーは固定の英語文字列しか返さない。画面の文言はステータスから決まる。
                    await route.fulfill({
                        status,
                        contentType: "application/json",
                        body: JSON.stringify({ error: "Conflict" }),
                    })
                })
                await page.goto("/login/", { timeout: 60_000 })
                const form = page.locator("#login-form")
                await expect(form).toBeVisible({ timeout: 60_000 })

                await form.locator("#username").fill("someone.bsky.social")
                await form.locator("#password").fill("password")
                await expect(async () => {
                    await form.locator('button[type="submit"]').click()
                    await expect(page.locator("#message")).toHaveText(
                        conflict,
                        {
                            timeout: 2_000,
                        },
                    )
                }).toPass({ timeout: 15_000 })

                status = 500
                await form.locator('button[type="submit"]').click()
                await expect(page.locator("#message")).toHaveText(generic)
            })
        })
    }
})

test.describe("言語切り替えでの入力保持（FR-7）", () => {
    test("設定画面: 入力中のドメイン欄の内容が、言語を切り替えても失われない", async ({
        page,
    }) => {
        await page.goto("/settings/?guest", { timeout: 60_000 })
        const domain = page.locator("#setting-crosspostToMastodon-text")
        await expect(domain).toBeVisible({ timeout: 60_000 })
        // 水和前に入力すると、水和で値が上書きされる。全アイランドの水和完了を待つ。
        await expect(page.locator("astro-island[ssr]")).toHaveCount(0, {
            timeout: 30_000,
        })
        await domain.fill("mastodon.example")
        await expect(domain).toHaveValue("mastodon.example")

        const trigger = page.getByRole("combobox", { name: "表示言語" })
        await clickUntilVisible(trigger, page.getByRole("listbox"))
        await page.getByRole("option", { name: "English" }).click()

        await expect(
            page.getByRole("heading", { name: "Cross-post", exact: true }),
        ).toBeVisible()
        await expect(domain).toHaveValue("mastodon.example")
    })

    test("/post/?guest: 投稿本文の入力中に言語を切り替えても、本文が保持され文言だけが変わる", async ({
        page,
    }) => {
        await page.goto("/post/?guest", { timeout: 60_000 })
        // 言語を切り替えるとプレースホルダも変わるため、言語に依存しない取得方法にする
        const editor = page.locator("[data-post-body-editor]").first()
        await expect(editor).toBeVisible({ timeout: 60_000 })
        await expect(page.locator("astro-island[ssr]")).toHaveCount(0, {
            timeout: 30_000,
        })
        await editor.click()
        await page.keyboard.type("hello")
        await expect(editor).toContainText("hello")

        // 別タブでの言語設定の変更（storage イベント）を再現し、同一ページ内で言語を切り替える。
        // 投稿ページには言語設定のUIが無いため、イベント経由で切り替える。
        await page.evaluate(() => {
            localStorage.setItem("uiLocale", "en")
            window.dispatchEvent(
                new StorageEvent("storage", { key: "uiLocale" }),
            )
        })

        await expect(
            page.getByRole("button", { name: "Post", exact: true }),
        ).toBeVisible()
        await expect(editor).toContainText("hello")
    })
})

test.describe("サーバー描画ページの言語（FR-13）", () => {
    test.describe("en-US", () => {
        test.use({ locale: "en-US" })

        test("Entry詳細（SSR）は Accept-Language が英語なら lang=en で描画される", async ({
            page,
        }) => {
            const response = await page.goto("/entries/not-exist/", {
                timeout: 60_000,
            })
            // 初期HTML（クライアントが書き換える前）の lang を検証する
            expect(await response!.text()).toMatch(/<html lang="en"/)
            await expect(page.locator("html")).toHaveAttribute("lang", "en")
        })
    })

    test("Entry詳細（SSR）は Accept-Language が日本語なら lang=ja で描画される", async ({
        page,
    }) => {
        const response = await page.goto("/entries/not-exist/", {
            timeout: 60_000,
        })
        expect(await response!.text()).toMatch(/<html lang="ja"/)
    })
})

test.describe("ログイン画面の言語切り替え", () => {
    test("ログイン画面のプルダウンで English を選ぶと、フォームの文言が即座に英語になり再読み込み後も維持される", async ({
        page,
    }) => {
        await page.goto("/login/", { timeout: 60_000 })
        await expect(page.locator("astro-island[ssr]")).toHaveCount(0, {
            timeout: 30_000,
        })
        const trigger = page.getByRole("combobox", { name: "表示言語" })
        await expect(trigger).toHaveText("システム設定に従う")

        await clickUntilVisible(trigger, page.getByRole("listbox"))
        await page.getByRole("option", { name: "English" }).click()

        await expect(page.locator("html")).toHaveAttribute("lang", "en")
        await expect(page.getByLabel("Handle (the part after @)")).toBeVisible()
        await expect(
            page.getByRole("button", { name: "Log in", exact: true }),
        ).toBeVisible()
        await expect(
            page.getByRole("combobox", { name: "Language" }),
        ).toHaveText("English")

        await page.reload()
        await expect(page.getByLabel("Handle (the part after @)")).toBeVisible({
            timeout: 30_000,
        })
        await expect(
            page.getByRole("combobox", { name: "Language" }),
        ).toHaveText("English")
    })
})

test.describe("Entry詳細の言語切り替え", () => {
    test("Entry詳細のプルダウンで English を選ぶと投稿日時が英語になる", async ({
        page,
    }) => {
        await page.goto("/entries/sample/", { timeout: 60_000 })
        await expect(page.locator("astro-island[ssr]")).toHaveCount(0, {
            timeout: 30_000,
        })
        const trigger = page.getByRole("combobox", { name: "表示言語" })
        await clickUntilVisible(trigger, page.getByRole("listbox"))
        await page.getByRole("option", { name: "English" }).click()

        await expect(page.getByTestId("entry-source-link")).toHaveText(
            "View original post",
        )
        await expect(page.locator("dl").getByText(/^Posted: /)).toBeVisible()
    })
})
