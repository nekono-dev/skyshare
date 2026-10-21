/**
 * ライブテスト共通のヘルパー。
 *
 * 責務と処理概要:
 * - 実アカウントへ投稿する画像の生成（外部ファイルに依存しない最小のPNGエンコーダ）。
 * - 検証用アカウントのentry一覧の取得。
 * - Bluesky公開API（AppView）での投稿の存在確認。
 */
import zlib from "node:zlib"
import type { APIRequestContext, Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"

const PUBLIC_APPVIEW = "https://public.api.bsky.app"

/** CRC32（PNGチャンクのチェックサム用） */
const crc32 = (buf: Buffer): number => {
    let crc = 0xffffffff
    for (const byte of buf) {
        crc ^= byte
        for (let k = 0; k < 8; k++) {
            crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
        }
    }
    return (crc ^ 0xffffffff) >>> 0
}

const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
}

/**
 * 単色のRGB PNG画像を生成する（画素による判定用）。
 *
 * Input: 画素数、色（0〜255のRGB）
 * Output: PNGのバイト列
 */
export const makeSolidPng = (
    width: number,
    height: number,
    [r, g, b]: [number, number, number],
): Buffer => {
    const header = Buffer.alloc(13)
    header.writeUInt32BE(width, 0)
    header.writeUInt32BE(height, 4)
    header[8] = 8
    header[9] = 2
    const stride = width * 3 + 1
    const raw = Buffer.alloc(stride * height)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const o = y * stride + 1 + x * 3
            raw[o] = r
            raw[o + 1] = g
            raw[o + 2] = b
        }
    }
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", header),
        chunk("IDAT", zlib.deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0)),
    ])
}

/**
 * グラデーションのRGB PNG画像を生成する。
 *
 * Input: `width`/`height` 画素数
 * Output: PNGのバイト列
 * Example: `makePng(300, 200)`
 */
export const makePng = (width: number, height: number): Buffer => {
    const header = Buffer.alloc(13)
    header.writeUInt32BE(width, 0)
    header.writeUInt32BE(height, 4)
    header[8] = 8 // ビット深度
    header[9] = 2 // RGB
    const stride = width * 3 + 1
    const raw = Buffer.alloc(stride * height)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const o = y * stride + 1 + x * 3
            raw[o] = x % 256
            raw[o + 1] = y % 256
            raw[o + 2] = 128
        }
    }
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", header),
        chunk("IDAT", zlib.deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0)),
    ])
}

export type EntryListItem = {
    uri: string
    sourceUri: string
    caption?: string
    visualUrl?: string
}

/**
 * 検証用アカウントのentry一覧（`GET /v2/entries/skyshare/`）を返す。
 */
export const listEntries = async (
    request: APIRequestContext,
): Promise<EntryListItem[]> => {
    const res = await request.get("/v2/entries/skyshare/?limit=50")
    if (res.status() !== 200) return []
    return ((await res.json()) as { entries: EntryListItem[] }).entries
}

/**
 * 公開AppViewから投稿の本文を取得する。存在しなければ`null`。
 */
export const getPublicPostText = async (
    atUri: string,
): Promise<string | null> => {
    const res = await fetch(
        `${PUBLIC_APPVIEW}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(atUri)}`,
    )
    if (!res.ok) return null
    const body = (await res.json()) as {
        posts: { record?: { text?: string } }[]
    }
    return body.posts[0]?.record?.text ?? null
}

/**
 * 公開AppViewから投稿レコード（`record`）をそのまま取得する。存在しなければ`null`。
 */
export const getPublicPostRecord = async (
    atUri: string,
): Promise<{
    text?: string
    embed?: { $type?: string; images?: unknown[] }
} | null> => {
    const res = await fetch(
        `${PUBLIC_APPVIEW}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(atUri)}`,
    )
    if (!res.ok) return null
    const body = (await res.json()) as { posts: { record?: never }[] }
    return body.posts[0]?.record ?? null
}

/**
 * 公開AppViewから、`rootUri`を起点とするスレッドの本文を古い順に返す
 * （自己返信の直線チェーンのみ。存在しなければ空配列）。
 */
