/**
 * 動画投稿の entry の visual（再生ボタン入りの 1200x630 画像（再生時間は画像に埋め込まない））の
 * 見た目の検証。
 *
 * 責務と処理概要:
 * - 無地の動画（`rgb(97,95,168)`）の poster から、実ブラウザ上で本実装の
 *   `probeVideo`・`createDefaultThumbnail`・`drawVideoOverlay` を実行して visual を生成し、
 *   画素をサンプリングして `specs/entry-visual` の寸法・色と照合する。
 * - 動画の縦横比（横長・正方形・縦長）によらず、円の中心の位置が同じであることを確認する。
 * - 許容誤差は色が各チャンネル ±6（JPEG 圧縮と補間のため）。
 */
import { expect, test, type Page } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

type Rgb = [number, number, number]

const fixture = (name: string) =>
    fs.readFileSync(path.resolve("tests/fixtures", name)).toString("base64")

const BACKGROUND: Rgb = [97, 95, 168]

/** ページ内で visual を生成し、指定座標の画素と、左下（旧バッジ位置）の矩形内の白画素数を返す。 */
const sampleVisual = async (
    page: Page,
    params: {
        base64: string
        points: [number, number][]
        /** 指定時は既定配置ではなく、この切り抜き（poster 座標）で visual を作る */
        cropPixels?: { x: number; y: number; width: number; height: number }
    },
) =>
    page.evaluate(async ({ base64, points, cropPixels }) => {
        // dev サーバー（Vite）が配信するモジュールを URL で読み込む（型解決の対象外）
        const load = (url: string): Promise<any> =>
            import(/* @vite-ignore */ url)
        const { probeVideo } = await load("/src/lib/video/probeVideo.ts")
        const { drawVideoOverlay } = await load(
            "/src/lib/video/videoOverlay.ts",
        )
        const { createDefaultThumbnail, createCroppedThumbnail } = await load(
            "/src/lib/image/postImageProcessing.ts",
        )
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const file = new File([bytes], "v.mp4", { type: "video/mp4" })
        const probe = await probeVideo(file)
        const posterUrl = URL.createObjectURL(probe.posterBlob)
        const overlay = drawVideoOverlay()
        const blob = cropPixels
            ? await createCroppedThumbnail(
                  [posterUrl],
                  [{ crop: { x: 0, y: 0 }, zoom: 2, cropPixels }],
                  overlay,
              )
            : await createDefaultThumbnail([posterUrl], overlay)
        const bitmap = await createImageBitmap(blob)
        const canvas = document.createElement("canvas")
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext("2d", { willReadFrequently: true })!
        context.drawImage(bitmap, 0, 0)
        const pixel = (x: number, y: number) =>
            Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3))
        // 左下（旧バッジ位置）の矩形内の白に近い画素（各チャンネル 200 以上）の数
        const badge = context.getImageData(28, 554, 106, 49).data
        let whites = 0
        for (let i = 0; i < badge.length; i += 4) {
            if (badge[i] >= 200 && badge[i + 1] >= 200 && badge[i + 2] >= 200)
                whites++
        }
        return {
            width: bitmap.width,
            height: bitmap.height,
            pixels: points.map(([x, y]) => pixel(x, y)),
            whites,
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
    [38, 578], // 左下（旧バッジ位置）
    [300, 600], // 下辺
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
        test(`[entry-visual/AC-3 entry-visual/AC-11] ${label} の visual は、円・再生記号が同じ位置と色で描かれる（シナリオ1〜6・8）`, async ({
            page,
        }) => {
            await page.goto("/post/?guest")
            const result = await sampleVisual(page, {
                base64: fixture(name),
                points: POINTS,
            })
            expect([result.width, result.height]).toEqual([1200, 630])
            const [circle, play, left, right, oldBadge, below, corner] =
                result.pixels
            near(circle, [69, 68, 97])
            for (const channel of play) {
                expect(channel).toBeGreaterThanOrEqual(245)
            }
            near(left, BACKGROUND)
            near(right, BACKGROUND)
            near(oldBadge, BACKGROUND)
            near(below, BACKGROUND)
            near(corner, BACKGROUND)
            // 再生時間バッジは描かれない
            expect(result.whites).toBe(0)
        })
    }

    test("[entry-visual/AC-7] サムネ調整で切り抜きを変えても、円・再生記号の位置と色は変わらない（サムネ調整）", async ({
        page,
    }) => {
        await page.goto("/post/?guest")
        // poster（640x360）の右下寄りを 2 倍に拡大した切り抜き（既定は全面）
        const result = await sampleVisual(page, {
            base64: fixture("video-solid.mp4"),
            points: POINTS,
            cropPixels: { x: 320, y: 180, width: 320, height: 168 },
        })
        expect([result.width, result.height]).toEqual([1200, 630])
        const [circle, play, left, right, oldBadge, below, corner] =
            result.pixels
        near(circle, [69, 68, 97])
        for (const channel of play) {
            expect(channel).toBeGreaterThanOrEqual(245)
        }
        near(left, BACKGROUND)
        near(right, BACKGROUND)
        near(oldBadge, BACKGROUND)
        near(below, BACKGROUND)
        near(corner, BACKGROUND)
        // 再生時間バッジは描かれない
        expect(result.whites).toBe(0)
    })

    test.describe("既存の動画投稿からの事後作成（createPostVisualBlob）", () => {
        const THUMBNAIL = "https://video.bsky.app/watch/did/cid/thumbnail.jpg"
        const PLAYLIST = "https://video.bsky.app/watch/did/cid/playlist.m3u8"

        /** poster と HLS プレイリストをモックし、ページ内で visual を生成して画素を返す。 */
        const buildFromPost = async (
            page: Page,
            options: { playlist404?: boolean } = {},
        ) => {
            await page.route("https://video.bsky.app/watch/**", route => {
                const file = new URL(route.request().url()).pathname
                    .split("/")
                    .pop()!
                const cors = { "access-control-allow-origin": "*" }
                if (file === "thumbnail.jpg") {
                    // 配信側と同じく content-type は octet-stream
                    return route.fulfill({
                        status: 200,
                        headers: {
                            ...cors,
                            "content-type": "application/octet-stream",
                        },
                        body: fs.readFileSync(
                            path.resolve(
                                "tests/fixtures/video-solid-poster.jpg",
                            ),
                        ),
                    })
                }
                if (options.playlist404 && file === "playlist.m3u8") {
                    return route.fulfill({ status: 404, headers: cors })
                }
                const hlsFile = path.resolve("tests/fixtures/hls", file)
                if (!fs.existsSync(hlsFile)) {
                    return route.fulfill({ status: 404, headers: cors })
                }
                return route.fulfill({
                    status: 200,
                    headers: {
                        ...cors,
                        "content-type": "application/vnd.apple.mpegurl",
                    },
                    body: fs.readFileSync(hlsFile),
                })
            })
            await page.goto("/post/?guest")
            return page.evaluate(
                async ({ playlist, thumbnail, points }) => {
                    const load = (url: string): Promise<any> =>
                        import(/* @vite-ignore */ url)
                    const { createPostVisualBlob } = await load(
                        "/src/lib/entry/createPostVisual.ts",
                    )
                    try {
                        const { blob, videoDurationSec } =
                            await createPostVisualBlob({
                                images: [],
                                video: {
                                    cid: "cid",
                                    playlistUrl: playlist,
                                    thumbnailUrl: thumbnail,
                                    alt: "",
                                },
                            })
                        const bitmap = await createImageBitmap(blob)
                        const canvas = document.createElement("canvas")
                        canvas.width = bitmap.width
                        canvas.height = bitmap.height
                        const context = canvas.getContext("2d", {
                            willReadFrequently: true,
                        })!
                        context.drawImage(bitmap, 0, 0)
                        return {
                            ok: true as const,
                            size: [bitmap.width, bitmap.height],
                            videoDurationSec,
                            pixels: points.map(([x, y]: number[]) =>
                                Array.from(
                                    context
                                        .getImageData(x, y, 1, 1)
                                        .data.slice(0, 3),
                                ),
                            ),
                        }
                    } catch (error) {
                        return { ok: false as const, message: String(error) }
                    }
                },
                { playlist: PLAYLIST, thumbnail: THUMBNAIL, points: POINTS },
            )
        }

        test("[entry-visual/AC-9] poster と再生時間（EXTINF 合計）から、再生ボタン入りの visual が作られる", async ({
            page,
        }) => {
            const result = await buildFromPost(page)
            expect(result.ok).toBe(true)
            if (!result.ok) return
            expect(result.size).toEqual([1200, 630])
            // 再生時間（EXTINF 合計）を、entry の heading 用に返す
            expect(result.videoDurationSec).toBeCloseTo(5, 0)
            const [circle, play, left, right, oldBadge] = result.pixels
            near(circle, [69, 68, 97])
            for (const channel of play) {
                expect(channel).toBeGreaterThanOrEqual(245)
            }
            near(left, BACKGROUND)
            near(right, BACKGROUND)
            near(oldBadge, BACKGROUND)
        })

        test("[entry-visual/AC-10] playlist を取得できなければ visual は作られず失敗になる", async ({
            page,
        }) => {
            const result = await buildFromPost(page, { playlist404: true })
            expect(result.ok).toBe(false)
        })
    })
})
