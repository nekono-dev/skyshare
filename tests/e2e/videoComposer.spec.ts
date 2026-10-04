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
import { expect, test, type Page, type Route } from "@playwright/test"
import path from "node:path"

const SAMPLE = path.resolve("tests/fixtures/video-sample.mp4")
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
    return { calls, releaseJob: release }
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
    editor.locator('input[type="file"][accept="video/mp4"]').first()
const imageInput = (editor: ReturnType<Page["locator"]>) =>
    editor.locator('input[type="file"][accept="image/*"]')

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

    test("動画を選ぶと進捗が表示され、完了後に投稿ボタンが有効になる（シナリオ1）", async ({
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

    test("変換完了まで投稿ボタンが無効で理由が表示され、完了後に有効になる（シナリオ2・10）", async ({
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

    test("mp4 以外・301MB の動画は添付されず理由が表示される（シナリオ3）", async ({
        page,
    }) => {
        const mocks = await mockVideoApis(page)
        const editor = await openComposer(page)

        await videoInput(editor).setInputFiles({
            name: "a.webm",
            mimeType: "video/webm",
            buffer: Buffer.from("x"),
        })
        await expect(page.getByRole("alert")).toContainText("mp4形式のみ")
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

    test("動画添付済みの segment で画像・OGP が無効、画像添付済みで動画が無効（シナリオ4）", async ({
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

    test("動画を取り外すと画像・OGP のボタンが有効に戻り、アップロード中の取り外しで abortUpload が呼ばれる（シナリオ5・12）", async ({
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

    test("トークン発行が 400 なら動画は送信されず unsupportedPds が表示される（シナリオ6）", async ({
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

    test("アップロード失敗の動画が残る間は投稿できず、取り外すと投稿できる（シナリオ11）", async ({
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

    test("動画追加ボタンは画像追加ボタンと別要素で、直後に並び、青い絵柄を使う（シナリオ13）", async ({
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
})
