/**
 * 不具合の報告・新機能の提案のフォーム（FeedbackForm）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 設定のページからの導線、単独のページであること、未ログインの案内、種別の切り替え、
 *   文字数カウンタ、送信の可否、注記と送る値、送信の結果、英語の表示を検証する。
 * - セッションの取得（`/v2/bsky/session`）と受付（`/v2/feedback`）は `page.route` で差し替え、
 *   実アカウントと GitHub を使わない。
 */
import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const ACCOUNT = {
    did: "did:plc:feedbacktest",
    handle: "feedback.bsky.social",
    isActive: true,
}

/** ログイン中のアカウントを返すようにセッションの取得を差し替える */
const mockLoggedIn = async (page: Page) => {
    await page.route(/\/v2\/bsky\/session\/?$/, route =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ accounts: [ACCOUNT] }),
        }),
    )
}

/**
 * 受付の API を差し替え、送られた本文を記録する。
 *
 * Input:
 * - `statuses`: 呼び出しごとに返すステータス（足りなければ最後の値を使う）
 *
 * Output:
 * - 送られた本文の配列（呼び出しのたびに増える）
 */
const mockFeedback = async (page: Page, statuses: number[] = [200]) => {
    const bodies: Record<string, unknown>[] = []
    await page.route(/\/v2\/feedback\/?$/, route => {
        bodies.push(route.request().postDataJSON())
        const status =
            statuses[Math.min(bodies.length - 1, statuses.length - 1)]
        return route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(
                status === 200
                    ? {
                          number: 42,
                          url: "https://github.com/owner/repo/issues/42",
                      }
                    : { error: "Too Many Requests" },
            ),
        })
    })
    return bodies
}

test("[feedback-form/AC-1] 設定のページのリンクから報告のページが開き、サイドバーとフッターナビが表示されない", async ({
    page,
}) => {
    await mockLoggedIn(page)
    await page.goto("/settings/")
    await page
        .getByRole("link", { name: "不具合の報告・新機能の提案はこちら。" })
        .click()
    await expect(page).toHaveURL(/\/feedback\/$/)
    await expect(
        page.getByRole("heading", {
            name: "不具合の報告・新機能の提案",
            level: 1,
        }),
    ).toBeVisible()
    await expect(page.locator('nav[data-nav="sidebar"]')).toHaveCount(0)
    await expect(page.locator('nav[data-nav="footer"]')).toHaveCount(0)
})

test("[feedback-form/AC-2] 未ログインで開くと、フォームがなくログインのページへのリンクが表示される", async ({
    page,
}) => {
    await page.route(/\/v2\/bsky\/session\/?$/, route =>
        route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ error: "Unauthorized" }),
        }),
    )
    await page.goto("/feedback/")
    const notice = page.getByTestId("feedback-login-required")
    await expect(notice).toBeVisible()
    await expect(
        notice.getByRole("link", { name: "ログインする" }),
    ).toHaveAttribute("href", "/login/")
    await expect(page.getByTestId("feedback-form")).toHaveCount(0)
})

test("[feedback-form/AC-3][feedback-form/AC-4][feedback-form/AC-5][feedback-form/AC-6] 種別で入力欄と件名の見出しが切り替わり、各欄にカウンタが付く", async ({
    page,
}) => {
    await mockLoggedIn(page)
    await page.goto("/feedback/")
    const form = page.getByTestId("feedback-form")

    // 不具合: 件名は1行、操作した内容は複数行、再現の頻度は4択
    const title = form.getByLabel("不具合を端的に説明")
    await expect(title).toHaveJSProperty("tagName", "INPUT")
    await expect(form.getByLabel("操作した内容")).toHaveJSProperty(
        "tagName",
        "TEXTAREA",
    )
    for (const name of [
        "毎回起きる",
        "ときどき起きる",
        "起きない",
        "試していない",
    ]) {
        await expect(form.getByRole("radio", { name })).toHaveCount(1)
    }
    await expect(form.getByText("0/100:文字")).toBeVisible()
    await expect(form.getByText("0/2000:文字")).toHaveCount(1)

    // 新機能の提案に切り替える
    await form.getByText("新機能の提案", { exact: true }).click()
    await expect(form.getByLabel("新機能を端的に説明")).toBeVisible()
    await expect(form.getByLabel("操作した内容")).toHaveCount(0)
    await expect(form.getByRole("radio", { name: "毎回起きる" })).toHaveCount(0)
    await expect(form.getByLabel("どのような機能か")).toHaveJSProperty(
        "tagName",
        "TEXTAREA",
    )
    await expect(form.getByLabel("技術的な補足（任意）")).toBeVisible()
    await expect(form.getByText("0/2000:文字")).toHaveCount(2)
})

