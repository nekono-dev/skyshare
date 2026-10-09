/**
 * 動画の添付制限（長さ・コーデック）の、実ファイルによる動作確認。
 *
 * 責務と処理概要:
 * - `specs/video/tasks.md`の手動確認項目のうち、通信を伴わず検証できるものを自動化する。
 *   - 10分を超える動画は、添付されず、理由（`tooLong`）が表示され、アップロードも始まらない。
 *   - iPhoneで撮影したようなHEVC（H.265）のmovは、デコードできないブラウザ（Chromium系）
 *     では`unreadable`として添付されない（Firefoxは、LinuxなどOSのデコーダがあれば再生できるため対象外）。
 *     デコードできる環境（Safari）での添付・投稿は実機確認が必要。
 * - 実ファイルは`ffmpeg`でテスト実行時に生成する（`ffmpeg`が無い環境ではスキップする）。
 *   長尺は解像度・フレームレートを最小にして、ファイルサイズを小さく保つ。
 * - 動画サービス（`video.bsky.app`）・トークン発行APIは`page.route`でブロックし、呼ばれたら失敗にする。
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { expect, test } from "./fixtures"

const hasFfmpeg = (() => {
    try {
        execFileSync("ffmpeg", ["-version"], { stdio: "ignore" })
        return true
    } catch {
        return false
    }
})()

let dir = ""
let longMp4 = ""
let hevcMov = ""

/** `ffmpeg`で単色の動画を生成する（`args`に出力の符号化設定を渡す） */
const generate = (output: string, seconds: number, args: string[]) =>
    execFileSync(
        "ffmpeg",
        [
            "-y",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=128x72:r=1",
            "-t",
            String(seconds),
            ...args,
            output,
        ],
        { stdio: "ignore", timeout: 120_000 },
    )

test.describe("動画の添付制限（実ファイル）", () => {
    test.skip(!hasFfmpeg, "ffmpegが無い環境ではスキップ")

    test.beforeAll(() => {
        dir = mkdtempSync(path.join(os.tmpdir(), "skyshare-video-"))
        // 10分1秒（上限600秒を超える）
        longMp4 = path.join(dir, "long.mp4")
        generate(longMp4, 601, [
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-g",
            "30",
        ])
        // HEVC（iPhoneの既定の撮影形式に相当）
        hevcMov = path.join(dir, "hevc.mov")
        generate(hevcMov, 2, [
            "-c:v",
            "libx265",
            "-pix_fmt",
            "yuv420p",
            "-tag:v",
            "hvc1",
        ])
    })

    test.afterAll(() => {
        if (dir) rmSync(dir, { recursive: true, force: true })
    })

    /** 動画サービス・トークン発行APIへの通信が起きたら記録する */
    const blockVideoApis = async (page: import("@playwright/test").Page) => {
        const calls: string[] = []
        const handler = (route: import("@playwright/test").Route) => {
            calls.push(route.request().url())
            return route.abort()
        }
        await page.route("**/v2/bsky/video/upload-token/", handler)
        await page.route("https://video.bsky.app/**", handler)
        return calls
    }

    const attach = async (
        page: import("@playwright/test").Page,
        file: string,
    ) => {
        await page.goto("/post/?guest", { timeout: 60_000 })
        const editor = page
            .getByTestId("thread-segment-0")
            .getByTestId("segment-editor")
        await expect(editor).toBeVisible({ timeout: 60_000 })
        await editor
            .locator('input[type="file"][accept*="video/quicktime"]')
            .first()
            .setInputFiles(file)
    }

    test("10分を超える動画は添付されず、tooLongが表示され、アップロードも始まらない", async ({
        page,
    }) => {
        const calls = await blockVideoApis(page)
        await attach(page, longMp4)
        await expect(page.getByRole("alert")).toContainText(
            "動画の長さは10分以下にしてください",
        )
        await expect(page.getByTestId("video-preview")).toHaveCount(0)
        expect(calls).toEqual([])
    })

    test("HEVCのmovは、デコードできないブラウザでは添付されずunreadableが表示される", async ({
        page,
        browserName,
    }) => {
        // FirefoxのHEVC対応はOSのデコーダに依存する（Linuxでは再生できるため添付される）。
        // Safari系も同様にデコードできる環境があるため、Chromium系でのみ確認する。
        test.skip(
            browserName !== "chromium",
            "HEVCのデコード可否はブラウザ・OSに依存するため、Chromium系でのみ確認する",
        )
        const calls = await blockVideoApis(page)
        await attach(page, hevcMov)
        await expect(page.getByRole("alert")).toContainText(
            "動画を読み込めませんでした",
        )
        await expect(page.getByTestId("video-preview")).toHaveCount(0)
        expect(calls).toEqual([])
    })
})
