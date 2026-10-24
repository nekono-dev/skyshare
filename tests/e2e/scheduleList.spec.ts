/**
 * 下書き・予約の画面の予約のタブ（ScheduleList）と、予約の編集のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 予約の API を差し替え、予約のタブの並び・失敗の理由・失敗の予約の書き戻し・履歴の削除・
 *   予約投稿が無効のときの設定への案内・
 *   予約の書き戻し（画像を含む）・置き換え・編集中のキャンセルの3択・日時の解除による取消・
 *   狭い画面の寸法を検証する。
 */
import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"
import { mockScheduleApi, type ScheduleItem } from "./scheduleMocks"

const item = (
    over: Partial<ScheduleItem> & Pick<ScheduleItem, "id" | "status">,
): ScheduleItem => ({
    runAt: "2027-03-01T10:00:00.000Z",
    postCount: 1,
    preview: `本文-${over.id}`,
    lastError: null,
    ...over,
})

/** 実行日時（明日の同時刻。範囲の判定に通る値） */
const tomorrow = () => new Date(Date.now() + 86400_000).toISOString()

const ITEMS: ScheduleItem[] = [
    item({
        id: "a",
        status: "pending",
        postCount: 2,
        runAt: "2027-03-01T10:00:00.000Z",
    }),
    item({
        id: "b",
        status: "failed",
        runAt: "2027-03-02T10:00:00.000Z",
        lastError: "CredentialExpired",
    }),
]

/** 代替テキストつきの画像2枚を持つ待機中の予約の内容 */
const detailWithImage = (id: string) => ({
    id,
    runAt: tomorrow(),
    posts: [
        {
            text: "書き戻す本文",
            langs: ["ja"],
            images: [0, 1],
            imagesMeta: [
                { width: 1, height: 1, alt: "代替の文" },
                { width: 1, height: 1, alt: "二枚目" },
            ],
        },
    ],
    createEntry: true,
    visual: 2,
})

const openSchedulesTab = async (page: Page) => {
    const open = page.getByRole("button", { name: "下書き・予約", exact: true })
    await expect(open).toBeEnabled({ timeout: 60_000 })
    await expect(async () => {
        await open.click()
        await expect(page.getByRole("tab", { name: "予約" })).toBeVisible({
            timeout: 2_000,
        })
    }).toPass({ timeout: 20_000 })
    await page.getByRole("tab", { name: "予約" }).click()
    const list = page.getByTestId("schedule-list")
    await expect(list).toBeVisible()
    return list
}

/** 予約のタブから待機中の予約を選び、フォームへ書き戻す */
const editSchedule = async (page: Page, preview: string) => {
    const list = await openSchedulesTab(page)
    await list.getByRole("button", { name: new RegExp(preview) }).click()
    await expect(
        page.getByText("予約をフォームに読み込みました。"),
    ).toBeVisible()
}

const editor = (page: Page) => page.locator("[data-post-body-editor]").first()
const submitButton = (page: Page) => page.getByTestId("composer-submit")

test("[schedule-form/AC-12 schedule-form/AC-13] 待機中と履歴が実行時刻の順に並び、失敗の理由が出て、履歴を削除できる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, { items: [...ITEMS] })
    await page.goto("/post/")
    const list = await openSchedulesTab(page)

    const rows = list.locator("[data-status]")
    await expect(rows).toHaveCount(2)
    // 予約投稿が有効なときは、設定への案内を出さない
    await expect(list.getByTestId("schedule-list-disabled")).toHaveCount(0)
    await expect(rows.nth(0)).toHaveAttribute("data-status", "pending")
    await expect(rows.nth(0)).toContainText("待機中")
    await expect(rows.nth(0)).toContainText("本文-a")
    await expect(rows.nth(0)).toContainText("2件の投稿")
    await expect(rows.nth(1)).toHaveAttribute("data-status", "failed")

    await expect(
        rows
            .nth(1)
            .getByText("Bluesky での予約投稿の許可が無効になっていました"),
    ).toBeVisible()
    // 成功した予約は履歴に残らないため、投稿へのリンクは出ない
    await expect(list.getByRole("link", { name: "投稿を見る" })).toHaveCount(0)

    await rows.nth(1).getByRole("button", { name: "履歴を削除" }).click()
    await page
        .getByRole("dialog", { name: "履歴の削除" })
        .getByRole("button", { name: "削除する" })
        .click()
    await expect(list.locator('[data-status="failed"]')).toHaveCount(0)
    expect(calls.deletes).toEqual(["b"])
})

