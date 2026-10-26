/**
 * 投稿フォームの予約（カレンダーのボタン・RunAtPicker・予約の送信）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 予約・認証情報・動画の API を差し替え、カレンダーのボタンの可否・日時の既定値と範囲・
 *   ボタンの文言の切り替え・予約の作成・エラーの文言・二重送信の防止・新規の予約のキャンセル・
 *   狭い画面の寸法を検証する。
 */
import path from "node:path"
import { expect, test } from "./fixtures"
import type { Page, Route } from "@playwright/test"
import { mockScheduleApi } from "./scheduleMocks"

const SAMPLE = path.resolve("tests/fixtures/video-sample.mp4")
const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
}

/** 動画のアップロードが即座に完了するよう、トークン発行と動画サービスを差し替える */
const mockVideo = async (page: Page) => {
    const json = (route: Route, body: unknown) =>
        route.fulfill({
            headers: { ...CORS, "content-type": "application/json" },
            body: JSON.stringify(body),
        })
    await page.route("**/v2/bsky/video/upload-token/", route =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                token: "tok",
                did: "did:plc:me",
                expiresAt: Math.floor(Date.now() / 1000) + 1800,
            }),
        }),
    )
    await page.route("https://video.bsky.app/xrpc/**", async route => {
        if (route.request().method() === "OPTIONS") {
            return route.fulfill({ status: 204, headers: CORS })
        }
        const name = new URL(route.request().url()).pathname.split(
            "app.bsky.video.",
        )[1]
        if (name === "startUpload")
            return json(route, {
                jobId: "j",
                partSizeBytes: 5_242_880,
                partCount: 1,
            })
        if (name === "finishUpload") return json(route, { completedJobId: "j" })
        if (name === "getJobStatus")
            return json(route, {
                jobStatus: {
                    state: "JOB_STATE_COMPLETED",
                    blob: {
                        $type: "blob",
                        ref: { $link: "bafkreivideo" },
                        mimeType: "video/mp4",
                        size: 82271,
                    },
                },
            })
        return json(route, {})
    })
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

const pickerButton = (page: Page) => page.getByTestId("schedule-picker-button")
const pickerDialog = (page: Page) =>
    page.getByRole("dialog", { name: "予約日時" })
const submitButton = (page: Page) => page.getByTestId("composer-submit")

