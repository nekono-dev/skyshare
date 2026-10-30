/**
 * 選択式質問部品(ChoiceQuestion)の確認用画面のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - `docs/features/choice-question` の受け入れ条件を、確認用画面 `/samples/choice-question/`
 *   (単一・複数・上限つき・操作できない状態の 4 例)の操作後の表示で検証する。
 * - 各例の下に出る選択状態の一覧(`data-testid="selected-<例>"`)を、操作後の結果として確認する。
 * - ログインに依存しない静的な画面を対象にする。
 * - ハイドレーション前の操作は無視されるため、効果が出るまで操作をリトライする(dropdown.spec.ts と同じ流儀)。
 */
import { expect, test } from "./fixtures"
import { type Locator, type Page } from "@playwright/test"

const URL = "/samples/choice-question/"

/** 4 例の質問文(グループ名) */
const LEGEND = {
    single: "単一選択: 好きな果物は",
    multiple: "複数選択: 好きな果物は(いくつでも)",
    limited: "上限つきの複数選択: 好きな果物は(最大 2 件)",
    disabled: "操作できない状態: 好きな果物は",
} as const

type Example = keyof typeof LEGEND

/** 質問文でグループを取得する */
const group = (page: Page, example: Example) =>
    page.getByRole("group", { name: LEGEND[example] })

/** 選択状態の一覧の表示 */
const selected = (page: Page, example: Example) =>
    page.getByTestId(`selected-${example}`)

/** 選択肢のカード(label)。表示文の一部で特定する */
const card = (page: Page, example: Example, text: string) =>
    group(page, example).locator("label", { hasText: text })

/**
 * 効果(`target` の表示が `expected` になること)が出るまで操作をリトライする。
 * ハイドレーション完了前のクリックは無視されるため。
 */
const actUntil = async (
    act: () => Promise<void>,
    target: Locator,
    expected: string,
) => {
    await expect(async () => {
        await act()
        await expect(target).toHaveText(expected, { timeout: 1_000 })
    }).toPass({ timeout: 15_000 })
}

test.beforeEach(async ({ page }) => {
    await page.goto(URL, { timeout: 60_000 })
    await expect(group(page, "single")).toBeVisible({ timeout: 60_000 })
})

