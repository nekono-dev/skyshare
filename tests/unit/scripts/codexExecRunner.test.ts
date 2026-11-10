/**
 * codex の子プロセスを 1 回実行する部品（codex-exec-runner.mjs）の試験。
 * 偽の codex は実在する実行ファイルで、引数と標準入力を一時ディレクトリに記録する。
 * 振る舞いは一時ディレクトリの control.json で決める。Codex 本体と通信はしない。
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { runCodex } from "../../../scripts/agent/codex-exec-runner.mjs"

const PLACEHOLDER = "__OUTPUT_FILE__"
const PROMPT = "秘密ではない依頼文: テスト用の本文\n2 行目"

type Control = {
    exitCode?: number
    lastMessage?: string
    stderr?: string
    sleepMs?: number
    ignoreTerm?: boolean
    grandchild?: boolean
    exitAfterGrandchild?: boolean
}

/** 偽の codex のスクリプト。引数・標準入力・出力先の一覧を一時ディレクトリに記録する。 */
const FAKE_CODEX_SOURCE = `#!${process.execPath}
const fs = require("node:fs")
const path = require("node:path")
const dir = __dirname
const control = JSON.parse(fs.readFileSync(path.join(dir, "control.json"), "utf8"))
const args = process.argv.slice(2)
const outIndex = args.indexOf("--output-last-message")
const outputFile = outIndex >= 0 ? args[outIndex + 1] : null
fs.writeFileSync(path.join(dir, "argv.json"), JSON.stringify(args))
fs.writeFileSync(path.join(dir, "pid"), String(process.pid))
if (control.ignoreTerm) process.on("SIGTERM", () => {})
const chunks = []
process.stdin.on("data", (chunk) => chunks.push(chunk))
process.stdin.on("end", () => {
    fs.writeFileSync(path.join(dir, "stdin.txt"), Buffer.concat(chunks))
    if (outputFile !== null) {
        const outDir = path.dirname(outputFile)
        const listing = {}
        for (const name of fs.readdirSync(outDir)) {
            listing[name] = fs.readFileSync(path.join(outDir, name), "utf8")
        }
        fs.writeFileSync(path.join(dir, "listing.json"), JSON.stringify(listing))
    }
    if (control.stderr) process.stderr.write(control.stderr)
    if (outputFile !== null && control.lastMessage !== undefined) {
        fs.writeFileSync(outputFile, control.lastMessage)
    }
    if (control.grandchild) {
        // 孫の sleep は標準エラーを継承し、自分の pid を記録する
        const grandchild = require("node:child_process").spawn("sleep", ["30"], {
            stdio: ["ignore", "ignore", "inherit"],
        })
        fs.writeFileSync(path.join(dir, "grandchild.pid"), String(grandchild.pid))
        if (control.exitAfterGrandchild) process.exit(control.exitCode ?? 0)
        // 直接の子はそのまま待つ（試験が終わらないときの後始末として 30 秒で終わる）
        setTimeout(() => process.exit(0), 30000)
        return
    }
    if (control.sleepMs !== undefined) {
        setTimeout(() => process.exit(control.exitCode ?? 0), control.sleepMs)
        return
    }
    process.exit(control.exitCode ?? 0)
})
`

let fakeDir = ""
let fakeCodexPath = ""

/** 現在の os.tmpdir() にある runner 用の一時ディレクトリの名前一覧。 */
const listRunnerTempDirs = () =>
    fs
        .readdirSync(os.tmpdir())
        .filter(name => name.startsWith("codex-exec-"))
        .sort()

/** 偽の codex の振る舞いを control.json に書く。 */
const setControl = (control: Control) => {
    fs.writeFileSync(
        path.join(fakeDir, "control.json"),
        JSON.stringify(control),
    )
}

/** 偽の codex が記録した引数を読む。 */
const readArgv = (): string[] =>
    JSON.parse(fs.readFileSync(path.join(fakeDir, "argv.json"), "utf8"))

/** 偽の codex が記録した出力先の一覧（ファイル名 → 内容）を読む。 */
const readListing = (): Record<string, string> =>
    JSON.parse(fs.readFileSync(path.join(fakeDir, "listing.json"), "utf8"))

/** 偽の codex が記録した出力先のパスを引数から取り出す。 */
const outputPathOf = (argv: string[]): string =>
    argv[argv.indexOf("--output-last-message") + 1]

/** プロセスが生きているかを判定する。 */
const isAlive = (pid: number): boolean => {
    try {
        process.kill(pid, 0)
        return true
    } catch {
        return false
    }
}

/** 偽の codex が記録した孫プロセスの pid を読む。 */
const readGrandchildPid = (): number =>
    Number(fs.readFileSync(path.join(fakeDir, "grandchild.pid"), "utf8"))

/** プロセスが消えるまで短く待つ（上限を超えたら、そのまま返す）。 */
const waitUntilDead = async (pid: number, limitMs: number): Promise<void> => {
    const deadline = Date.now() + limitMs
    while (isAlive(pid) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 20))
    }
}