const localValue = (offsetMs: number) => {
    const d = new Date(Date.now() + offsetMs)
    const p = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** カレンダーのボタンから日時の指定を開く */
const openPicker = async (page: Page) => {
    const button = pickerButton(page)
    await expect(button).toBeEnabled({ timeout: 30_000 })
    await expect(async () => {
        await button.click()
        await expect(pickerDialog(page)).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    return pickerDialog(page)
}

/** 既定値のまま日時を設定する */
const setDefaultRunAt = async (page: Page) => {
    const dialog = await openPicker(page)
    await dialog.getByRole("button", { name: "設定" }).click()
    await expect(dialog).toBeHidden()
}

test("[schedule-form/3.1,3.2] 予約投稿が無効のときは、カレンダーのボタンが押せない", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page, { registered: false })
    await page.goto("/post/")
    await typeBody(page, "本文")
    await expect(pickerButton(page)).toBeDisabled()
    await expect(pickerButton(page)).toHaveAttribute(
        "title",
        "予約投稿は、設定で有効にすると使えます。",
    )
})

/** 動画のファイル入力 */
const videoInput = (page: Page) =>
    page
        .getByTestId("thread-segment-0")
        .locator('input[type="file"][accept*="video/quicktime"]')
        .first()

test("[schedule-form/3.4] 動画を添付すると、カレンダーのボタンが押せず、理由が示される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await mockVideo(page)
    await page.goto("/post/")
    await typeBody(page, "本文")
    await expect(pickerButton(page)).toBeEnabled({ timeout: 30_000 })
    await videoInput(page).setInputFiles(SAMPLE)
    await expect(page.getByTestId("video-preview")).toBeVisible()
    await expect(pickerButton(page)).toBeDisabled()
    await expect(pickerButton(page)).toHaveAttribute(
        "title",
        "動画を含む投稿は予約できません。",
    )
    // 確認のダイアログは出さない
    await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("[schedule-form/3.5] 実行日時を設定すると、動画のボタンが押せない", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    await typeBody(page, "本文")
    await setDefaultRunAt(page)
    await expect(videoInput(page)).toBeDisabled()
})

const pendingItem = (id: string) => ({
    id,
    runAt: "2027-03-01T10:00:00.000Z",
    status: "pending" as const,
    postCount: 1,
    preview: id,
    lastError: null,
})

test("[schedule-form/3.8,3.9] 日時の指定に待機中の予約の枠が棒で示され、空きが無いと設定できない", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { state } = await mockScheduleApi(page, {
        items: ["a", "b", "c"].map(pendingItem),
    })
    await page.goto("/post/")
    await typeBody(page, "本文")
    let dialog = await openPicker(page)
    const slots = dialog.getByRole("meter", { name: "待機中の予約の枠" })
    await expect(slots).toHaveAttribute("aria-valuenow", "3")
    await expect(slots).toHaveAttribute("aria-valuemax", "5")
    await expect(dialog.getByText("残り2件（5件まで）")).toBeVisible()
    const marks = await slots
        .locator("span")
        .evaluateAll(els => els.map(el => el.getAttribute("data-state")))
    expect(marks).toEqual(["used", "used", "used", "next", "free"])
    await dialog.getByRole("button", { name: "閉じる" }).click()

    // 空きが無いと、新しい予約の日時は設定できない
    state.items = ["a", "b", "c", "d", "e"].map(pendingItem)
    dialog = await openPicker(page)
    await expect(
        dialog.getByText("待機中の予約が上限に達しています"),
    ).toBeVisible()
    await expect(dialog.getByRole("button", { name: "設定" })).toBeDisabled()
})

test("[schedule-form/1.2,2.2 schedule-form/3.6 schedule-form/3.7] 予約投稿が有効なら押せ、既定値は翌日の同時刻で、範囲外では設定できない", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    await typeBody(page, "本文")
    const dialog = await openPicker(page)
    const input = dialog.getByLabel("投稿する日時")
    const value = await input.inputValue()
    const diff = new Date(value).getTime() - Date.now()
    expect(diff).toBeGreaterThan(24 * 3600_000 - 120_000)
    expect(diff).toBeLessThanOrEqual(24 * 3600_000)

    const set = dialog.getByRole("button", { name: "設定" })
    await input.fill(localValue(4 * 60_000))
    await expect(set).toBeDisabled()
    await expect(dialog.getByRole("alert")).toContainText("5分後以降")
    await input.fill(localValue(15 * 86400_000))
    await expect(set).toBeDisabled()
    await expect(dialog.getByRole("alert")).toContainText("14日後まで")
    await input.fill(localValue(14 * 86400_000 - 120_000))
    await expect(set).toBeEnabled()
})

test("[schedule-form/4.1 schedule-form/4.2] 日時を設定するとボタンが強調され、実行日時の行が出て、予約のボタンで作成が1回呼ばれ本文が空になる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page)
    await page.goto("/post/")
    await typeBody(page, "予約する本文")
    await expect(submitButton(page)).toHaveText("投稿")
    await setDefaultRunAt(page)
    await expect(pickerButton(page)).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByTestId("schedule-run-at-label")).toContainText(
        "に予約",
    )
    await expect(submitButton(page)).toHaveText("予約")

    await submitButton(page).click()
    await expect(page.getByText("予約しました。")).toBeVisible()
    expect(calls.creates).toHaveLength(1)
    expect(calls.creates[0]!.postData()).toMatch(
        /name="runAt"\r\n\r\n\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}\r\n/,
    )
    await expect(
        page.locator("[data-post-body-editor]").first(),
    ).not.toContainText("予約する本文")
    await expect(submitButton(page)).toHaveText("投稿")
    await expect(page.getByTestId("schedule-run-at-label")).toHaveCount(0)
})

