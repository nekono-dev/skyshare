/**
 * 動画投稿（ThreadComposer の動画添付・先行アップロード）のヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - `/post/?guest`（ログイン不要のゲスト表示）で、動画の選択→検査→進捗→完了、排他制御、
 *   取り外し、投稿ボタンの無効化条件を検証する。`video.bsky.app` と
 *   `/v2/bsky/video/upload-token` は `page.route` でモックする（実アカウント・実通信なし）。
 * - ゲスト表示では実際の投稿（`POST /v2/entry`）がスキップされるため、投稿内容
 *   （`posts[i].video` 等）の検証は `tests/components/post/ThreadComposer/submitThread.test.ts`
 *   が担う。
 */
import { expect, test } from "./fixtures"
import { type Locator, type Page, type Route } from "@playwright/test"
import { readFileSync } from "node:fs"
import path from "node:path"

const SAMPLE = path.resolve("tests/fixtures/video-sample.mp4")
const SAMPLE_MOV = path.resolve("tests/fixtures/video-sample.mov")
const SAMPLE_WEBM = path.resolve("tests/fixtures/video-sample.webm")
const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
)
const BLOB = {
    $type: "blob",
    ref: { $link: "bafkreivideo" },
    mimeType: "video/mp4",
    size: 82271,
}
const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
}

type Mocks = {
    calls: string[]
    /** `startUpload` のリクエストボディ（JSON） */
    startBodies: { mimeType: string }[]
    /** getJobStatus を完了させる（`holdJob: true` のとき必要） */
    releaseJob: () => void
}

/** 動画サービスとトークン発行 API のモックを設置する。 */
const mockVideoApis = async (
    page: Page,
    options: {
        tokenStatus?: number
        holdJob?: boolean
        startError?: string
    } = {},
): Promise<Mocks> => {
    const calls: string[] = []
    const startBodies: { mimeType: string }[] = []
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => {
        release = resolve
    })
    const json = (route: Route, body: unknown, status = 200) =>
        route.fulfill({
            status,
            headers: { ...CORS, "content-type": "application/json" },
            body: JSON.stringify(body),
        })

    await page.route("**/v2/bsky/video/upload-token/", route => {
        calls.push("upload-token")
        const status = options.tokenStatus ?? 200
        return route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(
                status === 200
                    ? {
                          token: "tok",
                          did: "did:plc:me",
                          expiresAt: Math.floor(Date.now() / 1000) + 1800,
                      }
                    : { error: "BAD" },
            ),
        })
    })

    await page.route("https://video.bsky.app/xrpc/**", async route => {
        const request = route.request()
        if (request.method() === "OPTIONS") {
            return route.fulfill({ status: 204, headers: CORS })
        }
        const name = new URL(request.url()).pathname.split("app.bsky.video.")[1]
        calls.push(name)
        switch (name) {
            case "startUpload":
                startBodies.push(request.postDataJSON())
                return options.startError
                    ? json(route, { error: options.startError }, 400)
                    : json(route, {
                          jobId: "job1",
                          partSizeBytes: 5_242_880,
                          partCount: 1,
                      })
            case "uploadPart":
                return json(route, {})
            case "finishUpload":
                return json(route, { completedJobId: "job1" })
            case "abortUpload":
                return json(route, {})
            case "getJobStatus":
                if (options.holdJob) await gate
                return json(route, {
                    jobStatus: { state: "JOB_STATE_COMPLETED", blob: BLOB },
                })
            default:
                return route.abort()
        }
    })
    return { calls, startBodies, releaseJob: release }
}

const openComposer = async (page: Page) => {
    await page.goto("/post/?guest")
    await page.waitForFunction(
        () => document.querySelector("astro-island[ssr]") === null,
    )
    const segment = page.getByTestId("thread-segment-0")
    await expect(segment).toBeVisible()
    return segment.getByTestId("segment-editor")
}

const videoInput = (editor: ReturnType<Page["locator"]>) =>
    editor.locator('input[type="file"][accept*="video/quicktime"]').first()