/** 偽の codex に渡す引数（runner は値を置き換えるだけで、組み立て直さない）。 */
const makeArgs = (cwd: string) => [
    "--ask-for-approval",
    "never",
    "exec",
    "--sandbox",
    "read-only",
    "--cd",
    cwd,
    "--output-last-message",
    PLACEHOLDER,
    "-",
]

// 試験ごとに専用の一時ディレクトリを TMPDIR に設定し、同じファイルの他の試験や並列の試験の影響を受けないようにする
let savedTmpdir: string | undefined
let isolatedTmpdir = ""

beforeEach(() => {
    savedTmpdir = process.env.TMPDIR
    isolatedTmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-runner-tmp-"))
    process.env.TMPDIR = isolatedTmpdir
    fakeDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-runner-test-"))
    fakeCodexPath = path.join(fakeDir, "codex")
    fs.writeFileSync(fakeCodexPath, FAKE_CODEX_SOURCE)
    fs.chmodSync(fakeCodexPath, 0o755)
})

afterEach(() => {
    if (savedTmpdir === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = savedTmpdir
    fs.rmSync(fakeDir, { recursive: true, force: true })
    fs.rmSync(isolatedTmpdir, { recursive: true, force: true })
})

describe("runCodex", () => {
    it("returns completed with the last message read from the output file", async () => {
        setControl({ exitCode: 0, lastMessage: "最後の回答\n" })
        const before = listRunnerTempDirs()

        const result = await runCodex(makeArgs(fakeDir), {
            command: fakeCodexPath,
            cwd: fakeDir,
            prompt: PROMPT,
            timeoutMs: 10000,
            killGraceMs: 5000,
        })

        expect(result).toEqual({
            kind: "completed",
            lastMessage: "最後の回答\n",
        })
        expect(listRunnerTempDirs()).toEqual(before)
    })

    it("delivers the prompt through stdin and passes the args in the given order", async () => {
        setControl({ exitCode: 0, lastMessage: "ok" })
        const cwd = fakeDir

        await runCodex(makeArgs(cwd), {
            command: fakeCodexPath,
            cwd,
            prompt: PROMPT,
            timeoutMs: 10000,
            killGraceMs: 5000,
        })

        const argv = readArgv()
        expect(fs.readFileSync(path.join(fakeDir, "stdin.txt"), "utf8")).toBe(
            PROMPT,
        )
        expect(argv.slice(0, 8)).toEqual([
            "--ask-for-approval",
            "never",
            "exec",
            "--sandbox",
            "read-only",
            "--cd",
            cwd,
            "--output-last-message",
        ])
        expect(argv[argv.length - 1]).toBe("-")
        expect(argv).not.toContain(PLACEHOLDER)
        expect(argv.join("\n")).not.toContain(PROMPT)
    })

    it("replaces the placeholder with a file inside a dedicated temp directory", async () => {
        setControl({ exitCode: 0, lastMessage: "ok" })

        await runCodex(makeArgs(fakeDir), {
            command: fakeCodexPath,
            cwd: fakeDir,
            prompt: PROMPT,
            timeoutMs: 10000,
            killGraceMs: 5000,
        })

        const outputFile = outputPathOf(readArgv())
        const outputDir = path.dirname(outputFile)
        expect(path.dirname(outputDir)).toBe(os.tmpdir())
        expect(path.basename(outputDir).startsWith("codex-exec-")).toBe(true)
        // 出力先は実行の後に削除されている
        expect(fs.existsSync(outputDir)).toBe(false)
    })

    it("never writes the prompt into any file in the output directory", async () => {
        setControl({ exitCode: 0, lastMessage: "ok" })

        await runCodex(makeArgs(fakeDir), {
            command: fakeCodexPath,
            cwd: fakeDir,
            prompt: PROMPT,
            timeoutMs: 10000,
            killGraceMs: 5000,
        })

        // 偽の codex は、子の実行中に出力先のディレクトリの中身を記録する
        const listing = readListing()
        expect(Object.keys(listing)).toHaveLength(0)
        for (const content of Object.values(listing)) {
            expect(content).not.toContain(PROMPT)
        }
    })

    it("returns failed with exit code, stderr tail and last message on non-zero exit", async () => {
        setControl({
            exitCode: 3,
            lastMessage: "途中の回答",
            stderr: "boom: 失敗した理由\n",
        })
        const before = listRunnerTempDirs()

        const result = await runCodex(makeArgs(fakeDir), {
            command: fakeCodexPath,
            cwd: fakeDir,
            prompt: PROMPT,
            timeoutMs: 10000,
            killGraceMs: 5000,
        })

        expect(result).toEqual({
            kind: "failed",
            exitCode: 3,
            signal: null,
            lastMessage: "途中の回答",
            stderrTail: "boom: 失敗した理由\n",
        })
        expect(listRunnerTempDirs()).toEqual(before)
    })

    it("returns an empty last message when the output file was not written", async () => {
        setControl({ exitCode: 1, stderr: "no output\n" })

        const result = await runCodex(makeArgs(fakeDir), {
            command: fakeCodexPath,
            cwd: fakeDir,
            prompt: PROMPT,
            timeoutMs: 10000,
            killGraceMs: 5000,
        })

        expect(result).toMatchObject({
            kind: "failed",
            exitCode: 1,
            lastMessage: "",
        })
    })

    it("keeps only the last 4000 characters of stderr", async () => {
        const longStderr = `${"x".repeat(5000)}END`
        setControl({ exitCode: 2, stderr: longStderr })

        const result = await runCodex(makeArgs(fakeDir), {
            command: fakeCodexPath,
            cwd: fakeDir,
            prompt: PROMPT,
            timeoutMs: 10000,
            killGraceMs: 5000,
        })

        expect(result.kind).toBe("failed")
        if (result.kind !== "failed") return
        expect(result.stderrTail).toHaveLength(4000)
        expect(result.stderrTail.endsWith("END")).toBe(true)
    })

    it("returns timeout and leaves no child process after a short timeoutMs", async () => {
        setControl({ sleepMs: 60000, stderr: "作業を開始\n" })

        const result = await runCodex(makeArgs(fakeDir), {
            command: fakeCodexPath,
            cwd: fakeDir,
            prompt: PROMPT,
            // 負荷の高い並列実行でも偽の codex が pid を書けるよう、少し余裕を持たせる
            timeoutMs: 1000,
            killGraceMs: 200,
        })

        expect(result).toMatchObject({
            kind: "timeout",
            stderrTail: "作業を開始\n",
        })
        const pid = Number(fs.readFileSync(path.join(fakeDir, "pid"), "utf8"))
        expect(isAlive(pid)).toBe(false)
        // 他の試験が同じ一時ディレクトリを使うため、この実行の出力先だけを確かめる
        const outputDir = path.dirname(outputPathOf(readArgv()))
        expect(fs.existsSync(outputDir)).toBe(false)
    }, 10000)

    it("sends SIGKILL when the child ignores SIGTERM beyond killGraceMs", async () => {
        setControl({ sleepMs: 60000, ignoreTerm: true })

        const result = await runCodex(makeArgs(fakeDir), {
            command: fakeCodexPath,
            cwd: fakeDir,
            prompt: PROMPT,
            timeoutMs: 300,
            killGraceMs: 200,
        })

        expect(result.kind).toBe("timeout")
        const pid = Number(fs.readFileSync(path.join(fakeDir, "pid"), "utf8"))
        expect(isAlive(pid)).toBe(false)
    }, 10000)

    it("returns timeout within a bounded time and kills a grandchild that holds stderr", async () => {
        setControl({ grandchild: true, stderr: "作業を開始\n" })
        const startedAt = Date.now()

        const result = await runCodex(makeArgs(fakeDir), {
            command: fakeCodexPath,
            cwd: fakeDir,
            prompt: PROMPT,
            // 孫の pid を書く前に打ち切られないよう、少し余裕を持たせる
            timeoutMs: 1000,
            killGraceMs: 200,
        })

        expect(Date.now() - startedAt).toBeLessThan(5000)
        expect(result).toMatchObject({ kind: "timeout" })
        const grandchildPid = readGrandchildPid()
        await waitUntilDead(grandchildPid, 1000)
        expect(isAlive(grandchildPid)).toBe(false)
    }, 10000)

    it("returns completed within a bounded time when a grandchild keeps stderr open after exit", async () => {
        setControl({
            grandchild: true,
            exitAfterGrandchild: true,
            exitCode: 0,
            lastMessage: "完了\n",
        })
        const startedAt = Date.now()

        const result = await runCodex(makeArgs(fakeDir), {
            command: fakeCodexPath,
            cwd: fakeDir,
            prompt: PROMPT,
            timeoutMs: 10000,
            killGraceMs: 200,
        })

        expect(Date.now() - startedAt).toBeLessThan(5000)
        expect(result).toEqual({ kind: "completed", lastMessage: "完了\n" })
        const grandchildPid = readGrandchildPid()
        await waitUntilDead(grandchildPid, 1000)
        expect(isAlive(grandchildPid)).toBe(false)
    }, 10000)

    it("returns spawn_error when the executable does not exist", async () => {
        const before = listRunnerTempDirs()

        const result = await runCodex(makeArgs(fakeDir), {
            command: path.join(fakeDir, "no-such-codex"),
            cwd: fakeDir,
            prompt: PROMPT,
            timeoutMs: 10000,
            killGraceMs: 5000,
        })

        expect(result.kind).toBe("spawn_error")
        if (result.kind !== "spawn_error") return
        expect(result.message).toEqual(expect.any(String))
        expect(result.message.length).toBeGreaterThan(0)
        expect(listRunnerTempDirs()).toEqual(before)
    })
})
