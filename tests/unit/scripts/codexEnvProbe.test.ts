/**
 * 環境の確認（codex-env.mjs）の単体テスト。
 * 一時ディレクトリに本物の git リポジトリと偽の codex を作って確かめる。本物の codex は起動しない。
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { probeEnvironment } from "../../../scripts/agent/codex-env.mjs"

/** PATH から本物の git の場所を探す。見つからなければ失敗させる。 */
const findRealGit = (): string => {
    const found = execFileSync("sh", ["-c", "command -v git"], {
        encoding: "utf8",
    }).trim()
    if (!found) throw new Error("テストには git が必要です")
    return fs.realpathSync(found)
}

let tmpRoot: string
let binDir: string
let gitDir: string
let repoDir: string
let outsideDir: string

beforeEach(() => {
    // 一時ディレクトリの実体（symlink を解いた形）を基準にする
    tmpRoot = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), "codex-env-probe-")),
    )

    // 偽の codex だけを置くディレクトリ
    binDir = path.join(tmpRoot, "bin")
    fs.mkdirSync(binDir)
    const fakeCodex = path.join(binDir, "codex")
    fs.writeFileSync(fakeCodex, "#!/bin/sh\nexit 0\n")
    fs.chmodSync(fakeCodex, 0o755)

    // 本物の git の置き場所。git だけをシンボリックリンクで見せる
    gitDir = path.join(tmpRoot, "git-only")
    fs.mkdirSync(gitDir)
    fs.symlinkSync(findRealGit(), path.join(gitDir, "git"))

    // git init 済みの一時リポジトリ（外側のリポジトリに依存しない）
    repoDir = path.join(tmpRoot, "repo")
    fs.mkdirSync(repoDir)
    execFileSync("git", ["init", "-q"], { cwd: repoDir })

    // どの git リポジトリにも属さない一時ディレクトリ
    outsideDir = path.join(tmpRoot, "outside")
    fs.mkdirSync(outsideDir)
})

afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
})

describe("probeEnvironment", () => {
    it("reports available with the repository root when codex and git are present", async () => {
        const searchPath = [binDir, gitDir].join(path.delimiter)

        const result = await probeEnvironment({
            searchPath,
            startDir: repoDir,
        })

        expect(result).toEqual({
            available: true,
            repoRoot: fs.realpathSync(repoDir),
        })
    })

    it("reports codex as missing when codex is not on the search path", async () => {
        const result = await probeEnvironment({
            searchPath: gitDir,
            startDir: repoDir,
        })

        expect(result.available).toBe(false)
        expect(result).toHaveProperty("missing")
        expect((result as { missing: string[] }).missing).toContain("codex")
    })

    it("reports git as missing when git is not on the search path", async () => {
        const result = await probeEnvironment({
            searchPath: binDir,
            startDir: repoDir,
        })

        expect(result.available).toBe(false)
        expect((result as { missing: string[] }).missing).toContain("git")
    })

    it("reports git as missing when startDir is outside any git repository", async () => {
        const searchPath = [binDir, gitDir].join(path.delimiter)

        const result = await probeEnvironment({
            searchPath,
            startDir: outsideDir,
        })

        expect(result.available).toBe(false)
        expect((result as { missing: string[] }).missing).toContain("git")
    })

    it("does not count a non-executable file named codex as available", async () => {
        const plainDir = path.join(tmpRoot, "plain")
        fs.mkdirSync(plainDir)
        fs.writeFileSync(path.join(plainDir, "codex"), "not executable\n")
        fs.chmodSync(path.join(plainDir, "codex"), 0o644)
        const searchPath = [plainDir, gitDir].join(path.delimiter)

        const result = await probeEnvironment({
            searchPath,
            startDir: repoDir,
        })

        expect(result.available).toBe(false)
        expect((result as { missing: string[] }).missing).toContain("codex")
    })
})
