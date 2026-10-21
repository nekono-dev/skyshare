/**
 * ライブテスト（任意・時間とクォータを消費）: 大容量の動画。
 *
 * 責務と処理概要:
 * - `specs/video/tasks.md`の手動確認項目を自動化する。Blueskyの動画アップロード残量（1日の上限）と
 *   時間を多く消費するため、環境変数`SKYSHARE_E2E_LARGE_VIDEO=1`のときだけ実行する。
 *   - 300MB級（上限300,000,000バイト未満）のmp4を、アップロード・変換・投稿・entry作成まで通せること。
 *     所要時間をテストの注釈（annotation）に記録する。
 * - 対象外: 変換失敗（`processingFailed`）の表示。途中で切れたmp4を実際に投稿してみたが、Blueskyの動画サービスは
 *   変換に成功してしまい（「アップロード完了」になる）、実サービスでは決定的に再現できない。表示の挙動は、
 *   サービスの応答を模したモックの検証（`tests/e2e/videoComposer.spec.ts`・`tests/lib/video/videoUploader.test.ts`）で担保する。
 * - 動画は`ffmpeg`でテスト実行時に生成する（`ffmpeg`が無い環境ではスキップする）。
 * - 作成した投稿は`liveTest`のフィクスチャが終了時に削除する。
 */
import { execFileSync } from "node:child_process"
import {
    mkdtempSync,
    openSync,
    readSync,
    closeSync,
    statSync,
    writeFileSync,
    rmSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"
import { expect, test } from "./liveTest"
import { getPublicPostRecord, listEntries, type EntryListItem } from "./helpers"

const enabled = process.env.SKYSHARE_E2E_LARGE_VIDEO === "1"

const hasFfmpeg = (() => {
    try {
        execFileSync("ffmpeg", ["-version"], { stdio: "ignore" })
        return true
    } catch {
        return false
    }
})()

test.describe.configure({ timeout: 1_500_000 })
test.skip(!enabled, "SKYSHARE_E2E_LARGE_VIDEO=1 のときだけ実行する")
test.skip(!hasFfmpeg, "ffmpegが無い環境ではスキップ")

let dir = ""
let bigMp4 = ""

test.beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "skyshare-video-large-"))
    // 約287MB（上限300,000,000バイト未満）。固定ビットレートで容量を確保する
    bigMp4 = path.join(dir, "big.mp4")
    execFileSync(
        "ffmpeg",
        [
            "-y",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=s=1280x720:r=30",
            "-t",
            "100",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-b:v",
            "23M",
            "-minrate",
            "23M",
            "-maxrate",
            "23M",
            "-bufsize",
            "23M",
            "-x264-params",
            "nal-hrd=cbr",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            bigMp4,
        ],
        { stdio: "ignore", timeout: 300_000 },
    )
    expect(statSync(bigMp4).size).toBeLessThan(300_000_000)
})

test.afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
})

test("287MBのmp4を、アップロード・変換・投稿・entry作成まで通せる", async ({
    page,
    request,
    tag,
}, testInfo) => {
    const text = `${tag} video large`
    await page.goto("/post/")
    const editor = page
        .getByTestId("thread-segment-0")
        .getByTestId("segment-editor")
    await editor.locator("[data-post-body-editor]").click()
    await page.keyboard.type(text)

    const started = Date.now()
    await editor
        .locator('input[type="file"][accept*="video/quicktime"]')
        .first()
        .setInputFiles(bigMp4)
    await expect(
        page.getByTestId("video-preview").getByText("アップロード完了"),
    ).toBeVisible({ timeout: 1_200_000 })
    const seconds = Math.round((Date.now() - started) / 1000)
    testInfo.annotations.push({
        type: "upload-seconds",
        description: `${seconds}`,
    })
    console.log(`287MBのアップロード＋変換: ${seconds}秒`)

    await page.getByRole("button", { name: "投稿", exact: true }).click()
    await expect(page.getByText(/Blueskyへの投稿に成功しました/)).toBeVisible({
        timeout: 60_000,
    })
    await expect(async () => {
        const mine: EntryListItem[] = []
        for (const e of await listEntries(request)) {
            const record = await getPublicPostRecord(e.sourceUri)
            if (record?.text?.includes(tag)) {
                expect(record.embed?.$type).toBe("app.bsky.embed.video")
                mine.push(e)
            }
        }
        expect(mine).toHaveLength(1)
    }).toPass({ timeout: 60_000 })
})
