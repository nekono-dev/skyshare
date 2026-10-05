/**
 * 他SNSへの共有（自動ポップアップ先・投稿先選択ダイアログ・長文省略トグル）の
 * ヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - `specs/intentshare/tasks.md` Phase 4 に定めたシナリオの恒久テスト。
 * - `/post/?guest`（ログイン不要のゲスト表示）で、設定の表示条件・永続化・投稿後の
 *   自動ポップアップ／投稿先選択ダイアログを検証する。
 * - `/?guest` のタイムライン上のPostCardから、skyshare entry URL付きの共有ダイアログを検証する。
 * - 外部SNS（x.com等）への実アクセスは `context.route` で空の200応答に置き換え、開いた
 *   ポップアップのURL（intentの`text`パラメータ）のみを検証する。
 * - 長文省略の文字数計算そのものは単体テスト（`tests/util/share`）で網羅する。
 *   ゲスト表示では skyshare entry の新規作成を伴う投稿ができないため、省略の実動作
 *   （ログイン状態での長文の画像投稿→ダイアログ→X）は手動確認に委ねる。
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { weightedLength } from "../../src/util/share/truncateText"

const LABEL_POPUP = /代わりにポップアップ/
const LABEL_AUTO_POPUP_TARGET = "自動ポップアップするSNS"
const LABEL_MANUAL_ATTACH = "画像を自分で添付する（URLを発行しない）"
const LABEL_TRUNCATE = "長文を省略して共有"
const LABEL_PINNED = "投稿フォームを固定表示しない"
const DIALOG_NAME = "共有先を選択"

/** 全Astroアイランドのハイドレーション完了を待つ（完了すると`ssr`属性が外れる）。 */
const waitHydrated = async (page: Page) => {
    await page.waitForFunction(
        () => document.querySelector("astro-island[ssr]") === null,
    )
}

/** localStorage の値を読む。 */
const readStorage = (page: Page, key: string) =>
    page.evaluate((k: string) => window.localStorage.getItem(k), key)

/**
 * 投稿フォームの「詳細オプション」を、閉じていれば開く。
 * 初期状態で開くかどうかはマウント後の設定読み込みで決まるため、開閉は
 * `aria-expanded` を見て判断する（開いているものを誤って閉じない）。
 */
const openMoreOptions = async (page: Page) => {
    const trigger = page.getByRole("button", { name: "詳細オプション" })
    await expect(trigger).toBeVisible()
    await expect(async () => {
        if ((await trigger.getAttribute("aria-expanded")) !== "true") {
            await trigger.click()
        }
        await expect(trigger).toHaveAttribute("aria-expanded", "true", {
            timeout: 1_000,
        })
    }).toPass({ timeout: 10_000 })
    await expect(page.getByRole("switch", { name: LABEL_PINNED })).toBeVisible()
}

/** 初期表示前に localStorage へ値を入れる。 */
const seedStorage = async (page: Page, values: Record<string, string>) => {
    await page.addInitScript((entries: Record<string, string>) => {
        // 初回ナビゲーション時のみ投入する（リロード後は保存値を尊重する）。
        if (window.sessionStorage.getItem("__seeded") === "1") return
        window.sessionStorage.setItem("__seeded", "1")
        Object.entries(entries).forEach(([key, value]) =>
            window.localStorage.setItem(key, value),
        )
    }, values)
}

/**
 * 外部SNSへの実アクセスを空の200応答に置き換える。
 * 遮断（abort）するとポップアップのURLがエラーページ扱いになるため。
 */
const stubExternalSns = (context: BrowserContext) =>
    context.route(
        /^https:\/\/(x\.com|taittsuu\.com|mastodon\.social)\//,
        route => route.fulfill({ status: 200, body: "" }),
    )

/** ゲスト表示の投稿フォームへ本文を入力して「投稿」を押す。 */
const submitGuestPost = async (page: Page, text: string) => {
    const editor = page
        .getByTestId("thread-segment-0")
        .locator("[data-post-body-editor]")
    await editor.click()
    await page.keyboard.type(text)
    await page.getByRole("button", { name: "投稿", exact: true }).click()
    return editor
}

