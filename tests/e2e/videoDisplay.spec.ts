/**
 * 動画投稿の表示（Timeline のサムネイル・Entry 詳細ページのプレイヤー・利用不可の動画）の
 * ヘッドレスブラウザによる動作確認。
 *
 * 責務と処理概要:
 * - ゲスト表示の Timeline（`/?guest`）とサンプル Entry ページ（`/entries/sample/`）で、
 *   動画投稿・利用不可の動画を含む投稿の表示と再生を検証する。
 * - `video.bsky.app` の playlist・セグメントは `tests/fixtures/hls/` の小さな HLS を
 *   `page.route` で返す（実通信なし）。
 */
import { expect, test, type Locator, type Page } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const HLS_DIR = path.resolve("tests/fixtures/hls")
const CORS = { "access-control-allow-origin": "*" }

/** HLS のモックを設置する。リクエストされた URL を返す配列に記録する。 */
const mockHls = async (page: Page, options: { playlist404?: boolean } = {}) => {
    const requests: string[] = []
    await page.route("https://video.bsky.app/watch/**", route => {
        const url = route.request().url()
        requests.push(url)
        const file = new URL(url).pathname.split("/").pop()!
        if (options.playlist404 && file === "playlist.m3u8") {
            return route.fulfill({ status: 404, headers: CORS, body: "" })
        }
        const filePath = path.join(HLS_DIR, file)
        if (!fs.existsSync(filePath)) {
            return route.fulfill({ status: 404, headers: CORS, body: "" })
        }
        return route.fulfill({
            status: 200,
            headers: {
                ...CORS,
                "content-type": file.endsWith(".m2ts")
                    ? "video/mp2t"
                    : "application/vnd.apple.mpegurl",
            },
            body: fs.readFileSync(filePath),
        })
    })
    return requests
}

const cardOf = (page: Page, text: string): Locator =>
    page.locator("article", { hasText: text })

const SAMPLE_VIDEO_TEXT = "スレッド4件目です。動画が付いています。"
const SAMPLE_UNSUPPORTED_TEXT = "スレッド5件目（末尾投稿）です。"
const TIMELINE_VIDEO_TEXT = "動画を添付した投稿の表示です。"
const TIMELINE_UNSUPPORTED_TEXT = "引用投稿に動画が添付された投稿の表示です。"

const sampleItem = (page: Page, text: string) =>
    page.locator("li", { hasText: text })

/** 再生ボタン（円と再生記号）の寸法・色を取得する。 */
const readPlayButton = async (scope: Locator) => {
    const button = scope.getByTestId("video-play-button")
    const box = await button.boundingBox()
    const style = await button.evaluate(
        el => getComputedStyle(el).backgroundColor,
    )
    const polygon = button.locator("polygon")
    return {
        width: box!.width,
        height: box!.height,
        background: style,
        fill: await polygon.getAttribute("fill"),
        points: await polygon.getAttribute("points"),
    }
}