test.describe("ChoiceQuestion: 確認用画面", () => {
    test("[choice-question/2.4,2.1 choice-question/2.2,2.3,2.5] 単一選択は 1 つだけ選べ、別の選択肢で入れ替わり、選択中の再選択では変わらない", async ({
        page,
    }) => {
        const out = selected(page, "single")
        await expect(out).toHaveText("")
        await expect(group(page, "single").getByRole("radio")).toHaveCount(4)

        await actUntil(() => card(page, "single", "りんご").click(), out, "a")
        await expect(
            group(page, "single").getByRole("radio", { name: "りんご" }),
        ).toBeChecked()

        // 入れ替え: 直前の選択は外れる
        await card(page, "single", "ぶどう").click()
        await expect(out).toHaveText("c")
        await expect(
            group(page, "single").getByRole("radio", { checked: true }),
        ).toHaveCount(1)
        await expect(
            group(page, "single").getByRole("radio", { name: "りんご" }),
        ).not.toBeChecked()

        // 選択中の再選択では変わらない
        await card(page, "single", "ぶどう").click()
        await expect(out).toHaveText("c")
    })

    test("[choice-question/3.1,3.2,3.3,3.4 choice-question/3.5] 複数選択は独立に切り替わり、一覧は選んだ順でなく選択肢の並び順になる", async ({
        page,
    }) => {
        const out = selected(page, "multiple")
        await expect(out).toHaveText("")

        await actUntil(() => card(page, "multiple", "ぶどう").click(), out, "c")
        // 後から選んだ a が、並び順で先頭に来る
        await card(page, "multiple", "りんご").click()
        await expect(out).toHaveText("a,c")
        await card(page, "multiple", "みかん").click()
        await expect(out).toHaveText("a,b,c")

        // 外すと、その識別子だけが除かれる
        await card(page, "multiple", "ぶどう").click()
        await expect(out).toHaveText("a,b")
        const boxes = group(page, "multiple").getByRole("checkbox")
        await expect(boxes.nth(0)).toBeChecked()
        await expect(boxes.nth(1)).toBeChecked()
        await expect(boxes.nth(2)).not.toBeChecked()
        await expect(boxes.nth(3)).not.toBeChecked()

        // 他の例には干渉しない
        await expect(selected(page, "single")).toHaveText("")
        await expect(selected(page, "limited")).toHaveText("")
    })

    test("[choice-question/4.1,4.2,4.3] 上限に達すると未選択が選べなくなり、選択中は外せ、外すと復帰する", async ({
        page,
    }) => {
        const out = selected(page, "limited")
        const boxes = group(page, "limited").getByRole("checkbox")

        await actUntil(() => card(page, "limited", "りんご").click(), out, "a")
        await expect(boxes.nth(2)).toBeEnabled()
        await card(page, "limited", "みかん").click()
        await expect(out).toHaveText("a,b")

        // 上限到達: 未選択は無効、選択中は有効のまま
        await expect(boxes.nth(2)).toBeDisabled()
        await expect(boxes.nth(3)).toBeDisabled()
        await expect(boxes.nth(0)).toBeEnabled()
        await expect(boxes.nth(1)).toBeEnabled()
        // 見た目でも区別できる(無効のカードは薄く表示される)
        const opacityOf = (label: Locator) =>
            label.evaluate(el => Number(getComputedStyle(el).opacity))
        expect(await opacityOf(card(page, "limited", "ぶどう"))).toBeLessThan(
            await opacityOf(card(page, "limited", "りんご")),
        )

        // 無効の選択肢を押しても変わらない
        await card(page, "limited", "ぶどう").click({ force: true })
        await expect(out).toHaveText("a,b")

        // 選択中を外すと、未選択が選べる状態に戻る
        await card(page, "limited", "りんご").click()
        await expect(out).toHaveText("b")
        await expect(boxes.nth(2)).toBeEnabled()
        await expect(boxes.nth(3)).toBeEnabled()
        await card(page, "limited", "ぶどう").click()
        await expect(out).toHaveText("b,c")
    })

    test("[choice-question/5.1,5.2,5.3] 操作できない状態は選択状態を表示し続け、操作しても値が変わらない", async ({
        page,
    }) => {
        const out = selected(page, "disabled")
        const boxes = group(page, "disabled").getByRole("checkbox")
        await expect(out).toHaveText("b,c")
        for (let i = 0; i < 4; i++) {
            await expect(boxes.nth(i)).toBeDisabled()
        }
        await expect(boxes.nth(1)).toBeChecked()
        await expect(boxes.nth(2)).toBeChecked()
        await expect(boxes.nth(0)).not.toBeChecked()

        // 選択中・未選択のどちらを押しても変わらない
        await card(page, "disabled", "りんご").click({ force: true })
        await card(page, "disabled", "みかん").click({ force: true })
        await expect(out).toHaveText("b,c")
        await expect(boxes.nth(0)).not.toBeChecked()
        await expect(boxes.nth(1)).toBeChecked()
    })

    test("[choice-question/7.1,7.2 choice-question/7.5] 質問文でグループを取得でき、選択肢の状態が支援技術に伝わり、質問ごとに干渉しない", async ({
        page,
    }) => {
        for (const example of Object.keys(LEGEND) as Example[]) {
            await expect(group(page, example)).toBeVisible()
        }
        // 単一は radio、複数は checkbox として、選択肢が質問ごとに 4 件ある
        await expect(group(page, "single").getByRole("radio")).toHaveCount(4)
        await expect(group(page, "multiple").getByRole("checkbox")).toHaveCount(
            4,
        )
        // 操作できない状態は disabled として伝わる
        await expect(
            group(page, "disabled").getByRole("checkbox", { name: "りんご" }),
        ).toBeDisabled()

        // 同じ表示文の選択肢が複数の質問にあっても、選択は干渉しない
        await actUntil(
            () => card(page, "multiple", "りんご").click(),
            selected(page, "multiple"),
            "a",
        )
        await expect(selected(page, "limited")).toHaveText("")
        await expect(selected(page, "single")).toHaveText("")
        await expect(
            group(page, "limited").getByRole("checkbox", { name: "りんご" }),
        ).not.toBeChecked()
    })

    test("[choice-question/7.3,7.4 choice-question/2.2] 単一選択は矢印キーで選択が移り、フォーカスの位置が見える", async ({
        page,
    }) => {
        const out = selected(page, "single")
        const radios = group(page, "single").getByRole("radio")

        // 最初の選択肢にフォーカスして矢印キーで下へ(ハイドレーション前は無視されるためリトライ)
        await actUntil(
            async () => {
                await radios.first().focus()
                await page.keyboard.press("ArrowDown")
            },
            out,
            "b",
        )
        await expect(radios.nth(1)).toBeChecked()
        await expect(radios.nth(1)).toBeFocused()

        await page.keyboard.press("ArrowDown")
        await expect(out).toHaveText("c")
        await page.keyboard.press("ArrowUp")
        await expect(out).toHaveText("b")

        // フォーカスの位置が見える(丸印にフォーカスリングが出る)
        const ring = await radios.nth(1).evaluate(input => {
            const dot = input.nextElementSibling as HTMLElement
            const style = getComputedStyle(dot)
            return {
                style: style.outlineStyle,
                width: parseFloat(style.outlineWidth),
            }
        })
        expect(ring.style).not.toBe("none")
        expect(ring.width).toBeGreaterThan(0)
    })

    test("[choice-question/7.3,7.4 choice-question/3.2,3.3,4.1] 複数選択はスペースで切り替わり、フォーカスの位置が見える", async ({
        page,
    }) => {
        const out = selected(page, "multiple")
        const boxes = group(page, "multiple").getByRole("checkbox")

        await actUntil(
            async () => {
                await boxes.first().focus()
                await page.keyboard.press("Space")
            },
            out,
            "a",
        )
        // Tab で次の選択肢へ移動してスペースで選ぶ(並び順の一覧になる)
        await page.keyboard.press("Tab")
        await expect(boxes.nth(1)).toBeFocused()
        await page.keyboard.press("Space")
        await expect(out).toHaveText("a,b")
        // もう一度スペースで外れる
        await page.keyboard.press("Space")
        await expect(out).toHaveText("a")

        // フォーカスの位置が見える(四角の枠にフォーカスリングが出る)
        const ring = await boxes.nth(1).evaluate(input => {
            const box = input.nextElementSibling as HTMLElement
            const style = getComputedStyle(box)
            return {
                style: style.outlineStyle,
                width: parseFloat(style.outlineWidth),
            }
        })
        expect(ring.style).not.toBe("none")
        expect(ring.width).toBeGreaterThan(0)

        // 上限つきの例でも、キーボードで同じ変化が起き、上限で無効になる
        const limited = group(page, "limited").getByRole("checkbox")
        await limited.nth(0).focus()
        await page.keyboard.press("Space")
        await page.keyboard.press("Tab")
        await page.keyboard.press("Space")
        await expect(selected(page, "limited")).toHaveText("a,b")
        await expect(limited.nth(2)).toBeDisabled()
    })

    test("[choice-question/1.4] 幅の狭い画面で長い表示文が折り返され、横にあふれない", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 800 })
        await page.goto(URL, { timeout: 60_000 })
        await expect(group(page, "single")).toBeVisible({ timeout: 60_000 })

        const longCard = card(page, "single", "とても長い表示文")
        await expect(longCard).toBeVisible()
        // 全文が表示され、複数行に折り返している
        await expect(longCard).toContainText("あふれないことを確認します。")
        const lineHeight = await longCard.evaluate(el => {
            const text = el.lastElementChild as HTMLElement
            return {
                height: text.getBoundingClientRect().height,
                line: parseFloat(getComputedStyle(text).lineHeight) || 0,
            }
        })
        expect(lineHeight.height).toBeGreaterThan(lineHeight.line * 1.5)

        // ページ全体に横スクロールが出ず、カードが画面の幅を超えない
        const overflow = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
        }))
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)
        const box = await longCard.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x + box!.width).toBeLessThanOrEqual(375)
        // 質問のまとまり自体も同様
        const fieldset = await group(page, "single").boundingBox()
        expect(fieldset!.x + fieldset!.width).toBeLessThanOrEqual(375)
    })
})