test.describe("intentShare", () => {
    test.beforeAll(async ({ browser }) => {
        // devサーバーの初回コンパイルを待つためのウォームアップ。
        test.setTimeout(90_000)
        const page = await browser.newPage({ ignoreHTTPSErrors: true })
        await page.goto("/post/?guest", { timeout: 60_000 })
        await expect(page.getByTestId("thread-segment-0")).toBeVisible({
            timeout: 60_000,
        })
        await page.close()
    })

    test("自動ポップアップ先のプルダウンは、ポップアップONのときだけ投稿フォームの詳細オプションの先頭に表示され、選択値が保持される", async ({
        page,
    }) => {
        await page.goto("/post/?guest")
        await waitHydrated(page)

        const popup = page.getByRole("switch", { name: LABEL_POPUP })
        const select = page.getByRole("combobox", {
            name: LABEL_AUTO_POPUP_TARGET,
        })
        await expect(popup).not.toBeChecked()
        await expect(select).toHaveCount(0)

        await popup.setChecked(true, { force: true })
        await openMoreOptions(page)
        await expect(select).toBeVisible()
        await expect(select).toContainText("X")
        // 詳細オプションの先頭に配置される（ラベルが先頭のトグルより前にある）。
        const selectBox = await select.boundingBox()
        const firstToggleBox = await page
            .getByRole("switch", { name: LABEL_TRUNCATE })
            .locator("xpath=..")
            .boundingBox()
        expect(selectBox).not.toBeNull()
        expect(firstToggleBox).not.toBeNull()
        expect(selectBox!.y).toBeLessThanOrEqual(firstToggleBox!.y)

        await select.click()
        await page.getByRole("option", { name: "投稿時に選択する" }).click()
        await expect(select).toContainText("投稿時に選択する")
        await expect
            .poll(() => readStorage(page, "autoPopupTarget"))
            .toBe("ask")

        await page.reload()
        await waitHydrated(page)
        await openMoreOptions(page)
        await expect(
            page.getByRole("combobox", { name: LABEL_AUTO_POPUP_TARGET }),
        ).toContainText("投稿時に選択する")

        await page
            .getByRole("switch", { name: LABEL_POPUP })
            .setChecked(false, { force: true })
        await expect(
            page.getByRole("combobox", { name: LABEL_AUTO_POPUP_TARGET }),
        ).toHaveCount(0)
    })

    test("自動ポップアップ先の設定値は、詳細オプションを初期状態で開く理由にならない", async ({
        page,
    }) => {
        for (const target of ["ask", "x", "taittsuu", "mastodon"]) {
            await page.addInitScript((value: string) => {
                window.localStorage.setItem(
                    "popupIntentInsteadOfWebshare",
                    "true",
                )
                window.localStorage.setItem("autoPopupTarget", value)
            }, target)
            await page.goto("/post/?guest")
            await waitHydrated(page)
            await expect(
                page.getByRole("switch", { name: LABEL_POPUP }),
            ).toBeChecked()
            await expect(
                page.getByRole("button", { name: "詳細オプション" }),
            ).toHaveAttribute("aria-expanded", "false")
        }
    })

    test("設定ページにも自動ポップアップ先のプルダウンがあり、Mastodonのインスタンス入力欄は常時表示される。旧項目は存在しない", async ({
        page,
    }) => {
        await page.goto("/settings/")
        await waitHydrated(page)

        await expect(
            page.getByRole("combobox", { name: LABEL_AUTO_POPUP_TARGET }),
        ).toHaveCount(0)
        const domain = page.locator("#setting-mastodonInstanceDomain-text")
        await expect(domain).toBeVisible()

        await page
            .getByRole("switch", { name: LABEL_POPUP })
            .setChecked(true, { force: true })
        const select = page.getByRole("combobox", {
            name: LABEL_AUTO_POPUP_TARGET,
        })
        await expect(select).toBeVisible()
        await select.click()
        await page.getByRole("option", { name: "タイッツー" }).click()
        await expect
            .poll(() => readStorage(page, "autoPopupTarget"))
            .toBe("taittsuu")

        for (const removed of [
            "自動ポップアップをOFFにする",
            "タイッツーにクロスポスト",
            "Mastodonにクロスポスト",
            "X投稿ボタンを表示",
        ]) {
            await expect(page.getByText(removed)).toHaveCount(0)
        }
    })

    test("「投稿時に選択する」で投稿すると、ポップアップは開かず投稿先選択ダイアログが開き、入力欄が空になる", async ({
        page,
    }) => {
        await seedStorage(page, {
            popupIntentInsteadOfWebshare: "true",
            autoPopupTarget: "ask",
        })
        let popupOpened = false
        page.on("popup", () => {
            popupOpened = true
        })
        await page.goto("/post/?guest")
        await waitHydrated(page)

        const editor = await submitGuestPost(page, "ダイアログのテスト投稿")

        const dialog = page.getByRole("dialog", { name: DIALOG_NAME })
        await expect(dialog).toBeVisible({ timeout: 20_000 })
        await expect(editor).not.toContainText("ダイアログのテスト投稿")
        expect(popupOpened).toBe(false)
        // フォーム内にX/タイッツー/Mastodonの手動投稿ボタンは存在しない。
        await expect(
            page.locator("form").getByRole("button", { name: "X投稿" }),
        ).toHaveCount(0)
    })

    test("「タイッツー」で投稿すると、タイッツーのintentポップアップが開き、ダイアログは開かない", async ({
        page,
        context,
    }) => {
        await stubExternalSns(context)
        await seedStorage(page, {
            popupIntentInsteadOfWebshare: "true",
            autoPopupTarget: "taittsuu",
        })
        await page.goto("/post/?guest")
        await waitHydrated(page)

        const popupPromise = page.waitForEvent("popup")
        await submitGuestPost(page, "自動ポップアップのテスト")
        const popup = await popupPromise
        const intentUrl = new URL(popup.url())
        expect(intentUrl.hostname).toBe("taittsuu.com")
        expect(intentUrl.searchParams.get("text")).toBe(
            "自動ポップアップのテスト",
        )
        await expect(
            page.getByRole("dialog", { name: DIALOG_NAME }),
        ).toHaveCount(0)
    })

    test("投稿後のダイアログは、投稿先を選んでも閉じず、続けて別の投稿先を選べ、「閉じる」・背景クリック・Escで閉じる", async ({
        page,
        context,
    }) => {
        await stubExternalSns(context)
        await seedStorage(page, {
            popupIntentInsteadOfWebshare: "true",
            autoPopupTarget: "ask",
        })
        await page.goto("/post/?guest")
        await waitHydrated(page)
        await submitGuestPost(page, "連続選択のテスト")

        const dialog = page.getByRole("dialog", { name: DIALOG_NAME })
        await expect(dialog).toBeVisible({ timeout: 20_000 })

        const xPromise = page.waitForEvent("popup")
        await dialog.getByRole("button", { name: "X に投稿" }).click()
        expect(new URL((await xPromise).url()).hostname).toBe("x.com")
        await expect(dialog).toBeVisible()

        const taittsuuPromise = page.waitForEvent("popup")
        await dialog.getByRole("button", { name: "タイッツーに投稿" }).click()
        expect(new URL((await taittsuuPromise).url()).hostname).toBe(
            "taittsuu.com",
        )
        await expect(dialog).toBeVisible()

        await dialog.getByRole("button", { name: "閉じる" }).click()
        await expect(dialog).toBeHidden()

        // Escでも閉じる。
        await submitGuestPost(page, "Escのテスト")
        await expect(dialog).toBeVisible({ timeout: 20_000 })
        await page.keyboard.press("Escape")
        await expect(dialog).toBeHidden()

        // 背景クリックでも閉じる（ダイアログの外側の画面端をクリックする）。
        await submitGuestPost(page, "背景クリックのテスト")
        await expect(dialog).toBeVisible({ timeout: 20_000 })
        await page.mouse.click(2, 2)
        await expect(dialog).toBeHidden()
    })

    test("投稿フォームを固定表示しない場合（Overlay）でも、投稿成功でOverlayが閉じた後にダイアログが残り、続けて選べる", async ({
        page,
        context,
    }) => {
        await stubExternalSns(context)
        await seedStorage(page, {
            pinnedFormDisabled: "true",
            popupIntentInsteadOfWebshare: "true",
            autoPopupTarget: "ask",
        })
        await page.goto("/?guest")
        await waitHydrated(page)

        await page.getByRole("button", { name: "新規投稿" }).first().click()
        await submitGuestPost(page, "Overlay経由のテスト")

        const dialog = page.getByRole("dialog", { name: DIALOG_NAME })
        await expect(dialog).toBeVisible({ timeout: 20_000 })
        // 投稿フォーム（Overlay）自体は閉じている。
        await expect(page.getByTestId("thread-segment-0")).toHaveCount(0)

        const xPromise = page.waitForEvent("popup")
        await dialog.getByRole("button", { name: "X に投稿" }).click()
        await xPromise
        await expect(dialog).toBeVisible()
    })

    test("タイムラインのPostCardの共有ダイアログは、投稿先を選ぶとポップアップを開いて閉じ、skyshare URL付きで上限を超えない", async ({
        page,
        context,
    }) => {
        await stubExternalSns(context)
        await seedStorage(page, { truncateIntentText: "true" })
        await page.goto("/?guest")
        await waitHydrated(page)

        const crosspost = page
            .getByRole("button", { name: "クロスポスト" })
            .first()
        await expect(crosspost).toBeVisible({ timeout: 30_000 })
        await crosspost.click()

        const dialog = page.getByRole("dialog", { name: DIALOG_NAME })
        await expect(dialog).toBeVisible()

        const popupPromise = page.waitForEvent("popup")
        await dialog.getByRole("button", { name: "X に投稿" }).click()
        const popup = await popupPromise
        const text = new URL(popup.url()).searchParams.get("text") ?? ""
        expect(text).toMatch(/https?:\/\/\S+$/)
        expect(weightedLength(text)).toBeLessThanOrEqual(280)
        await expect(dialog).toBeHidden()
    })

    test("長文省略トグルと「返信・引用オプションを保存する」は詳細オプション内に表示され、設定がリロード後も保持される", async ({
        page,
    }) => {
        await page.goto("/post/?guest")
        await waitHydrated(page)

        // 詳細オプションを開く前は、主トグル領域にこれらのトグルは無い。
        const truncate = page.getByRole("switch", { name: LABEL_TRUNCATE })
        const syncGate = page.getByRole("switch", {
            name: "返信・引用オプションを保存する",
        })
        await expect(truncate).toBeHidden()
        await openMoreOptions(page)
        await expect(truncate).toBeVisible()
        await expect(truncate).not.toBeChecked()
        await expect(syncGate).toBeVisible()

        // トグルの並び: 画像添付 → （詳細オプション内）長文省略 → 返信・引用 → 固定表示しない。
        const labels = await page
            .getByRole("switch")
            .evaluateAll(elements =>
                elements.map(
                    element =>
                        (element as HTMLInputElement).labels?.[0]
                            ?.textContent ?? "",
                ),
            )
        const indexOfLabel = (label: string) =>
            labels.findIndex(text => text.includes(label))
        expect(indexOfLabel(LABEL_MANUAL_ATTACH)).toBeGreaterThanOrEqual(0)
        expect(indexOfLabel(LABEL_TRUNCATE)).toBeGreaterThan(
            indexOfLabel(LABEL_MANUAL_ATTACH),
        )
        expect(indexOfLabel("返信・引用オプションを保存する")).toBeGreaterThan(
            indexOfLabel(LABEL_TRUNCATE),
        )
        expect(indexOfLabel(LABEL_PINNED)).toBeGreaterThan(
            indexOfLabel("返信・引用オプションを保存する"),
        )

        await truncate.setChecked(true, { force: true })
        await expect
            .poll(() => readStorage(page, "truncateIntentText"))
            .toBe("true")

        // ONの場合、リロード後は詳細オプションが初期状態で開く。
        await page.reload()
        await waitHydrated(page)
        await expect(
            page.getByRole("switch", { name: LABEL_TRUNCATE }),
        ).toBeChecked()
    })

    test("「画像を自分で添付」をONにすると省略がOFFかつ操作不能になり、OFFに戻しても復帰しない。競合する保存値は読み込み時に補正される", async ({
        page,
    }) => {
        await seedStorage(page, { truncateIntentText: "true" })
        await page.goto("/post/?guest")
        await waitHydrated(page)

        const manual = page.getByRole("switch", { name: LABEL_MANUAL_ATTACH })
        const truncate = page.getByRole("switch", { name: LABEL_TRUNCATE })
        await openMoreOptions(page)
        await expect(truncate).toBeChecked()

        await manual.setChecked(true, { force: true })
        await expect(truncate).not.toBeChecked()
        await expect(truncate).toBeDisabled()
        await expect
            .poll(() => readStorage(page, "truncateIntentText"))
            .toBe("false")

        await manual.setChecked(false, { force: true })
        await expect(truncate).toBeEnabled()
        await expect(truncate).not.toBeChecked()

        // 保存値が競合している状態（画像添付ON・省略ON）で読み込むと、省略がOFFへ補正される。
        await page.evaluate(() => {
            window.localStorage.setItem("manualImageAttach", "true")
            window.localStorage.setItem("truncateIntentText", "true")
        })
        await page.reload()
        await waitHydrated(page)
        await openMoreOptions(page)
        await expect(
            page.getByRole("switch", { name: LABEL_TRUNCATE }),
        ).not.toBeChecked()
        await expect(
            page.getByRole("switch", { name: LABEL_TRUNCATE }),
        ).toBeDisabled()
        await expect
            .poll(() => readStorage(page, "truncateIntentText"))
            .toBe("false")
    })

    for (const { title, legacy, expectedLabel, expectedValue } of [
        {
            title: "タイッツーのみON",
            legacy: {
                crosspostToTaittsuu: "true",
                showCrosspostXButton: "false",
            },
            expectedLabel: "タイッツー",
            expectedValue: "taittsuu",
        },
        {
            title: "タイッツーとX投稿ボタンがON（2つ以上）",
            legacy: {
                crosspostToTaittsuu: "true",
                showCrosspostXButton: "true",
            },
            expectedLabel: "投稿時に選択する",
            expectedValue: "ask",
        },
    ]) {
        test(`旧設定（${title}）が保存されていると、選択値が「${expectedLabel}」に引き継がれ旧キーが削除される`, async ({
            page,
        }) => {
            await seedStorage(page, {
                popupIntentInsteadOfWebshare: "true",
                noAutoPopupAfterPost: "false",
                ...legacy,
            })
            await page.goto("/post/?guest")
            await waitHydrated(page)

            await openMoreOptions(page)
            await expect(
                page.getByRole("combobox", { name: LABEL_AUTO_POPUP_TARGET }),
            ).toContainText(expectedLabel)
            await expect
                .poll(() => readStorage(page, "autoPopupTarget"))
                .toBe(expectedValue)
            for (const legacyKey of [
                "crosspostToTaittsuu",
                "crosspostToMastodon",
                "noAutoPopupAfterPost",
                "showCrosspostXButton",
            ]) {
                expect(await readStorage(page, legacyKey)).toBeNull()
            }
        })
    }

    test("旧設定が「自動ポップアップをOFFにする」のみONの場合は、既定の「X」に引き継がれる", async ({
        page,
    }) => {
        await seedStorage(page, {
            popupIntentInsteadOfWebshare: "true",
            noAutoPopupAfterPost: "true",
        })
        await page.goto("/post/?guest")
        await waitHydrated(page)

        await openMoreOptions(page)
        await expect(
            page.getByRole("combobox", { name: LABEL_AUTO_POPUP_TARGET }),
        ).toContainText("X")
        await expect.poll(() => readStorage(page, "autoPopupTarget")).toBe("x")
        expect(await readStorage(page, "noAutoPopupAfterPost")).toBeNull()
    })

    for (const [target, expected, hidden] of [
        ["x", ["/140:X", "/300:Bluesky"], ["ﾀｲｯﾂｰ"]],
        ["taittsuu", ["/140:ﾀｲｯﾂｰ", "/300:Bluesky"], [":X"]],
        ["mastodon", ["/300:Bluesky"], [":X", "ﾀｲｯﾂｰ"]],
        ["ask", ["/140:X", "/140:ﾀｲｯﾂｰ", "/300:Bluesky"], []],
    ] as const) {
        test(`文字数カウンタは自動ポップアップ先「${target}」に応じて表示が切り替わる`, async ({
            page,
        }) => {
            await seedStorage(page, {
                popupIntentInsteadOfWebshare: "true",
                autoPopupTarget: target,
            })
            await page.goto("/post/?guest")
            await waitHydrated(page)

            const form = page.getByTestId("thread-segment-0")
            for (const text of expected) {
                await expect(form.getByText(text)).toBeVisible()
            }
            for (const text of hidden) {
                await expect(form.getByText(text)).toHaveCount(0)
            }
        })
    }
})
