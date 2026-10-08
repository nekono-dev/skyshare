/**
 * 共通プルダウン（Dropdown）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - `specs/dropdown`・`specs/dropdown-search` の受け入れ条件を検証する。
 * - 表示テーマ（`/settings/`、絞り込み無し）と投稿言語（`/post/?guest`、絞り込み有り・国旗付き）
 *   を対象に、開閉・キーボード・スクロール・絞り込み・IME・配置反転を確認する。
 * - 自己ラベルは `/post/?guest` のセグメントで確認する。表示件数（PageSizeSelect）は
 *   画面から到達できないため対象外。
 */
import { expect, test, type Locator, type Page } from "@playwright/test"

/**
 * Astroアイランドはハイドレーション完了前のクリックに反応しないことがあるため、
 * 効果（`target`が現れること）が出るまでクリックをリトライする。
 */
const clickUntilOpen = async (trigger: Locator, target: Locator) => {
    await expect(async () => {
        await trigger.click()
        await expect(target).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
}

/** ハイドレーション完了前のキー入力は無視されるため、開くまでフォーカス+Enterをリトライする */
const openByKeyboard = async (page: Page, trigger: Locator) => {
    await expect(async () => {
        await trigger.focus()
        await page.keyboard.press("Enter")
        await expect(page.getByRole("listbox")).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
}

/** パネルの四隅・中央で最前面の要素がパネル自身であること（親の overflow で切れていないこと） */
const panelNotClipped = (page: Page) =>
    page.getByRole("listbox").evaluate(list => {
        const panel = list.parentElement as HTMLElement
        const r = panel.getBoundingClientRect()
        const points = [
            [r.left + 6, r.top + 6],
            [r.right - 6, r.top + 6],
            [r.left + 6, r.bottom - 6],
            [r.right - 6, r.bottom - 6],
            [r.left + r.width / 2, r.top + r.height / 2],
        ]
        return points.map(([x, y]) => {
            const el = document.elementFromPoint(x, y)
            return !!el && panel.contains(el)
        })
    })

const themeTrigger = (page: Page) =>
    page.getByRole("combobox", { name: "表示テーマ" })
const languageTrigger = (page: Page) =>
    page.getByRole("combobox", { name: "投稿言語" })

test.describe("Dropdown: 表示テーマ（絞り込み無し）", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/settings/", { timeout: 60_000 })
        await expect(themeTrigger(page)).toBeVisible({ timeout: 60_000 })
    })

    test("[dropdown/AC-1 dropdown/AC-11] 1. クリックで開き、選択すると閉じてトリガー表示が変わりフォーカスが戻る", async ({
        page,
    }) => {
        const trigger = themeTrigger(page)
        await clickUntilOpen(trigger, page.getByRole("listbox"))
        await expect(page.getByRole("option")).toHaveText([
            "システム設定に従う",
            "ライト",
            "ダーク",
        ])
        await expect(
            page.getByRole("option", { name: "システム設定に従う" }),
        ).toHaveAttribute("aria-selected", "true")

        await page.getByRole("option", { name: "ダーク" }).click()
        await expect(page.getByRole("listbox")).toHaveCount(0)
        await expect(trigger).toHaveText("ダーク")
        await expect(trigger).toBeFocused()
    })

    test("[dropdown/AC-4] 15. パネル幅はコンテンツに合わせた幅で、広すぎない", async ({
        page,
    }) => {
        await clickUntilOpen(themeTrigger(page), page.getByRole("listbox"))
        const panel = await page.getByRole("listbox").boundingBox()
        expect(panel!.width).toBeLessThan(220)
        // トリガーが画面右端に近くても、ラベルが省略表示にならない
        const truncated = await page.getByRole("option").evaluateAll(els =>
            els.some(el => {
                const body = el.firstElementChild as HTMLElement
                return body.scrollWidth > body.clientWidth
            }),
        )
        expect(truncated).toBe(false)

        // 閉じて開き直しても幅は同じ
        await page.keyboard.press("Escape")
        await themeTrigger(page).click()
        await expect(page.getByRole("listbox")).toBeVisible()
        await page.waitForTimeout(300)
        expect((await page.getByRole("listbox").boundingBox())!.width).toBe(
            panel!.width,
        )
    })

    test("[dropdown/AC-7] 21. 一覧の表示行数は最大5行（超える分はスクロール）", async ({
        page,
    }) => {
        await clickUntilOpen(themeTrigger(page), page.getByRole("listbox"))
        // 表示テーマは3件のため、全行が見えスクロールしない
        const small = await page.getByRole("listbox").evaluate(el => ({
            scrollable: el.scrollHeight > el.clientHeight,
        }))
        expect(small.scrollable).toBe(false)
    })

    test("[dropdown/AC-5] 16. 親の overflow に切られない（表示テーマ）", async ({
        page,
    }) => {
        await clickUntilOpen(themeTrigger(page), page.getByRole("listbox"))
        expect(await panelNotClipped(page)).toEqual([
            true,
            true,
            true,
            true,
            true,
        ])
    })

    test("[dropdown/AC-8] 2. キーボードで開く→移動→確定。Escは値を変えずに閉じる", async ({
        page,
    }) => {
        const trigger = themeTrigger(page)
        await openByKeyboard(page, trigger)
        await page.keyboard.press("ArrowDown")
        await page.keyboard.press("Enter")
        await expect(page.getByRole("listbox")).toHaveCount(0)
        await expect(trigger).toHaveText("ライト")
        await expect(trigger).toBeFocused()

        await page.keyboard.press("ArrowDown")
        await expect(page.getByRole("listbox")).toBeVisible()
        await page.keyboard.press("ArrowDown")
        await page.keyboard.press("Escape")
        await expect(page.getByRole("listbox")).toHaveCount(0)
        await expect(trigger).toHaveText("ライト")
        await expect(trigger).toBeFocused()
    })

    test("[dropdown/AC-2] 3. パネル外クリックで閉じ、値は変わらない", async ({
        page,
    }) => {
        const trigger = themeTrigger(page)
        await clickUntilOpen(trigger, page.getByRole("listbox"))
        await page.mouse.click(5, 5)
        await expect(page.getByRole("listbox")).toHaveCount(0)
        await expect(trigger).toHaveText("システム設定に従う")
    })

    test("[dropdown/AC-9] 14. 先頭一致のタイプアヘッドでアクティブ項目が動く", async ({
        page,
    }) => {
        const trigger = themeTrigger(page)
        await openByKeyboard(page, trigger)
        await trigger.dispatchEvent("keydown", { key: "ダ" })
        await page.keyboard.press("Enter")
        await expect(trigger).toHaveText("ダーク")
    })
})

test.describe("Dropdown: 投稿言語（検索付き・トリガーが入力欄・国旗付き）", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/post/?guest", { timeout: 60_000 })
        await expect(languageTrigger(page)).toBeVisible({ timeout: 60_000 })
    })

    /** 一覧モードで開く（1回目のクリック） */
    const openList = async (page: Page) => {
        await clickUntilOpen(languageTrigger(page), page.getByRole("listbox"))
    }
    /** 検索モードに入る（開いたまま再クリック） */
    const enterSearch = async (page: Page) => {
        await openList(page)
        await languageTrigger(page).click()
        await expect(languageTrigger(page)).toHaveAttribute("inputmode", "text")
    }

    test("[dropdown-search/AC-1 dropdown-search/AC-2] 1. 1回目は一覧モードで開く（inputmode=none・入力待ち表示）", async ({
        page,
    }) => {
        await openList(page)
        const trigger = languageTrigger(page)
        await expect(trigger).toHaveAttribute("inputmode", "none")
        // 開いている間は一覧モードでも入力待ち（placeholder）を表示する
        await expect(trigger).toHaveValue("")
        await expect(trigger).toHaveAttribute("placeholder", "入力して検索")
        const metrics = await page
            .getByRole("listbox")
            .evaluate(el => ({ scrollable: el.scrollHeight > el.clientHeight }))
        expect(metrics.scrollable).toBe(true)
        // 同時に見える行は5行まで（行の高さの約5倍以内）
        const visibleRows = await page.getByRole("listbox").evaluate(list => {
            const rect = list.getBoundingClientRect()
            return [...list.querySelectorAll('[role="option"]')].filter(el => {
                const r = el.getBoundingClientRect()
                return r.top >= rect.top - 1 && r.bottom <= rect.bottom + 1
            }).length
        })
        expect(visibleRows).toBeLessThanOrEqual(5)
        expect(visibleRows).toBeGreaterThanOrEqual(4)
        const box = await page.getByRole("listbox").boundingBox()
        const viewport = page.viewportSize()!
        expect(box!.y).toBeGreaterThanOrEqual(0)
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    })

    test("[dropdown-search/AC-3 dropdown-search/AC-4] 2. 再クリックで検索モードに入り、パネルは閉じず入力待ち表示になる", async ({
        page,
    }) => {
        await enterSearch(page)
        const trigger = languageTrigger(page)
        await expect(page.getByRole("listbox")).toBeVisible()
        await expect(trigger).toHaveValue("")
        await expect(trigger).toHaveAttribute("placeholder", "入力して検索")
        await expect(trigger).toBeFocused()
        await expect(page.getByRole("status")).toHaveText(
            "入力して検索してください",
        )
        await expect(page.getByRole("option")).toHaveCount(0)
    })

    test("[dropdown-search/AC-5 dropdown-search/AC-8 language-select/AC-1 language-select/AC-5] 3. 'ko' で絞り込み、クリックで確定するとトリガーに国旗と言語名が出る", async ({
        page,
    }) => {
        await enterSearch(page)
        const trigger = languageTrigger(page)
        await page.keyboard.type("ko")
        const options = page.getByRole("option")
        await expect(options.filter({ hasText: "한국어" })).toHaveCount(1)
        await expect(options.first()).toHaveClass(/option-active/)
        await options.filter({ hasText: "한국어" }).click()
        await expect(page.getByRole("listbox")).toHaveCount(0)
        await expect(trigger).toHaveValue("🇰🇷 한국어")
    })

    test("[dropdown-search/AC-7 dropdown-search/AC-9] 4. 該当なしはメッセージを出し、Enterでは何も確定せず、Escで直前の選択に戻る", async ({
        page,
    }) => {
        await enterSearch(page)
        const trigger = languageTrigger(page)
        await page.keyboard.type("zzzzqqq")
        await expect(page.getByText("該当する項目がありません")).toBeVisible()
        await page.keyboard.press("Enter")
        await expect(page.getByRole("listbox")).toBeVisible()
        await page.keyboard.press("Escape")
        await expect(page.getByRole("listbox")).toHaveCount(0)
        await expect(trigger).toHaveValue("🇯🇵 日本語")
    })

    test("[dropdown-search/AC-9] 5. 検索モードでパネル外クリックすると閉じ、直前の選択に戻る", async ({
        page,
    }) => {
        await enterSearch(page)
        await page.keyboard.type("ko")
        await page.mouse.click(5, 5)
        await expect(page.getByRole("listbox")).toHaveCount(0)
        await expect(languageTrigger(page)).toHaveValue("🇯🇵 日本語")
    })

    test("[dropdown-search/AC-3] 6. 一覧モードで文字キーを打つと検索モードに入り、入力として扱う", async ({
        page,
    }) => {
        await openList(page)
        await page.keyboard.press("k")
        await page.keyboard.press("o")
        const trigger = languageTrigger(page)
        await expect(trigger).toHaveValue("ko")
        await expect(page.getByRole("option", { name: /한국어/ })).toBeVisible()
        // "ko" は Kongo にも一致し、先頭（Kongo）がアクティブ
        await page.keyboard.press("Enter")
        await expect(trigger).toHaveValue("Kongo")
    })

    test("[dropdown/AC-3] 7. スクロール/リサイズでは閉じず、パネルはトリガーに付いてくる", async ({
        page,
    }) => {
        await enterSearch(page)
        const trigger = languageTrigger(page)
        await page.evaluate(() => {
            window.dispatchEvent(new Event("resize"))
            document.documentElement.dispatchEvent(new Event("scroll"))
        })
        await page.waitForTimeout(300)
        await expect(page.getByRole("listbox")).toBeVisible()
        await page.keyboard.press("Escape")
        await expect(page.getByRole("listbox")).toHaveCount(0)

        // 一覧モードでも閉じない。ページを実際にスクロールしても、トリガーとの間隔は変わらない
        await openList(page)
        await page.evaluate(() => window.scrollBy(0, 40))
        await page.waitForTimeout(300)
        await expect(page.getByRole("listbox")).toBeVisible()
        const t = (await trigger.boundingBox())!
        const p = (await page.getByRole("listbox").boundingBox())!
        const below = Math.abs(p.y - (t.y + t.height + 4))
        const above = Math.abs(t.y - (p.y + p.height + 4))
        expect(Math.min(below, above)).toBeLessThanOrEqual(6)
    })

    test("[dropdown-search/AC-10] 20. 検索モードでフォーカスだけ外れると、空なら一覧モードへ戻り、入力済みなら残る", async ({
        page,
    }) => {
        await enterSearch(page)
        const trigger = languageTrigger(page)
        // 入力済み: 入力と絞り込み結果は残る（パネルも開いたまま）
        await page.keyboard.type("ko")
        await trigger.evaluate(el => (el as HTMLInputElement).blur())
        await page.waitForTimeout(200)
        await expect(trigger).toHaveValue("ko")
        await expect(page.getByRole("option", { name: /한국어/ })).toBeVisible()
        // パネル外をタップすると閉じて入力は破棄される
        await page.mouse.click(5, 5)
        await expect(page.getByRole("listbox")).toHaveCount(0)
        await expect(trigger).toHaveValue("🇯🇵 日本語")

        // 空: 一覧モードへ戻る（パネルは開いたまま）
        await enterSearch(page)
        await trigger.evaluate(el => (el as HTMLInputElement).blur())
        await expect(trigger).toHaveAttribute("inputmode", "none")
        await expect(trigger).toHaveValue("")
        await expect(page.getByRole("option").first()).toBeVisible()
    })

    test("[dropdown/AC-5] 22. 親の overflow に切られず、パネル全体が最前面に見える", async ({
        page,
    }) => {
        await openList(page)
        const covered = await panelNotClipped(page)
        expect(covered).toEqual([true, true, true, true, true])
    })

    test("23. スクロールでトリガーが動いた後の再表示は、新しい位置で再計算される", async ({
        page,
    }) => {
        await enterSearch(page)
        const trigger = languageTrigger(page)
        await page.keyboard.type("ko")
        // ページを実際にスクロールしてトリガーの位置を動かす（スクロール中は隠れる）
        await page.evaluate(() => window.scrollBy(0, 40))
        await expect(page.getByRole("listbox")).toBeVisible({ timeout: 3_000 })
        const triggerBox = (await trigger.boundingBox())!
        const panel = (await page.getByRole("listbox").boundingBox())!
        const gapBelow = panel.y - (triggerBox.y + triggerBox.height)
        const gapAbove = triggerBox.y - (panel.y + panel.height)
        // トリガーの直下（約4px）または直上に隣接している
        expect(
            Math.min(Math.abs(gapBelow - 4), Math.abs(gapAbove - 4)),
        ).toBeLessThanOrEqual(6)
    })

    test("24. スクロールイベントなしでトリガーが動いても、パネルは追従する", async ({
        page,
    }) => {
        await enterSearch(page)
        const trigger = languageTrigger(page)
        await page.keyboard.type("ko")
        await expect(page.getByRole("listbox")).toBeVisible()
        // iOS のキーボード表示アニメーションのように、イベント無しで位置だけが動く状況を再現する
        await trigger.evaluate(el => {
            const wrapper = el.parentElement as HTMLElement
            wrapper.style.position = "relative"
            wrapper.style.top = "-30px"
        })
        await expect(async () => {
            const t = (await trigger.boundingBox())!
            const p = (await page.getByRole("listbox").boundingBox())!
            const below = Math.abs(p.y - (t.y + t.height + 4))
            const above = Math.abs(t.y - (p.y + p.height + 4))
            expect(Math.min(below, above)).toBeLessThanOrEqual(6)
        }).toPass({ timeout: 5_000 })
    })

    test("[dropdown/AC-12] 25. 可変幅のトリガーは placeholder が見切れない", async ({
        page,
    }) => {
        await openList(page)
        const trigger = languageTrigger(page)
        // 開いている間は placeholder を表示する。placeholder の文字幅が、入力欄の内側の幅に収まること
        const clipped = await trigger.evaluate(el => {
            const input = el as HTMLInputElement
            const style = getComputedStyle(input)
            const probe = document.createElement("span")
            probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font}`
            probe.textContent = input.placeholder
            document.body.appendChild(probe)
            const textWidth = probe.getBoundingClientRect().width
            probe.remove()
            const inner =
                input.clientWidth -
                parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight)
            return textWidth > inner + 0.5
        })
        expect(clipped).toBe(false)
    })

    test("21. パネル外の操作で閉じたとき、入力欄にフォーカスが残らない", async ({
        page,
    }) => {
        await openList(page)
        const trigger = languageTrigger(page)
        await expect(trigger).toBeFocused()
        await page.mouse.click(5, 5)
        await expect(page.getByRole("listbox")).toHaveCount(0)
        await expect(trigger).not.toBeFocused()
        await expect(trigger).toHaveValue("🇯🇵 日本語")
    })

    test("[dropdown/AC-7 dropdown-search/AC-11] 8. 開き直すと一覧モード・入力は空に戻り、選択中の言語が見える位置にある", async ({
        page,
    }) => {
        await enterSearch(page)
        const trigger = languageTrigger(page)
        await page.keyboard.type("zu")
        await page.keyboard.press("Enter")
        await expect(trigger).toHaveValue("🇿🇦 isiZulu")

        await trigger.click()
        await expect(trigger).toHaveAttribute("inputmode", "none")
        await expect(trigger).toHaveValue("")
        const selected = page.getByRole("option", { selected: true })
        await expect(selected).toBeInViewport()
        const listBox = await page.getByRole("listbox").boundingBox()
        const optionBox = await selected.boundingBox()
        expect(optionBox!.y).toBeGreaterThanOrEqual(listBox!.y - 1)
        expect(optionBox!.y + optionBox!.height).toBeLessThanOrEqual(
            listBox!.y + listBox!.height + 1,
        )
    })

    test("[dropdown-search/AC-12] 9. パネル幅は一覧・検索・絞り込み後で変わらず、開き直しても同じ", async ({
        page,
    }) => {
        await openList(page)
        // 開いた直後は FloatingBox の位置補正が反映される前なので、落ち着くのを待つ
        await page.waitForTimeout(300)
        const first = (await page.getByRole("listbox").boundingBox())!
        await languageTrigger(page).click()
        await page.keyboard.type("한국어")
        await expect(page.getByRole("option")).toHaveCount(1)
        const filtered = (await page.getByRole("listbox").boundingBox())!
        expect(Math.abs(filtered.width - first.width)).toBeLessThanOrEqual(1)

        await page.keyboard.press("Escape")
        await expect(page.getByRole("listbox")).toHaveCount(0)
        await languageTrigger(page).click()
        await expect(page.getByRole("listbox")).toBeVisible()
        await page.waitForTimeout(300)
        const second = (await page.getByRole("listbox").boundingBox())!
        expect(Math.abs(second.width - first.width)).toBeLessThanOrEqual(1)
    })

    test("[dropdown/AC-10] 10. IME変換中のEnterでは確定されない", async ({
        page,
    }) => {
        await enterSearch(page)
        const trigger = languageTrigger(page)
        await page.keyboard.type("ko")
        await trigger.evaluate(el => {
            el.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Enter",
                    keyCode: 229,
                    bubbles: true,
                    cancelable: true,
                }),
            )
        })
        await expect(page.getByRole("listbox")).toBeVisible()
        await expect(trigger).toHaveValue("ko")
    })

    test("[language-select/AC-4 language-select/AC-5] 11. 国旗なしの言語は入力欄に国旗が出ず、一覧ではラベルの左端が揃う", async ({
        page,
    }) => {
        await enterSearch(page)
        const trigger = languageTrigger(page)
        await page.keyboard.type("Esperanto")
        const labelLeft = (option: Locator, label: string) =>
            option.evaluate((el, text) => {
                const walker = document.createTreeWalker(
                    el,
                    NodeFilter.SHOW_TEXT,
                )
                let node: Node | null
                while ((node = walker.nextNode())) {
                    const index = node.textContent?.indexOf(text) ?? -1
                    if (index >= 0) {
                        const range = document.createRange()
                        range.setStart(node, index)
                        range.setEnd(node, index + text.length)
                        return range.getBoundingClientRect().left
                    }
                }
                return NaN
            }, label)
        const eoLeft = await labelLeft(
            page.getByRole("option", { name: /Esperanto/ }),
            "Esperanto",
        )
        await trigger.fill("English")
        const enLeft = await labelLeft(
            page.getByRole("option", { name: /English/ }),
            "English",
        )
        // 国旗なしでも国旗スロットぶんの幅が確保され、ラベルの左端が揃う
        expect(Math.abs(eoLeft - enLeft)).toBeLessThanOrEqual(1)

        await trigger.fill("Esperanto")
        await page.keyboard.press("Enter")
        await expect(trigger).toHaveValue("Esperanto")
    })

    test("[dropdown/AC-6] 12. 画面下端付近ではトリガーの上に反転し、ビューポート内に収まる", async ({
        page,
    }) => {
        const trigger = languageTrigger(page)
        // トリガー下の空きが小さくなるようビューポートを縮める。縮小でレイアウトが
        // 再配置されることがあるため、トリガー位置が安定するまで2回合わせる
        for (let i = 0; i < 2; i++) {
            const box = (await trigger.boundingBox())!
            await page.setViewportSize({
                width: 1000,
                height: Math.ceil(box.y + box.height + 60),
            })
            await page.waitForTimeout(300)
        }
        await trigger.scrollIntoViewIfNeeded()
        await clickUntilOpen(trigger, page.getByRole("listbox"))
        const triggerBox = (await trigger.boundingBox())!
        const panel = (await page.getByRole("listbox").boundingBox())!
        expect(panel.y + panel.height).toBeLessThanOrEqual(triggerBox.y + 1)
        expect(panel.y).toBeGreaterThanOrEqual(0)
    })

    test("13. 自己ラベルは「ラベルなし」も通常の選択肢として選べる", async ({
        page,
    }) => {
        const trigger = page.getByRole("combobox", { name: "コンテンツラベル" })
        await expect(trigger).toHaveText("ラベルなし")
        await clickUntilOpen(trigger, page.getByRole("listbox"))
        expect(await panelNotClipped(page)).toEqual([
            true,
            true,
            true,
            true,
            true,
        ])
        await page.getByRole("option", { name: /警告/ }).click()
        await expect(trigger).toContainText("警告")
        await trigger.click()
        await page.getByRole("option", { name: "ラベルなし" }).click()
        await expect(trigger).toHaveText("ラベルなし")
    })
})