test("[feedback-form/AC-7] 件名が空なら送信できず、必須の項目を埋めると送れ、上限を超えると送れない", async ({
    page,
}) => {
    await mockLoggedIn(page)
    await page.goto("/feedback/")
    const form = page.getByTestId("feedback-form")
    const submit = form.getByRole("button", { name: "送信する" })

    await form.getByLabel("操作した内容").fill("画像を選んで送信した")
    await form.getByText("毎回起きる", { exact: true }).click()
    await expect(submit).toBeDisabled()

    await form.getByLabel("不具合を端的に説明").fill("画像が送れない")
    await expect(submit).toBeEnabled()

    await form.getByLabel("不具合を端的に説明").fill("あ".repeat(101))
    await expect(submit).toBeDisabled()
})

test("[feedback-form/AC-8] 注記にハンドルの共有と GitHub での公開が載り、送る値の一覧にハンドルが載る", async ({
    page,
}) => {
    await mockLoggedIn(page)
    await page.goto("/feedback/")
    const notice = page.getByTestId("feedback-notice")
    await expect(notice).toContainText("Bluesky のハンドル名")
    await expect(notice).toContainText("開発者に共有")
    await expect(notice).toContainText("GitHub の公開の Issue")
    const collected = page.getByTestId("feedback-collected")
    await expect(collected).toContainText(`@${ACCOUNT.handle}`)
    await expect(collected).toContainText("Chrome")
    await expect(collected).toContainText("いいえ")
})

test("[feedback-form/AC-10] 送信が成功すると Issue へのリンクが出て入力が空になり、429 では時間を置く旨が出て入力が残る", async ({
    page,
}) => {
    await mockLoggedIn(page)
    const bodies = await mockFeedback(page, [429, 200])
    await page.goto("/feedback/")
    const form = page.getByTestId("feedback-form")
    await form.getByText("新機能の提案", { exact: true }).click()
    await form.getByLabel("新機能を端的に説明").fill("下書きの並べ替え")
    await form.getByLabel("どのような機能か").fill("日付で並べ替えたい")

    await form.getByRole("button", { name: "送信する" }).click()
    await expect(form.getByRole("alert")).toHaveText(
        "続けて送信できません。1分ほど待ってから、もう一度お試しください。",
    )
    await expect(form.getByLabel("新機能を端的に説明")).toHaveValue(
        "下書きの並べ替え",
    )

    await form.getByRole("button", { name: "送信する" }).click()
    await expect(
        form.getByRole("link", { name: "作成された Issue を見る（#42）" }),
    ).toHaveAttribute("href", "https://github.com/owner/repo/issues/42")
    await expect(form.getByLabel("新機能を端的に説明")).toHaveValue("")
    await expect(form.getByLabel("どのような機能か")).toHaveValue("")

    expect(bodies).toHaveLength(2)
    expect(bodies[1]).toMatchObject({
        kind: "enhancement",
        title: "下書きの並べ替え",
        description: "日付で並べ替えたい",
        environment: { standalone: false },
    })
    expect(bodies[1]).not.toHaveProperty("technicalNotes")
    expect(bodies[1]).not.toHaveProperty("steps")
})

test.describe("英語ブラウザ", () => {
    test.use({ locale: "en-US" })

    test("[feedback-form/AC-11] 英語の表示では、ページの見出しと送信のボタンが英語になる", async ({
        page,
    }) => {
        await mockLoggedIn(page)
        await page.goto("/feedback/")
        await expect(
            page.getByRole("heading", {
                name: "Report a bug / Request a feature",
                level: 1,
            }),
        ).toBeVisible()
        await expect(
            page
                .getByTestId("feedback-form")
                .getByRole("button", { name: "Send" }),
        ).toBeVisible()
    })
})