export const getPublicThreadTexts = async (
    rootUri: string,
): Promise<string[]> => {
    const res = await fetch(
        `${PUBLIC_APPVIEW}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(rootUri)}&depth=10&parentHeight=0`,
    )
    if (!res.ok) return []
    type Node = {
        post?: { record?: { text?: string } }
        replies?: Node[]
    }
    const texts: string[] = []
    let node = ((await res.json()) as { thread: Node }).thread
    while (node?.post) {
        texts.push(node.post.record?.text ?? "")
        node = node.replies?.[0] as Node
    }
    return texts
}

/**
 * `path`を開き、`text`を含む`article`が現れるまで再読み込みを繰り返して、そのカードを返す。
 * 投稿直後はAppViewへの反映が遅れて一覧に出ないことがあるため、1回の待機ではなく再読み込みで待つ。
 */
export const gotoAndFindCard = async (
    page: Page,
    path: string,
    text: string,
    timeoutMs = 150_000,
): Promise<Locator> => {
    const card = page.locator("article").filter({ hasText: text }).first()
    await expect(async () => {
        await page.goto(path)
        await expect(card).toBeVisible({ timeout: 25_000 })
    }).toPass({ timeout: timeoutMs })
    return card
}

/**
 * 画像（entryのvisual等）の画素を調べ、各色に近い画素の割合を返す。
 * ブラウザのcanvasでデコードする（画像のJPEG化・縮小による色のずれを許容する）。
 *
 * Input:
 * - `page`: 任意のページ（デコードに使う。`page.request`等で取得した画像を渡す）
 * - `visualUrl`: 画像のURL
 * - `palette`: 調べる色（0〜255のRGB）の配列
 * - `tolerance`: 色の距離の許容値（RGBのユークリッド距離。既定60）
 * Output: `palette`と同じ順の、各色に近い画素の割合（0〜1）
 */
export const colorFractions = async (
    page: Page,
    visualUrl: string,
    palette: [number, number, number][],
    tolerance = 60,
): Promise<{ fractions: number[]; width: number; height: number }> => {
    const res = await page.request.get(visualUrl)
    if (!res.ok()) throw new Error(`画像を取得できません: ${res.status()}`)
    const base64 = (await res.body()).toString("base64")
    return page.evaluate(
        async ({ base64, palette, tolerance }) => {
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            const bitmap = await createImageBitmap(new Blob([bytes]))
            const canvas = document.createElement("canvas")
            canvas.width = bitmap.width
            canvas.height = bitmap.height
            const ctx = canvas.getContext("2d")!
            ctx.drawImage(bitmap, 0, 0)
            const data = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data
            const counts = palette.map(() => 0)
            for (let i = 0; i < data.length; i += 4) {
                palette.forEach(([r, g, b], k) => {
                    const d = Math.hypot(
                        data[i] - r,
                        data[i + 1] - g,
                        data[i + 2] - b,
                    )
                    if (d <= tolerance) counts[k]++
                })
            }
            const total = canvas.width * canvas.height
            return {
                fractions: counts.map(c => c / total),
                width: canvas.width,
                height: canvas.height,
            }
        },
        { base64, palette, tolerance },
    )
}

/**
 * 公開AppViewの投稿ビュー（`app.bsky.feed.getPosts`の`posts[0]`）のembedを返す。
 * 公式アプリが描画に使う形の確認に使う。画像はimagesのビューでは`images`、galleryのビューでは`items`に入る。
 * 存在しなければ`null`。
 */
export const getPublicPostEmbedView = async (
    atUri: string,
): Promise<{
    $type?: string
    images?: unknown[]
    items?: unknown[]
} | null> => {
    const res = await fetch(
        `${PUBLIC_APPVIEW}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(atUri)}`,
    )
    if (!res.ok) return null
    const body = (await res.json()) as {
        posts: {
            embed?: { $type?: string; images?: unknown[]; items?: unknown[] }
        }[]
    }
    return body.posts[0]?.embed ?? null
}