test.describe("動画投稿の表示", () => {
    test.beforeAll(async ({ browser }) => {
        test.setTimeout(90_000)
        const page = await browser.newPage({ ignoreHTTPSErrors: true })
        await page.goto("/entries/sample/", { timeout: 60_000 })
        await page.close()
    })

    test("Timeline: 動画投稿は poster と再生マークで表示され、再生されず、グレーアウトされない（シナリオ1）", async ({
        page,
    }) => {
        const requests = await mockHls(page)
        await page.goto("/?guest")
        const card = cardOf(page, TIMELINE_VIDEO_TEXT)
        await expect(card).toBeVisible()

        const thumbnail = card.getByTestId("video-thumbnail")
        await expect(thumbnail.locator("img")).toBeVisible()
        await expect(card.getByTestId("video-play-button")).toBeVisible()
        await expect(card.locator("video")).toHaveCount(0)
        expect(await card.getAttribute("class")).not.toContain("card-muted")
        // entry 作成の対象（作成ボタンがある）
        await expect(
            card.getByRole("button", { name: "Skyshare Entryを作成" }),
        ).toBeVisible()

        await thumbnail.click()
        await expect(card.locator("video")).toHaveCount(0)
        expect(requests).toEqual([])
    })

    test("Entry 詳細: 初期は poster と再生ボタンのみで、動画データも hls.js も取得しない（シナリオ2）", async ({
        page,
    }) => {
        const requests = await mockHls(page)
        const scripts: string[] = []
        page.on("request", request => {
            if (/hls/i.test(request.url())) scripts.push(request.url())
        })
        await page.goto("/entries/sample/")
        const item = sampleItem(page, SAMPLE_VIDEO_TEXT)
        await expect(item).toBeVisible()

        await expect(
            item.getByRole("button", { name: "動画を再生" }),
        ).toBeVisible()
        await expect(
            item.locator("img[src*='sample-video-poster']"),
        ).toBeVisible()
        await expect(item.locator("video")).toHaveCount(0)
        expect(requests).toEqual([])
        expect(scripts).toEqual([])
    })

    test("再生ボタンで動画が再生され、hls.js と playlist が取得される。再生の前後でコンテナの高さが変わらない（シナリオ3・6）", async ({
        page,
    }) => {
        const requests = await mockHls(page)
        const scripts: string[] = []
        page.on("request", request => {
            if (/hls/i.test(request.url())) scripts.push(request.url())
        })
        await page.goto("/entries/sample/")
        const item = sampleItem(page, SAMPLE_VIDEO_TEXT)
        const player = item.getByTestId("video-player")
        await expect(player).toBeVisible()
        const before = (await player.boundingBox())!

        await item.getByRole("button", { name: "動画を再生" }).click()
        await expect(item.locator("video")).toBeVisible()
        await expect
            .poll(() => requests.some(url => url.endsWith("playlist.m3u8")))
            .toBe(true)
        // Chromium は hls.js（動的 import）で再生する
        expect(scripts.length).toBeGreaterThan(0)
        await expect(item.getByRole("alert")).toHaveCount(0)
        await expect
            .poll(() =>
                item
                    .locator("video")
                    .evaluate(el => (el as HTMLVideoElement).readyState),
            )
            .toBeGreaterThanOrEqual(2)

        const after = (await player.boundingBox())!
        expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1)
        expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1)
    })

    test("playlist が 404 なら再生失敗の文言と Bluesky へのリンクが表示される（シナリオ4）", async ({
        page,
    }) => {
        await mockHls(page, { playlist404: true })
        await page.goto("/entries/sample/")
        const item = sampleItem(page, SAMPLE_VIDEO_TEXT)
        await item.getByRole("button", { name: "動画を再生" }).click()

        const alert = item.getByRole("alert")
        await expect(alert).toContainText("動画を再生できませんでした")
        const link = alert.getByRole("link")
        await expect(link).toHaveAttribute(
            "href",
            "https://bsky.app/profile/guest.demo/post/threadsample4",
        )
        await expect(link).toHaveAttribute("target", "_blank")
    })

    test("再生ボタンはキーボード（Tab → Enter）で到達・操作できる（シナリオ5）", async ({
        page,
    }) => {
        await mockHls(page)
        await page.goto("/entries/sample/")
        const item = sampleItem(page, SAMPLE_VIDEO_TEXT)
        const button = item.getByRole("button", { name: "動画を再生" })
        await expect(button).toBeVisible()

        let focused = false
        for (let i = 0; i < 80 && !focused; i++) {
            await page.keyboard.press("Tab")
            focused = await button.evaluate(el => el === document.activeElement)
        }
        expect(focused).toBe(true)
        await page.keyboard.press("Enter")
        await expect(item.locator("video")).toBeVisible()
    })

    test("再生ボタンは直径 59px・半透明の暗い円・白い再生記号で、Timeline と Entry 詳細で同一（シナリオ8）", async ({
        page,
    }) => {
        await mockHls(page)
        await page.goto("/?guest")
        const timeline = await readPlayButton(
            cardOf(page, TIMELINE_VIDEO_TEXT).getByTestId("video-thumbnail"),
        )
        await page.goto("/entries/sample/")
        const detail = await readPlayButton(
            sampleItem(page, SAMPLE_VIDEO_TEXT).getByTestId("video-player"),
        )

        for (const button of [timeline, detail]) {
            expect(button.width).toBeCloseTo(59, 0)
            expect(button.height).toBeCloseTo(59, 0)
            expect(button.background).toBe("rgba(50, 50, 50, 0.6)")
            expect(button.fill).toBe("#ffffff")
            expect(button.points).toBe("0,0 0,25 20,12.5")
        }
        expect(timeline).toEqual(detail)
    })

    test("再生ボタンは動画の表示領域の中央に置かれる（シナリオ8補足）", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        const player = sampleItem(page, SAMPLE_VIDEO_TEXT).getByTestId(
            "video-player",
        )
        const frame = (await player.boundingBox())!
        const button = (await player
            .getByTestId("video-play-button")
            .boundingBox())!
        expect(button.x + button.width / 2).toBeCloseTo(
            frame.x + frame.width / 2,
            0,
        )
        expect(button.y + button.height / 2).toBeCloseTo(
            frame.y + frame.height / 2,
            0,
        )
    })

    test("Timeline: 利用不可の動画は poster が暗く表示され、文言とリンクがあり、再生ボタン・button が無く、グレーアウトされる（シナリオ9）", async ({
        page,
    }) => {
        await page.goto("/?guest")
        const card = cardOf(page, TIMELINE_UNSUPPORTED_TEXT)
        await expect(card).toBeVisible()
        const frame = card.getByTestId("video-unavailable")

        await expect(frame.locator("img")).toHaveCSS(
            "filter",
            /brightness\(0\.35\)/,
        )
        await expect(frame).toContainText("Skyshareでは再生できません")
        const link = frame.getByRole("link", { name: "Blueskyで見る" })
        await expect(link).toHaveAttribute(
            "href",
            "https://bsky.app/profile/guest.demo/post/guest-video-unsupported",
        )
        await expect(link).toHaveAttribute("target", "_blank")
        await expect(frame.getByTestId("video-play-button")).toHaveCount(0)
        await expect(frame.getByRole("button")).toHaveCount(0)
        await expect(card.locator("video")).toHaveCount(0)
        expect(await card.getAttribute("class")).toContain("card-muted")
        // entry 作成の対象外（作成ボタンは無く、対象外の表示になる）
        await expect(card.getByText("Skyshareリンク作成対象外")).toBeVisible()
        await expect(
            card.getByRole("button", { name: "Skyshare Entryを作成" }),
        ).toHaveCount(0)
    })

    test("Entry 詳細: 利用不可の動画も暗い poster・文言・リンクで表示され、再生ボタンが無い（シナリオ10）", async ({
        page,
    }) => {
        await page.goto("/entries/sample/")
        const item = sampleItem(page, SAMPLE_UNSUPPORTED_TEXT)
        const frame = item.getByTestId("video-unavailable")
        await expect(frame).toBeVisible()
        await expect(frame.locator("img")).toHaveCSS(
            "filter",
            /brightness\(0\.35\)/,
        )
        await expect(frame).toContainText("Skyshareでは再生できません")
        await expect(
            frame.getByRole("link", { name: "Blueskyで見る" }),
        ).toHaveAttribute("target", "_blank")
        await expect(frame.getByTestId("video-play-button")).toHaveCount(0)
        await expect(frame.getByRole("button")).toHaveCount(0)
    })
})
