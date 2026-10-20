/**
 * 予約ダイアログ（ScheduleDialog・CredentialForm）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 投稿フォーム（/post/）から予約ダイアログを開き、日時の既定値・範囲外の無効化・
 *   認証情報の登録の導線・予約の送信・二重送信の防止・成功後の案内と入力の初期化を検証する。
 * - セッション・予約・認証情報の API の応答を差し替える（実アカウントは不要）。
 */
import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"

const LIMITS = {
    minLeadSeconds: 300,
    maxLeadSeconds: 30 * 86400,
    maxPending: 20,
    maxImageBytes: 10_000_000,
    maxPosts: 100,
}

type Calls = {
    schedules: { body: string | null; headers: Record<string, string> }[]
    credentials: unknown[]
}

const mockApi = async (
    page: Page,
    opts: {
        registered?: boolean
        scheduleStatus?: number
        scheduleBody?: object
        delayMs?: number
    } = {},
): Promise<Calls> => {
    const calls: Calls = { schedules: [], credentials: [] }
    let registered = opts.registered ?? true
    await page.route(/\/v2\/bsky\/session\/?$/, route =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                accounts: [
                    {
                        did: "did:plc:me",
                        handle: "me.bsky.social",
                        displayName: "Me",
                        isActive: true,
                    },
                ],
            }),
        }),
    )
    await page.route(/\/v2\/schedules\/?(\?.*)?$/, async route => {
        const request = route.request()
        if (request.method() === "POST") {
            calls.schedules.push({
                body: request.postData(),
                headers: request.headers(),
            })
            if (opts.delayMs)
                await new Promise(r => setTimeout(r, opts.delayMs))
            return route.fulfill({
                status: opts.scheduleStatus ?? 200,
                contentType: "application/json",
                body: JSON.stringify(
                    opts.scheduleBody ?? {
                        id: "sched-1",
                        runAt: "2027-03-01T10:00:00.000Z",
                    },
                ),
            })
        }
        return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ items: [] }),
        })
    })
    await page.route(/\/v2\/schedules\/limits\/?$/, route =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(LIMITS),
        }),
    )
    await page.route(/\/v2\/schedules\/credential\/?$/, route => {
        const request = route.request()
        if (request.method() === "PUT") {
            calls.credentials.push(request.postDataJSON())
            registered = true
            return route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ registered: true }),
            })
        }
        return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ registered }),
        })
    })
    return calls
}