test("[schedule-form/AC-14 image-picker/AC-8] 画像つきの待機中の予約を選ぶと、本文と画像と実行日時が戻り、ボタンが予約になる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page, {
        items: [item({ id: "s1", status: "pending", preview: "書き戻す本文" })],
        details: { s1: detailWithImage("s1") },
    })
    await page.goto("/post/")
    await editSchedule(page, "書き戻す本文")
    await expect(editor(page)).toContainText("書き戻す本文")
    await expect(submitButton(page)).toHaveText("予約")
    await expect(page.getByTestId("schedule-run-at-label")).toContainText(
        "に予約",
    )
    // 画像のプレビューが表示され、代替テキストが入力済みで、取り外せる
    const segment = page.getByTestId("thread-segment-0")
    const thumbs = segment.locator("img[src^='blob:']")
    await expect(thumbs.first()).toBeVisible()
    await segment
        .getByRole("button", { name: "画像1のaltテキストを編集" })
        .click()
    const altDialog = page.getByRole("dialog", {
        name: "画像のaltテキスト編集",
    })
    await expect(altDialog.locator("textarea, input").first()).toHaveValue(
        "代替の文",
    )
    await page.keyboard.press("Escape")
    await expect(altDialog).toBeHidden()
    await expect(
        segment.getByRole("button", { name: "画像2のaltテキストを編集" }),
    ).toBeVisible()
    // 1枚を取り外すと、プレビューが1枚になる
    await segment.getByRole("button", { name: "画像1を削除" }).click()
    await expect(
        segment.getByRole("button", { name: "画像2を削除" }),
    ).toHaveCount(0)
    await expect(
        segment.getByRole("button", { name: "画像1を削除" }),
    ).toHaveCount(1)
})

test("[schedule-form/AC-10] 編集中の予約のボタンで置き換えが呼ばれ、作成は呼ばれない", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, {
        items: [item({ id: "s1", status: "pending", preview: "書き戻す本文" })],
        details: { s1: detailWithImage("s1") },
    })
    await page.goto("/post/")
    await editSchedule(page, "書き戻す本文")
    await submitButton(page).click()
    await expect(page.getByText("予約を更新しました。")).toBeVisible()
    expect(calls.updates).toHaveLength(1)
    expect(new URL(calls.updates[0]!.url()).pathname).toMatch(
        /^\/v2\/schedules\/s1\/?$/,
    )
    expect(calls.creates).toHaveLength(0)
    await expect(editor(page)).not.toContainText("書き戻す本文")
})

test("[schedule-form/AC-15] 編集中のキャンセルで3つの選択肢が出て、取消を選ぶと取消が呼ばれフォームが空になる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, {
        items: [item({ id: "s1", status: "pending", preview: "書き戻す本文" })],
        details: { s1: detailWithImage("s1") },
    })
    await page.goto("/post/")
    await editSchedule(page, "書き戻す本文")
    await page.getByRole("button", { name: "キャンセル" }).first().click()
    const choice = page.getByRole("dialog", { name: "予約の編集をやめます" })
    await expect(
        choice.getByRole("button", { name: "予約を取り消す" }),
    ).toBeVisible()
    await expect(
        choice.getByRole("button", { name: "予約を残して閉じる" }),
    ).toBeVisible()
    await expect(
        choice.getByRole("button", { name: "編集を続ける" }),
    ).toBeVisible()
    await choice.getByRole("button", { name: "予約を取り消す" }).click()
    await expect(page.getByText("予約を取り消しました。")).toBeVisible()
    expect(calls.deletes).toEqual(["s1"])
    await expect(editor(page)).not.toContainText("書き戻す本文")
})

test("[schedule-form/AC-16] 編集中に予約を残して閉じるを選ぶと、取消も置き換えも呼ばれずフォームが空になる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, {
        items: [item({ id: "s1", status: "pending", preview: "書き戻す本文" })],
        details: { s1: detailWithImage("s1") },
    })
    await page.goto("/post/")
    await editSchedule(page, "書き戻す本文")
    await page.getByRole("button", { name: "キャンセル" }).first().click()
    await page
        .getByRole("dialog", { name: "予約の編集をやめます" })
        .getByRole("button", { name: "予約を残して閉じる" })
        .click()
    await expect(editor(page)).not.toContainText("書き戻す本文")
    expect(calls.deletes).toHaveLength(0)
    expect(calls.updates).toHaveLength(0)
    await expect(submitButton(page)).toHaveText("投稿")
})