/** `rgb(...)` / `rgba(...)` / `color(srgb ...)` の文字列を [r,g,b,a](0-255, a は 0-1)にする */
const parseColor = (value: string): [number, number, number, number] => {
    const nums = (value.match(/-?[\d.]+/g) ?? []).map(value => Number(value))
    if (value.startsWith("color(")) {
        return [nums[0] * 255, nums[1] * 255, nums[2] * 255, nums[3] ?? 1]
    }
    return [nums[0], nums[1], nums[2], nums[3] ?? 1]
}

/** WCAG の相対輝度から求めたコントラスト比 */
const contrast = (
    a: [number, number, number, number],
    b: [number, number, number, number],
) => {
    const lum = ([r, g, bl]: number[]) => {
        const f = (c: number) => {
            const s = c / 255
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl)
    }
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
}

test.describe("ChoiceQuestion: ダークテーマ", () => {
    test("[choice-question/8.2] ダークテーマで質問文と選択肢の文字が背景に対して読める", async ({
        page,
    }) => {
        // 設定の「システム設定に従う」でダークを選ぶ(OS 設定のダーク)
        await page.emulateMedia({ colorScheme: "dark" })
        await page.goto(URL, { timeout: 60_000 })
        await expect(group(page, "single")).toBeVisible({ timeout: 60_000 })
        // 選択中のカードと未選択のカードの両方を検査する
        await actUntil(
            () => card(page, "single", "りんご").click(),
            selected(page, "single"),
            "a",
        )

        // 画面の背景色(不透明になるまで祖先をたどる)
        const targets = [
            group(page, "single").locator("legend"),
            card(page, "single", "りんご"), // 選択中
            card(page, "single", "みかん"), // 未選択
            group(page, "disabled").locator("label").first(), // 無効(薄い表示)
        ]
        for (const target of targets) {
            const sample = await target.evaluate(el => {
                // 文字色は文字を持つ要素(legend 自身、またはカード内の表示文)から取る
                const textEl =
                    el.tagName === "LEGEND"
                        ? el
                        : ((el.lastElementChild as HTMLElement) ?? el)
                let opacity = 1
                for (let e: Element | null = el; e; e = e.parentElement) {
                    opacity *= Number(getComputedStyle(e).opacity)
                }
                let bg = "rgba(0, 0, 0, 0)"
                for (let e: Element | null = el; e; e = e.parentElement) {
                    const c = getComputedStyle(e).backgroundColor
                    if (!/rgba\(.*,\s*0\)$/.test(c) && c !== "transparent") {
                        bg = c
                        break
                    }
                }
                return {
                    color: getComputedStyle(textEl).color,
                    bg,
                    opacity,
                }
            })
            const fg = parseColor(sample.color)
            const bg = parseColor(sample.bg)
            // 不透明度が掛かる場合は、背景との合成後の色で比べる
            const mixed = fg.map((c, i) =>
                i < 3 ? c * sample.opacity + bg[i] * (1 - sample.opacity) : 1,
            ) as [number, number, number, number]
            // 文字が背景と区別できる最低限(無効の薄い表示は 3:1、通常は 4.5:1)
            const min = sample.opacity < 1 ? 3 : 4.5
            expect(
                contrast(mixed, bg),
                `${sample.color} on ${sample.bg} (opacity ${sample.opacity})`,
            ).toBeGreaterThanOrEqual(min)
        }

        // ダークの配色になっていること(背景が暗い)
        const pageBg = parseColor(
            await page.evaluate(
                () => getComputedStyle(document.body).backgroundColor,
            ),
        )
        expect(pageBg[0] + pageBg[1] + pageBg[2]).toBeLessThan(255 * 1.5)
    })
})
