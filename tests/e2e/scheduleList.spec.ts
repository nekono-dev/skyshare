/**
 * 予約の一覧ページ（ScheduleList）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 予約・認証情報の API の応答を差し替え、一覧の表示順・取消の確認・失敗の理由・投稿へのリンク・
 *   認証情報の削除の可否・エラーの文言・操作要素の寸法を検証する。
 */
import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"

type Item = {
    id: string
    runAt: string
    status: "pending" | "running" | "posted" | "failed"
    postCount: number
    preview: string
    lastError: string | null
    resultUri: string | null
}

const item = (over: Partial<Item> & Pick<Item, "id" | "status">): Item => ({
    runAt: "2027-03-01T10:00:00.000Z",
    postCount: 1,
    preview: `本文-${over.id}`,
    lastError: null,
    resultUri: null,
    ...over,
})

const ITEMS: Item[] = [
    item({
        id: "a",
        status: "pending",
        runAt: "2027-03-01T10:00:00.000Z",
        postCount: 2,
    }),
    item({
        id: "b",
        status: "failed",
        runAt: "2027-03-02T10:00:00.000Z",
        lastError: "CredentialExpired",
    }),
    item({
        id: "c",
        status: "posted",
        runAt: "2027-03-03T10:00:00.000Z",
        resultUri: "at://did:plc:abc/app.bsky.feed.post/3kxyz",
    }),
]

const mockApi = async (
    page: Page,
    opts: {
        items?: Item[]
        registered?: boolean
        deleteStatus?: number
        deleteBody?: object
    } = {},
) => {
    const deletes: string[] = []
    await page.route(/\/v2\/schedules\/[^/]+\/?$/, route => {
        deletes.push(route.request().url())
        return route.fulfill({
            status: opts.deleteStatus ?? 200,
            contentType: "application/json",
            body: JSON.stringify(opts.deleteBody ?? {}),
        })
    })
    await page.route(/\/v2\/schedules\/?(\?.*)?$/, route =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ items: opts.items ?? ITEMS }),
        }),
    )
    await page.route(/\/v2\/schedules\/credential\/?$/, route =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ registered: opts.registered ?? true }),
        }),
    )
    return deletes
}

test("[schedule-form/AC-7] 予約が実行時刻の昇順で並び、各行に状態と本文の冒頭と件数が表示される", async ({
    page,
}) => {
    await mockApi(page)
    await page.goto("/schedules/")
    const rows = page.locator("li[data-status]")
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0)).toContainText("待機中")
    await expect(rows.nth(0)).toContainText("本文-a")
    await expect(rows.nth(0)).toContainText("2件の投稿")
    await expect(rows.nth(1)).toContainText("失敗")
    await expect(rows.nth(2)).toContainText("投稿済み")
})

test("[schedule-form/AC-8] 取消の確認を拒否すると予約が残り、承諾すると一覧から消える", async ({
    page,
}) => {
    const deletes = await mockApi(page)
    await page.goto("/schedules/")
    const pending = page.locator('li[data-status="pending"]')
    await pending.getByRole("button", { name: "取消" }).click()
    await page.getByRole("button", { name: "キャンセル" }).click()
    await expect(pending).toHaveCount(1)
    expect(deletes).toEqual([])

    await pending.getByRole("button", { name: "取消" }).click()
    await page.getByRole("button", { name: "取り消す" }).click()
    await expect(pending).toHaveCount(0)
    expect(deletes).toHaveLength(1)
    expect(deletes[0]).toMatch(/\/v2\/schedules\/a\/?$/)
})

test("[schedule-form/AC-9] 失敗の予約に理由の文言が、投稿済みの予約に投稿へのリンクが表示される", async ({
    page,
}) => {
    await mockApi(page)
    await page.goto("/schedules/")
    await expect(page.locator('li[data-status="failed"]')).toContainText(
        "有効期限が切れていました",
    )
    const link = page
        .locator('li[data-status="posted"]')
        .getByRole("link", { name: "投稿を見る" })
    await expect(link).toHaveAttribute(
        "href",
        "https://bsky.app/profile/did:plc:abc/post/3kxyz",
    )
})

test("[schedule-form/AC-10] 認証情報の登録状態が表示され、待機中の予約があると削除が無効になる", async ({
    page,
}) => {
    await mockApi(page)
    await page.goto("/schedules/")
    await expect(page.getByText("予約用の認証: 登録済み")).toBeVisible()
    await expect(
        page.getByRole("button", { name: "認証情報を削除" }),
    ).toBeDisabled()
    await expect(
        page.getByText("待機中または実行中の予約があるため、削除できません。"),
    ).toBeVisible()
})

test("[schedule-form/AC-10] 待機中の予約がなければ認証情報を削除できる", async ({
    page,
}) => {
    await mockApi(page, { items: [ITEMS[2]!] })
    await page.goto("/schedules/")
    await expect(
        page.getByRole("button", { name: "認証情報を削除" }),
    ).toBeEnabled()
})

test("[schedule-form/AC-11] 409 のエラーが日本語の文言で表示される", async ({
    page,
}) => {
    await mockApi(page, {
        deleteStatus: 409,
        deleteBody: { error: "ScheduleRunning" },
    })
    await page.goto("/schedules/")
    await page
        .locator('li[data-status="posted"]')
        .getByRole("button", { name: "履歴を削除" })
        .click()
    await expect(
        page
            .getByRole("alert")
            .filter({ hasText: "実行中のため操作できません。" }),
    ).toBeVisible()
})

test.describe("英語の表示", () => {
    test.use({ locale: "en-US" })
    test("[schedule-form/AC-11] 409 のエラーが英語の文言で表示される", async ({
        page,
    }) => {
        await mockApi(page, {
            deleteStatus: 409,
            deleteBody: { error: "ScheduleRunning" },
        })
        await page.goto("/schedules/")
        await page
            .locator('li[data-status="posted"]')
            .getByRole("button", { name: "Delete history" })
            .click()
        await expect(
            page.getByText("It is running and cannot be changed."),
        ).toBeVisible()
    })
})

test.describe("スマホ幅", () => {
    test.use({ viewport: { width: 390, height: 844 } })
    test("[schedule-form/AC-12] 予約に関わるボタンの寸法が縦横とも44ピクセル以上", async ({
        page,
    }) => {
        await mockApi(page)
        await page.goto("/schedules/")
        await expect(page.locator("li[data-status]")).toHaveCount(3)
        const buttons = page.locator(
            "li[data-status] button:visible, li[data-status] a:visible, [data-testid=none]",
        )
        const count = await buttons.count()
        expect(count).toBeGreaterThan(2)
        for (let i = 0; i < count; i++) {
            const box = await buttons.nth(i).boundingBox()
            expect(box!.height, `button ${i} height`).toBeGreaterThanOrEqual(44)
            expect(box!.width, `button ${i} width`).toBeGreaterThanOrEqual(44)
        }
    })
})