const typeBody = async (page: Page, text: string) => {
    const editor = page.locator("[data-post-body-editor]").first()
    await expect(editor).toBeVisible({ timeout: 60_000 })
    await expect(async () => {
        await editor.click()
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await editor.pressSequentially(text)
        await expect(editor).toContainText(text, { timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    return editor
}

const openDialog = async (page: Page) => {
    await typeBody(page, "予約する本文")
    const open = page.getByRole("button", { name: "予約", exact: true })
    const dialog = page.getByRole("dialog", { name: "投稿を予約" })
    await expect(async () => {
        await open.click()
        await expect(dialog).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    return dialog
}

const localValue = (offsetMs: number) => {
    const d = new Date(Date.now() + offsetMs)
    const p = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

test("[schedule-form/AC-1] 予約を選ぶと日時の入力が現れ、既定値が現在から1時間後になる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockApi(page)
    await page.goto("/post/")
    const dialog = await openDialog(page)
    const input = dialog.getByLabel("投稿する日時")
    await expect(input).toBeVisible()
    const value = await input.inputValue()
    const diff = new Date(value).getTime() - Date.now()
    expect(diff).toBeGreaterThan(55 * 60 * 1000)
    expect(diff).toBeLessThan(61 * 60 * 1000)
})

test("[schedule-form/AC-3] 範囲外の日時では送信できず理由が表示され、範囲内では送信できる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockApi(page)
    await page.goto("/post/")
    const dialog = await openDialog(page)
    const input = dialog.getByLabel("投稿する日時")
    const submit = dialog.getByRole("button", { name: "予約する" })

    await input.fill(localValue(4 * 60 * 1000))
    await expect(submit).toBeDisabled()
    await expect(dialog.getByRole("alert")).toContainText("5分後以降")

    await input.fill(localValue(31 * 86400 * 1000))
    await expect(submit).toBeDisabled()
    await expect(dialog.getByRole("alert")).toContainText("30日後まで")

    await input.fill(localValue(10 * 60 * 1000))
    await expect(submit).toBeEnabled()
    await input.fill(localValue(30 * 86400 * 1000 - 60 * 1000))
    await expect(submit).toBeEnabled()
})

test("[schedule-form/AC-2 schedule-form/AC-6] 予約を送信すると、タイムゾーンつきの日時で作成され、案内が表示されて本文が空になる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockApi(page)
    await page.goto("/post/")
    const dialog = await openDialog(page)
    await dialog.getByRole("button", { name: "予約する" }).click()
    await expect(dialog.getByText("予約しました。")).toBeVisible()
    await expect(
        dialog.getByRole("link", { name: "予約一覧を見る" }),
    ).toHaveAttribute("href", "/schedules/")
    expect(calls.schedules).toHaveLength(1)
    expect(calls.schedules[0]!.body).toMatch(
        /name="runAt"\r\n\r\n\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}\r\n/,
    )
    await dialog.getByRole("button", { name: "閉じる" }).click()
    await expect(
        page.locator("[data-post-body-editor]").first(),
    ).not.toContainText("予約する本文")
})

test("[schedule-form/AC-4 schedule-form/AC-5 schedule-form/AC-14] 認証情報が未登録だと登録が先に現れ、注意と案内が表示され、登録に成功すると予約が送信される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockApi(page, { registered: false })
    await page.goto("/post/")
    const dialog = await openDialog(page)
    await dialog.getByRole("button", { name: "予約する" }).click()

    await expect(
        dialog.getByText("メインのパスワードは入力しないでください"),
    ).toBeVisible()
    await expect(
        dialog.getByText("アプリパスワードは、Blueskyの"),
    ).toBeVisible()
    // 可視のユーザー名欄と、現在のパスワードとして扱う欄が、同じフォームにある
    const form = dialog.locator("form")
    const username = form.locator('input[autocomplete="username"]')
    const password = form.locator('input[autocomplete="current-password"]')
    await expect(username).toBeVisible()
    await expect(username).toHaveValue("me.bsky.social")
    await expect(password).toBeVisible()
    await expect(form.locator('input[type="text"]')).toHaveCount(1)
    expect(calls.schedules).toHaveLength(0)

    await password.fill("abcd-efgh-ijkl-mnop")
    await dialog.getByRole("button", { name: "登録して予約する" }).click()
    await expect(dialog.getByText("予約しました。")).toBeVisible()
    expect(calls.credentials).toEqual([{ password: "abcd-efgh-ijkl-mnop" }])
    expect(calls.schedules).toHaveLength(1)
})

test("[schedule-form/AC-11] 予約の作成が409を返すと、日本語の文言でエラーが表示され、入力は保たれる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockApi(page, {
        scheduleStatus: 429,
        scheduleBody: { error: "Too Many Requests" },
    })
    await page.goto("/post/")
    const dialog = await openDialog(page)
    await dialog.getByRole("button", { name: "予約する" }).click()
    await expect(
        dialog.getByText("予約の件数が上限に達しています"),
    ).toBeVisible()
    await expect(dialog.getByLabel("投稿する日時")).toBeVisible()
})

test("[schedule-form/AC-15] 送信中に確定操作を2回行っても、予約の作成の呼び出しは1回だけ", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockApi(page, { delayMs: 800 })
    await page.goto("/post/")
    const dialog = await openDialog(page)
    const submit = dialog.getByRole("button", { name: "予約する" })
    await submit.dblclick()
    await expect(dialog.getByText("予約しました。")).toBeVisible()
    expect(calls.schedules).toHaveLength(1)
})