const imageInput = (editor: ReturnType<Page["locator"]>) =>
    editor.locator('input[type="file"][accept="image/*"]')

/** `<img>` を canvas に描き、自然サイズと、中央（再生記号）・左下（旧バッジ位置）の白画素の有無を返す。 */
const inspectVisual = (img: Locator) =>
    img.evaluate(async (el: HTMLImageElement) => {
        await el.decode()
        const canvas = document.createElement("canvas")
        canvas.width = el.naturalWidth
        canvas.height = el.naturalHeight
        const context = canvas.getContext("2d", { willReadFrequently: true })!
        context.drawImage(el, 0, 0)
        const center = Array.from(
            context.getImageData(598, 315, 1, 1).data.slice(0, 3),
        )
        const oldBadge = context.getImageData(28, 554, 106, 49).data
        let whites = 0
        for (let i = 0; i < oldBadge.length; i += 4) {
            if (
                oldBadge[i] >= 200 &&
                oldBadge[i + 1] >= 200 &&
                oldBadge[i + 2] >= 200
            )
                whites++
        }
        return {
            width: el.naturalWidth,
            height: el.naturalHeight,
            center,
            whites,
        }
    })

/** ファイルをエディタ領域へドロップする（dragover → drop を発火）。 */
const dropFiles = (
    editor: Locator,
    files: { name: string; type: string; base64: string }[],
) =>
    editor.evaluate(async (el, items) => {
        const transfer = new DataTransfer()
        for (const item of items) {
            const bytes = Uint8Array.from(atob(item.base64), c =>
                c.charCodeAt(0),
            )
            transfer.items.add(
                new File([bytes], item.name, { type: item.type }),
            )
        }
        for (const type of ["dragover", "drop"]) {
            el.dispatchEvent(
                new DragEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: transfer,
                }),
            )
        }
    }, files)

const sampleDrop = () => ({
    name: "video-sample.mp4",
    type: "video/mp4",
    base64: readFileSync(SAMPLE).toString("base64"),
})

const submitButton = (page: Page) => page.locator('button[type="submit"]')

