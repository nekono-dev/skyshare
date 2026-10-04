/**
 * 動画投稿の entry の visual（再生ボタン・再生時間バッジ入りの 1200x630 画像）の
 * 見た目の検証。
 *
 * 責務と処理概要:
 * - 無地の動画（`rgb(97,95,168)`）の poster から、実ブラウザ上で本実装の
 *   `probeVideo`・`createDefaultThumbnail`・`drawVideoOverlay` を実行して visual を生成し、
 *   画素をサンプリングして `specs/video/design.md §6.5` の寸法・色と照合する。
 * - 動画の縦横比（横長・正方形・縦長）によらず、円の中心とバッジの位置が同じであることを確認する。
 * - 許容誤差は色が各チャンネル ±6（JPEG 圧縮と補間のため）。
 */
import { expect, test, type Page } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

type Rgb = [number, number, number]

const fixture = (name: string) =>
    fs.readFileSync(path.resolve("tests/fixtures", name)).toString("base64")

const BACKGROUND: Rgb = [97, 95, 168]

/** ページ内で visual を生成し、指定座標の画素と、バッジ矩形内の白画素数などを返す。 */
const sampleVisual = async (
    page: Page,
    params: {
        base64: string
        durationSec?: number
        points: [number, number][]
    },
) =>
    page.evaluate(async ({ base64, durationSec, points }) => {
        // dev サーバー（Vite）が配信するモジュールを URL で読み込む（型解決の対象外）
        const load = (url: string): Promise<any> =>
            import(/* @vite-ignore */ url)
        const { probeVideo } = await load("/src/lib/video/probeVideo.ts")
        const { drawVideoOverlay } = await load(
            "/src/lib/video/videoOverlay.ts",
        )
        const { createDefaultThumbnail } = await load(
            "/src/lib/image/postImageProcessing.ts",
        )
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const file = new File([bytes], "v.mp4", { type: "video/mp4" })
        const probe = await probeVideo(file)
        const posterUrl = URL.createObjectURL(probe.posterBlob)
        const blob = await createDefaultThumbnail(
            [posterUrl],
            drawVideoOverlay(durationSec ?? probe.durationSec),
        )
        const bitmap = await createImageBitmap(blob)
        const canvas = document.createElement("canvas")
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext("2d", { willReadFrequently: true })!
        context.drawImage(bitmap, 0, 0)
        const pixel = (x: number, y: number) =>
            Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3))
        // バッジ矩形内の白に近い画素（各チャンネル 200 以上）の数
        const badge = context.getImageData(28, 554, 106, 49).data
        let whites = 0
        for (let i = 0; i < badge.length; i += 4) {
            if (badge[i] >= 200 && badge[i + 1] >= 200 && badge[i + 2] >= 200)
                whites++
        }
        // y=578 の行で、x=28 から背景に戻るまでの暗い領域の右端（バッジの幅の目安）
        const row = context.getImageData(0, 578, bitmap.width, 1).data
        let badgeRight = 0
        for (let x = 28; x < 400; x++) {
            const r = row[x * 4]
            if (r < 80) badgeRight = x
        }
        return {
            width: bitmap.width,
            height: bitmap.height,
            pixels: points.map(([x, y]) => pixel(x, y)),
            whites,
            badgeRight,
        }
    }, params)

const near = (actual: number[], expected: Rgb, tolerance = 6) => {
    for (let i = 0; i < 3; i++) {
        expect(
            Math.abs(actual[i] - expected[i]),
            `channel ${i}: actual ${actual} expected ${expected}`,
        ).toBeLessThanOrEqual(tolerance)
    }
}

const POINTS: [number, number][] = [
    [555, 315], // 円の内側
    [598, 315], // 再生記号の内側
    [300, 315], // 円の外側（左）
    [900, 315], // 円の外側（右）
    [38, 578], // バッジの左余白
    [300, 600], // バッジの外側
    [1100, 100], // 右上
]

test.describe("動画投稿の visual", () => {
    test.beforeAll(async ({ browser }) => {
        test.setTimeout(90_000)
        const page = await browser.newPage({ ignoreHTTPSErrors: true })
        await page.goto("/post/?guest", { timeout: 60_000 })
        await expect(page.getByTestId("thread-segment-0")).toBeVisible({
            timeout: 60_000,
        })
        await page.close()
    })

    for (const [label, name] of [
        ["横長 640x360", "video-solid.mp4"],
        ["正方形 480x480", "video-solid-square.mp4"],
        ["縦長 360x640", "video-solid-portrait.mp4"],
    ] as const) {
        test(`${label} の visual は、円・再生記号・バッジが同じ位置と色で描かれる（シナリオ1〜6・8）`, async ({
            page,
        }) => {
            await page.goto("/post/?guest")
            const result = await sampleVisual(page, {
                base64: fixture(name),
                points: POINTS,
            })
            expect([result.width, result.height]).toEqual([1200, 630])
            const [circle, play, left, right, badgePad, below, corner] =
                result.pixels
            near(circle, [69, 68, 97])
            for (const channel of play) {
                expect(channel).toBeGreaterThanOrEqual(245)
            }
            near(left, BACKGROUND)
            near(right, BACKGROUND)
            near(badgePad, [19, 19, 34])
            near(below, BACKGROUND)
            near(corner, BACKGROUND)
            expect(result.whites).toBeGreaterThanOrEqual(100)
        })
    }

    test("再生時間が長いほどバッジの幅が広がり、左端の位置は変わらない（シナリオ7）", async ({
        page,
    }) => {
        await page.goto("/post/?guest")
        const short = await sampleVisual(page, {
            base64: fixture("video-solid.mp4"),
            durationSec: 5,
            points: POINTS,
        })
        const long = await sampleVisual(page, {
            base64: fixture("video-solid.mp4"),
            durationSec: 600,
            points: POINTS,
        })
        expect(long.badgeRight).toBeGreaterThan(short.badgeRight)
        near(short.pixels[4], long.pixels[4] as Rgb, 2)
    })
})