test("[schedule-form/4.1] スレッドでは、すべて投稿がすべて予約になる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    await typeBody(page, "1件目")
    await page.getByRole("button", { name: "スレッドに追加" }).first().click()
    await expect(submitButton(page)).toHaveText("すべて投稿")
    await setDefaultRunAt(page)
    await expect(submitButton(page)).toHaveText("すべて予約")
})

test("[schedule-form/4.4] 予約の作成が409を返すと日本語の文言が表示され、入力が残る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page, {
        submitStatus: 409,
        submitBody: { error: "ScheduleCredentialRequired" },
    })
    await page.goto("/post/")
    await typeBody(page, "残る本文")
    await setDefaultRunAt(page)
    await submitButton(page).click()
    await expect(
        page.getByText(
            "予約投稿が無効です。設定で予約投稿を有効にしてください。",
        ),
    ).toBeVisible()
    await expect(page.locator("[data-post-body-editor]").first()).toContainText(
        "残る本文",
    )
})

test.describe("英語の表示", () => {
    test.use({ locale: "en-US" })

    test("[schedule-form/4.4] 予約の作成が409を返すと英語の文言が表示される", async ({
        page,
    }) => {
        test.setTimeout(90_000)
        await mockScheduleApi(page, {
            submitStatus: 409,
            submitBody: { error: "ScheduleRunning" },
        })
        await page.goto("/post/")
        await typeBody(page, "text")
        const button = pickerButton(page)
        await expect(button).toBeEnabled({ timeout: 30_000 })
        await button.click()
        await page
            .getByRole("dialog", { name: "Schedule" })
            .getByRole("button", { name: "Set" })
            .click()
        await submitButton(page).click()
        await expect(
            page.getByText("It is running and cannot be changed now."),
        ).toBeVisible()
    })
})

test("[schedule-form/4.5] 送信中に予約のボタンを2回押しても、作成の呼び出しは1回だけ", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const { calls } = await mockScheduleApi(page, { delayMs: 800 })
    await page.goto("/post/")
    await typeBody(page, "二重送信")
    await setDefaultRunAt(page)
    await submitButton(page).dblclick()
    await expect(page.getByText("予約しました。")).toBeVisible()
    expect(calls.creates).toHaveLength(1)
})

test("[schedule-form/4.9] 新規の予約の日時を設定した入力でキャンセルすると、下書きの保存の確認が出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockScheduleApi(page)
    await page.goto("/post/")
    await typeBody(page, "新規の予約")
    await setDefaultRunAt(page)
    await page.getByRole("button", { name: "キャンセル" }).first().click()
    const confirm = page.getByRole("dialog", { name: "下書き保存確認" })
    await expect(
        confirm.getByRole("button", { name: "下書きを保存" }),
    ).toBeVisible()
    await expect(confirm.getByRole("button", { name: "破棄" })).toBeVisible()
    await expect(
        confirm.getByRole("button", { name: "編集を続ける" }),
    ).toBeVisible()
    await confirm.getByRole("button", { name: "破棄" }).click()
    await expect(
        page.locator("[data-post-body-editor]").first(),
    ).not.toContainText("新規の予約")
})

test.describe("狭い画面", () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test("[schedule-form/3.10] 画面幅390のとき、カレンダーのボタンの縦横が44ピクセル以上", async ({
        page,
    }) => {
        test.setTimeout(90_000)
        await mockScheduleApi(page)
        await page.goto("/post/")
        await typeBody(page, "本文")
        await expect(pickerButton(page)).toBeEnabled({ timeout: 30_000 })
        const box = (await pickerButton(page).boundingBox())!
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
    })
})