test.describe("動画投稿（ThreadComposer）", () => {
    test.beforeAll(async ({ browser }) => {
        test.setTimeout(90_000)
        const page = await browser.newPage({ ignoreHTTPSErrors: true })
        await page.goto("/post/?guest", { timeout: 60_000 })
        await expect(page.getByTestId("thread-segment-0")).toBeVisible({
            timeout: 60_000,
        })
        await page.close()
    })

    test("[video-picker/AC-8] 動画を選ぶと進捗が表示され、完了後に投稿ボタンが有効になる（シナリオ1）", async ({
        page,
    }) => {
        await mockVideoApis(page)
        const editor = await openComposer(page)
        await videoInput(editor).setInputFiles(SAMPLE)

        const preview = page.getByTestId("video-preview")
        await expect(preview).toBeVisible()
        await expect(preview.locator("img")).toBeVisible()
        await expect(preview.getByText("アップロード完了")).toBeVisible()
        await expect(submitButton(page)).toBeEnabled()
    })

    test("[video-picker/AC-7 video-picker/AC-8] 動画のプレビューは画像と同じ見た目の大きなサムネイルで、×・alt ボタンと進捗の配置が正しい（レイアウト）", async ({
        page,
    }) => {
        const mocks = await mockVideoApis(page, { holdJob: true })
        const editor = await openComposer(page)
        await videoInput(editor).setInputFiles(SAMPLE)

        const preview = page.getByTestId("video-preview")
        await expect(preview).toBeVisible()
        const thumb = preview.locator("img").locator("..")
        const box = (await thumb.boundingBox())!
        const editorBox = (await editor.boundingBox())!
        // フォーム幅いっぱいの、約 1200:630 のサムネイル
        expect(box.width).toBeGreaterThan(editorBox.width * 0.8)
        expect(box.width / box.height).toBeCloseTo(1200 / 630, 1)

        // 右上の「×」と右下の「alt」が、画像の従来より大きい寸法で表示される
        const remove = preview.getByRole("button", { name: "動画を取り外す" })
        const alt = preview.getByRole("button", {
            name: "動画のaltテキストを編集",
        })
        const removeBox = (await remove.boundingBox())!
        const altBox = (await alt.boundingBox())!
        expect(removeBox.height).toBeGreaterThanOrEqual(36)
        expect(altBox.height).toBeGreaterThanOrEqual(36)
        // 縁取りがあり、マウスオーバーで背景色が変わる
        for (const button of [remove, alt]) {
            await expect(button).toHaveCSS("border-top-width", "2px")
            const before = await button.evaluate(
                el => getComputedStyle(el).backgroundColor,
            )
            await button.hover()
            await expect
                .poll(() =>
                    button.evaluate(el => getComputedStyle(el).backgroundColor),
                )
                .not.toBe(before)
        }
        expect(removeBox.y).toBeLessThan(box.y + box.height / 2)
        expect(altBox.y).toBeGreaterThan(box.y + box.height / 2)

        // 進捗はサムネイルの直下
        const progress = (await preview.getByRole("progressbar").boundingBox())!
        expect(progress.y).toBeGreaterThanOrEqual(box.y + box.height)

        // 投稿ボタンが押せない理由は、ツールバー（言語選択）の下かつプレビューの上
        const reason = (await page
            .getByTestId("video-submit-reason")
            .boundingBox())!
        const language = (await editor
            .getByRole("combobox")
            .last()
            .boundingBox())!
        expect(reason.y).toBeGreaterThanOrEqual(language.y + language.height)
        expect(reason.y + reason.height).toBeLessThanOrEqual(box.y)

        // alt ボタンからダイアログを開いて alt を設定できる
        await alt.click()
        const dialog = page.getByRole("dialog", {
            name: "画像のaltテキスト編集",
        })
        await dialog.getByRole("textbox").fill("動画の説明")
        await dialog.getByRole("button", { name: "適用" }).click()
        await expect(dialog).toHaveCount(0)
        await alt.click()
        await expect(page.getByRole("dialog").getByRole("textbox")).toHaveValue(
            "動画の説明",
        )
        await page.keyboard.press("Escape")

        // 「×」で取り外せる
        await remove.click()
        await expect(preview).toHaveCount(0)
        mocks.releaseJob()
    })

    test("[entry-visual/AC-5] 「サムネ調整」ボタンは動画追加ボタンの隣に現れ、アップロード中でも調整できる（サムネ調整）", async ({
        page,
    }) => {
        const mocks = await mockVideoApis(page, { holdJob: true })
        const editor = await openComposer(page)
        const adjust = editor.getByRole("button", { name: "サムネ調整" })
        // 何も添付していない間は表示されない
        await expect(adjust).toHaveCount(0)

        await videoInput(editor).setInputFiles(SAMPLE)
        await expect(page.getByRole("progressbar")).toBeVisible()
        await expect(adjust).toBeEnabled()

        // 動画追加ボタンの右隣（同じ行・動画追加ボタンより右）に置かれる
        const videoBox = (await editor.getByLabel("動画追加").boundingBox())!
        const adjustBox = (await adjust.boundingBox())!
        expect(adjustBox.x).toBeGreaterThan(videoBox.x)
        expect(Math.abs(adjustBox.y - videoBox.y)).toBeLessThan(40)

        // プレビューは再生ボタン入りの visual（1200x630）で、中央に再生記号がある
        const thumbImg = page.getByTestId("video-preview").locator("img")
        await expect(thumbImg).toHaveAttribute("src", /^blob:/)
        const initial = await inspectVisual(thumbImg)
        expect([initial.width, initial.height]).toEqual([1200, 630])
        for (const channel of initial.center) {
            expect(channel).toBeGreaterThanOrEqual(245)
        }
        expect(initial.whites).toBe(0)
        const initialSrc = await thumbImg.getAttribute("src")

        // 調整ダイアログには再生ボタンの描画済み画像ではなく poster だけが表示される
        await adjust.click()
        await expect(page.getByTestId("crop-slot")).toHaveCount(1)
        const dialogImg = page.getByTestId("crop-slot").locator("img").first()
        const dialogSize = await dialogImg.evaluate((el: HTMLImageElement) => [
            el.naturalWidth,
            el.naturalHeight,
        ])
        expect(dialogSize).not.toEqual([1200, 630])
        // キャンセルで閉じ、プレビューは変わらない
        await page.getByRole("button", { name: "キャンセル" }).click()
        await expect(page.getByTestId("crop-slot")).toHaveCount(0)
        await expect(thumbImg).toHaveAttribute("src", initialSrc!)

        // ズームして確定 → visual が作り直され、調整後も中央に再生記号が描かれる
        await adjust.click()
        const slider = page.locator('input[type="range"]').first()
        await expect(slider).toBeVisible()
        // 最小ズームは画像の読み込み後に確定するため、確定を待ってから min + 1 へ動かす
        await expect(slider).not.toHaveAttribute("min", "1")
        const minZoom = Number(await slider.getAttribute("min"))
        await slider.fill(String(minZoom + 1))
        await page.getByRole("button", { name: "OK" }).click()
        await expect(page.getByTestId("crop-slot")).toHaveCount(0)
        await expect(thumbImg).not.toHaveAttribute("src", initialSrc!)
        const adjusted = await inspectVisual(thumbImg)
        expect([adjusted.width, adjusted.height]).toEqual([1200, 630])
        for (const channel of adjusted.center) {
            expect(channel).toBeGreaterThanOrEqual(245)
        }
        expect(adjusted.whites).toBe(0)

        // アップロードの進捗が調整によって失われず、完了表示になる
        mocks.releaseJob()
        await expect(
            page.getByTestId("video-preview").getByText("アップロード完了"),
        ).toBeVisible()

        // 取り外すとボタンも消える
        await page.getByRole("button", { name: "動画を取り外す" }).click()
        await expect(adjust).toHaveCount(0)
    })

    test("非アクティブなsegmentの縮小表示は、再生ボタン入りの visual になる（縮小表示）", async ({
        page,
    }) => {
        await mockVideoApis(page)
        const editor = await openComposer(page)
        await videoInput(editor).setInputFiles(SAMPLE)
        await expect(
            page.getByTestId("video-preview").getByText("アップロード完了"),
        ).toBeVisible()

        // 2件目を追加すると先頭が非アクティブ（縮小表示）になる
        await page.getByRole("button", { name: "スレッドに追加" }).click()
        const summaryImg = page
            .getByTestId("thread-segment-0")
            .getByTestId("segment-thumbnail")
        await expect(summaryImg).toBeVisible()
        await expect(summaryImg).toHaveAttribute("src", /^blob:/)
        const visual = await inspectVisual(summaryImg)
        expect([visual.width, visual.height]).toEqual([1200, 630])
        for (const channel of visual.center) {
            expect(channel).toBeGreaterThanOrEqual(245)
        }
        expect(visual.whites).toBe(0)
    })

    test("[video-picker/AC-10] 変換完了まで投稿ボタンが無効で理由が表示され、完了後に有効になる（シナリオ2・10）", async ({
        page,
    }) => {
        const mocks = await mockVideoApis(page, { holdJob: true })
        const editor = await openComposer(page)
        await videoInput(editor).setInputFiles(SAMPLE)

        await expect(page.getByTestId("video-preview")).toBeVisible()
        await expect(page.getByRole("progressbar")).toBeVisible()
        await expect(submitButton(page)).toBeDisabled()
        await expect(page.getByTestId("video-submit-reason")).toContainText(
            "動画のアップロードが完了するまで投稿できません",
        )

        mocks.releaseJob()
        await expect(
            page.getByTestId("video-preview").getByText("アップロード完了"),
        ).toBeVisible()
        await expect(submitButton(page)).toBeEnabled()
        await expect(page.getByTestId("video-submit-reason")).toHaveCount(0)
    })

    test("mov・webm の動画も添付でき、startUpload に実形式の mimeType が渡る（Phase 14）", async ({
        page,
    }) => {
        const mocks = await mockVideoApis(page)
        const editor = await openComposer(page)
        const input = videoInput(editor)
        await expect(input).toHaveAttribute("accept", /video\/quicktime/)
        await expect(input).toHaveAttribute("accept", /\.mov/)
        await expect(input).toHaveAttribute("accept", /video\/webm/)
        await expect(input).toHaveAttribute("accept", /\.webm/)

        for (const [file, mimeType] of [
            [SAMPLE_MOV, "video/quicktime"],
            [SAMPLE_WEBM, "video/webm"],
        ]) {
            await input.setInputFiles(file)
            const preview = page.getByTestId("video-preview")
            await expect(preview.locator("img")).toBeVisible()
            await expect(preview.getByText("アップロード完了")).toBeVisible()
            await expect(submitButton(page)).toBeEnabled()
            expect(mocks.startBodies.at(-1)?.mimeType).toBe(mimeType)
            // 次の形式を選ぶため取り外す
            await preview
                .getByRole("button", { name: "動画を取り外す" })
                .click()
            await expect(preview).toHaveCount(0)
        }
    })

    test("[video-picker/AC-5] 拡張子が mp4 でも中身が動画でないファイルは unreadable で添付されず、アップロードも始まらない（Phase 14）", async ({
        page,
    }) => {
        const mocks = await mockVideoApis(page)
        const editor = await openComposer(page)
        await videoInput(editor).setInputFiles({
            name: "fake.mp4",
            mimeType: "video/mp4",
            buffer: Buffer.from("this is not a video"),
        })
        await expect(page.getByRole("alert")).toContainText(
            "動画を読み込めませんでした",
        )
        await expect(page.getByTestId("video-preview")).toHaveCount(0)
        expect(mocks.calls).toEqual([])
    })

    test("[video-picker/AC-3 video-picker/AC-6] 対応形式以外・301MB の動画は添付されず理由が表示される（シナリオ3）", async ({
        page,
    }) => {
        const mocks = await mockVideoApis(page)
        const editor = await openComposer(page)

        await videoInput(editor).setInputFiles({
            name: "a.avi",
            mimeType: "video/x-msvideo",
            buffer: Buffer.from("x"),
        })
        await expect(page.getByRole("alert")).toContainText(
            "対応していない動画形式",
        )
        await expect(page.getByTestId("video-preview")).toHaveCount(0)

        // サイズの偽装: 301MB の File を作ってプログラム的に選択させる
        await videoInput(editor).evaluate(input => {
            const file = new File([new Uint8Array(1)], "big.mp4", {
                type: "video/mp4",
            })
            Object.defineProperty(file, "size", { value: 301_000_000 })
            const transfer = new DataTransfer()
            transfer.items.add(file)
            ;(input as HTMLInputElement).files = transfer.files
            input.dispatchEvent(new Event("change", { bubbles: true }))
        })
        await expect(page.getByRole("alert")).toContainText("300MB以下")
        await expect(page.getByTestId("video-preview")).toHaveCount(0)
        expect(mocks.calls).toEqual([])
    })

    test("[video-picker/AC-2] 動画添付済みの segment で画像・OGP が無効、画像添付済みで動画が無効（シナリオ4）", async ({
        page,
    }) => {
        await mockVideoApis(page, { holdJob: true })
        const editor = await openComposer(page)

        // 画像を先に添付 → 動画追加が無効
        await imageInput(editor).setInputFiles({
            name: "t.png",
            mimeType: "image/png",
            buffer: PNG_1X1,
        })
        await expect(videoInput(editor)).toBeDisabled()
        await expect(
            editor.getByLabel("動画追加").locator(".."),
        ).toHaveAttribute("title", "画像を添付済みのため動画は追加できません")
    })

    test("[video-picker/AC-9] 動画を取り外すと画像・OGP のボタンが有効に戻り、アップロード中の取り外しで abortUpload が呼ばれる（シナリオ5・12）", async ({
        page,
    }) => {
        await mockVideoApis(page, { holdJob: true })
        const editor = await openComposer(page)
        // finishUpload 前の中断を観測するため、uploadPart を保留する
        await page.unroute("https://video.bsky.app/xrpc/**")
        let releasePart: () => void = () => {}
        const partGate = new Promise<void>(resolve => {
            releasePart = resolve
        })
        const calls: string[] = []
        await page.route("https://video.bsky.app/xrpc/**", async route => {
            const request = route.request()
            if (request.method() === "OPTIONS") {
                return route.fulfill({ status: 204, headers: CORS })
            }
            const name = new URL(request.url()).pathname.split(
                "app.bsky.video.",
            )[1]
            calls.push(name)
            const reply = (body: unknown) =>
                route.fulfill({
                    status: 200,
                    headers: { ...CORS, "content-type": "application/json" },
                    body: JSON.stringify(body),
                })
            if (name === "startUpload") {
                return reply({
                    jobId: "job1",
                    partSizeBytes: 5_242_880,
                    partCount: 1,
                })
            }
            if (name === "uploadPart") await partGate
            return reply({})
        })

        await videoInput(editor).setInputFiles(SAMPLE)
        await expect(page.getByTestId("video-preview")).toBeVisible()
        await expect(imageInput(editor)).toBeDisabled()
        await expect(submitButton(page)).toBeDisabled()

        await page.getByRole("button", { name: "動画を取り外す" }).click()
        await expect(page.getByTestId("video-preview")).toHaveCount(0)
        await expect(imageInput(editor)).toBeEnabled()
        // 完了を待たず投稿できる状態に戻る（テキストを入れれば投稿可能）
        await expect(page.getByTestId("video-submit-reason")).toHaveCount(0)
        await expect.poll(() => calls.includes("abortUpload")).toBe(true)
        expect(calls.filter(name => name === "abortUpload")).toHaveLength(1)
        releasePart()
    })

    test("[video-upload/AC-2] トークン発行が 400 なら動画は送信されず unsupportedPds が表示される（シナリオ6）", async ({
        page,
    }) => {
        const mocks = await mockVideoApis(page, { tokenStatus: 400 })
        const editor = await openComposer(page)
        await videoInput(editor).setInputFiles(SAMPLE)

        await expect(page.getByRole("alert")).toContainText(
            "bsky.social のアカウントのみ対応",
        )
        expect(mocks.calls).toEqual(["upload-token"])
    })

    test("[video-picker/AC-10] アップロード失敗の動画が残る間は投稿できず、取り外すと投稿できる（シナリオ11）", async ({
        page,
    }) => {
        await mockVideoApis(page, { startError: "DailyLimitExceeded" })
        const editor = await openComposer(page)
        await videoInput(editor).setInputFiles(SAMPLE)

        await expect(page.getByRole("alert")).toContainText(
            "動画アップロード上限",
        )
        await expect(submitButton(page)).toBeDisabled()
        await expect(page.getByTestId("video-submit-reason")).toContainText(
            "アップロードに失敗した動画があります",
        )
        // 別の動画を選び直せる導線がある
        await expect(
            page.getByText("別の動画を選ぶ", { exact: true }),
        ).toBeVisible()

        await page.getByRole("button", { name: "動画を取り外す" }).click()
        await expect(page.getByTestId("video-submit-reason")).toHaveCount(0)
        // テキストが空なので、投稿条件は別（テキスト入力）で満たす
        await editor.locator("[data-post-body-editor]").click()
        await page.keyboard.type("テキストのみ")
        await expect(submitButton(page)).toBeEnabled()
    })

    test("[video-picker/AC-1] 動画追加ボタンは画像追加ボタンと別要素で、直後に並び、青い絵柄を使う（シナリオ13）", async ({
        page,
    }) => {
        await mockVideoApis(page)
        const editor = await openComposer(page)

        const imageLabel = editor.getByLabel("画像追加")
        const videoLabel = editor.getByLabel("動画追加")
        await expect(imageLabel).toBeVisible()
        await expect(videoLabel).toBeVisible()
        expect(
            await imageLabel.evaluate(
                (el, other) =>
                    el !== other &&
                    !!el
                        .closest("section")
                        ?.nextElementSibling?.contains(other),
                await videoLabel.elementHandle(),
            ),
        ).toBe(true)

        const src = await videoLabel.locator("img").getAttribute("src")
        expect(src).toContain("video")
        const svgText = await page.evaluate(
            async url => (await fetch(url!)).text(),
            src,
        )
        expect(svgText).toContain('fill="#0085ff"')
    })

    test("[video-picker/AC-11] 動画をフォームへドロップすると添付され、アップロードが完了する", async ({
        page,
    }) => {
        await mockVideoApis(page)
        const editor = await openComposer(page)
        await dropFiles(editor, [sampleDrop()])

        const preview = page.getByTestId("video-preview")
        await expect(preview).toBeVisible()
        await expect(preview.getByText("アップロード完了")).toBeVisible()
        await expect(submitButton(page)).toBeEnabled()
    })

    test("[video-picker/AC-4] MIME が空の mov をドロップしても、拡張子で動画と判定され添付される（Phase 14）", async ({
        page,
    }) => {
        const mocks = await mockVideoApis(page)
        const editor = await openComposer(page)
        await dropFiles(editor, [
            {
                name: "video-sample.mov",
                type: "",
                base64: readFileSync(SAMPLE_MOV).toString("base64"),
            },
        ])
        await expect(
            page.getByTestId("video-preview").getByText("アップロード完了"),
        ).toBeVisible()
        expect(mocks.startBodies.at(-1)?.mimeType).toBe("video/quicktime")
    })

    test("対応形式以外の動画をドロップすると形式エラーが表示され添付されない", async ({
        page,
    }) => {
        await mockVideoApis(page)
        const editor = await openComposer(page)
        await dropFiles(editor, [
            { name: "a.avi", type: "video/x-msvideo", base64: "AAAA" },
        ])

        await expect(page.getByText(/対応していない動画形式/)).toBeVisible()
        await expect(page.getByTestId("video-preview")).toHaveCount(0)
    })

    test("[video-picker/AC-11] 動画添付済みのフォームへ動画をドロップしても差し替わらない", async ({
        page,
    }) => {
        const mocks = await mockVideoApis(page)
        const editor = await openComposer(page)
        await dropFiles(editor, [sampleDrop()])
        await expect(
            page.getByTestId("video-preview").getByText("アップロード完了"),
        ).toBeVisible()
        const before = mocks.calls.filter(c => c === "startUpload").length

        await dropFiles(editor, [sampleDrop()])
        await page.waitForTimeout(500)
        expect(mocks.calls.filter(c => c === "startUpload").length).toBe(before)
        await expect(page.getByTestId("video-preview")).toHaveCount(1)
    })

    test("[video-picker/AC-11] 画像添付済みのフォームへ動画をドロップしても添付されない", async ({
        page,
    }) => {
        await mockVideoApis(page)
        const editor = await openComposer(page)
        await imageInput(editor).setInputFiles({
            name: "a.png",
            mimeType: "image/png",
            buffer: PNG_1X1,
        })
        await expect(
            editor.getByRole("button", { name: /取り外|削除/ }).first(),
        ).toBeVisible()

        await dropFiles(editor, [sampleDrop()])
        await page.waitForTimeout(500)
        await expect(page.getByTestId("video-preview")).toHaveCount(0)
    })
})