test("[schedule-form/AC-18] 編集中に日時を解除すると確認なしで取消が呼ばれ、本文が残り、変更せずにキャンセルしても下書きの確認が出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, {
        items: [item({ id: "s1", status: "pending", preview: "書き戻す本文" })],
        details: { s1: detailWithImage("s1") },
    })
    await page.goto("/post/")
    await editSchedule(page, "書き戻す本文")
    await page.getByTestId("schedule-picker-button").click()
    await page
        .getByRole("dialog", { name: "予約日時" })
        .getByRole("button", { name: "解除" })
        .click()
    await expect(page.getByText("予約を取り消しました。")).toBeVisible()
    expect(calls.deletes).toEqual(["s1"])
    await expect(editor(page)).toContainText("書き戻す本文")
    await expect(submitButton(page)).toHaveText("投稿")

    await page.getByRole("button", { name: "キャンセル" }).first().click()
    await expect(
        page
            .getByRole("dialog", { name: "下書き保存確認" })
            .getByRole("button", { name: "下書きを保存" }),
    ).toBeVisible()
})

test("[schedule-form/AC-26] 失敗の予約を書き戻すと日時の無い新規の入力として戻り、予約に成功すると元の履歴の削除が呼ばれる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, {
        items: [
            item({
                id: "f1",
                status: "failed",
                preview: "書き戻す本文",
                lastError: "InvalidRecord",
            }),
        ],
        details: {
            f1: { ...detailWithImage("f1"), status: "failed" },
        },
    })
    await page.goto("/post/")
    const list = await openSchedulesTab(page)
    await list.getByRole("button", { name: "フォームに書き戻す" }).click()
    await expect(
        page.getByText("予約をフォームに読み込みました。"),
    ).toBeVisible()
    // 内容が戻り、日時は未設定のまま投稿のボタンになる
    await expect(editor(page)).toContainText("書き戻す本文")
    await expect(submitButton(page)).toHaveText("投稿")
    await expect(page.getByTestId("schedule-run-at-label")).toHaveCount(0)
    expect(calls.deletes).toHaveLength(0)

    // 日時を設定して予約すると、作成の後に元の失敗の履歴が削除される
    await page.getByTestId("schedule-picker-button").click()
    await page
        .getByRole("dialog", { name: "予約日時" })
        .getByRole("button", { name: "設定" })
        .click()
    await submitButton(page).click()
    await expect(page.getByText("予約しました。")).toBeVisible()
    expect(calls.creates).toHaveLength(1)
    await expect.poll(() => calls.deletes).toEqual(["f1"])
})

test("[schedule-form/AC-35] 予約投稿が無効のとき、予約のタブに設定を開くボタンが出て、本文があれば確認を挟んで設定へ移る", async ({
    page,
}) => {
    test.setTimeout(120_000)
    await mockScheduleApi(page, { registered: false, items: [ITEMS[1]] })
    await page.goto("/post/")
    let list = await openSchedulesTab(page)
    const notice = list.getByTestId("schedule-list-disabled")
    await expect(notice).toContainText(
        "予約投稿は、設定で有効にすると使えます。",
    )
    await expect(list.locator('[data-status="failed"]')).toHaveCount(1)
    await notice.getByRole("button", { name: "設定を開く" }).click()
    await expect(page).toHaveURL(/\/settings\/$/)

    // 本文があるときは、移る前に下書きの保存の確認が出て、編集を続けると移らない
    await page.goto("/post/")
    await expect(editor(page)).toBeVisible({ timeout: 60_000 })
    await expect(async () => {
        await editor(page).click()
        await page.keyboard.type("作成中の本文")
        await expect(editor(page)).toContainText("作成中の本文", {
            timeout: 2_000,
        })
    }).toPass({ timeout: 20_000 })
    list = await openSchedulesTab(page)
    await list
        .getByTestId("schedule-list-disabled")
        .getByRole("button", { name: "設定を開く" })
        .click()
    const confirm = page.getByRole("dialog", { name: "下書き保存確認" })
    await expect(confirm).toBeVisible()
    await confirm.getByRole("button", { name: "編集を続ける" }).click()
    expect(new URL(page.url()).pathname).toBe("/post/")
    await expect(editor(page)).toContainText("作成中の本文")
})

test.describe("狭い画面", () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test("[schedule-form/AC-19] 画面幅390のとき、予約のタブの操作の縦横が44ピクセル以上", async ({
        page,
    }) => {
        test.setTimeout(90_000)
        await mockScheduleApi(page, { items: [...ITEMS] })
        await page.goto("/post/")
        const list = await openSchedulesTab(page)
        const controls = [
            list.getByRole("button", { name: /本文-a/ }),
            list.getByRole("button", { name: "履歴を削除" }).first(),
            list.getByRole("button", { name: "フォームに書き戻す" }),
            page.getByRole("tab", { name: "予約" }),
        ]
        for (const control of controls) {
            const box = (await control.boundingBox())!
            expect(box.width).toBeGreaterThanOrEqual(44)
            expect(box.height).toBeGreaterThanOrEqual(44)
        }
    })
})
