/**
 * codex_exec の依頼の検証と起動引数（codex-exec-request.mjs）の単体テスト。
 * 実際のディレクトリと symlink を使い、プロセスは起動しない。
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
    buildCodexArgs,
    formatFailure,
    validateExecInput,
} from "../../../scripts/agent/codex-exec-request.mjs"

let root = ""
let repoRoot = ""
let outsideDir = ""

beforeAll(() => {
    root = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), "codex-exec-request-")),
    )
    repoRoot = path.join(root, "repo")
    outsideDir = path.join(root, "repo-other")
    fs.mkdirSync(path.join(repoRoot, "src", "inner"), { recursive: true })
    fs.mkdirSync(outsideDir, { recursive: true })
    fs.symlinkSync(outsideDir, path.join(repoRoot, "escape-link"))
})

afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
})

const env = () => ({ repoRoot, realpath: (p: string) => fs.realpathSync(p) })

describe("validateExecInput", () => {
    it("defaults sandbox to workspace-write and cwd to the repository root", () => {
        const result = validateExecInput({ prompt: "do it" }, env())
        expect(result).toEqual({
            ok: true,
            value: {
                prompt: "do it",
                sandbox: "workspace-write",
                cwd: repoRoot,
            },
        })
    })

    it("accepts read-only sandbox as given", () => {
        const result = validateExecInput(
            { prompt: "look", sandbox: "read-only" },
            env(),
        )
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value.sandbox).toBe("read-only")
    })

    it.each(["danger-full-access", "Read-Only", "", 1, null])(
        "rejects an unknown sandbox value %j with invalid_sandbox",
        sandbox => {
            const result = validateExecInput({ prompt: "x", sandbox }, env())
            expect(result).toMatchObject({
                ok: false,
                error: { kind: "invalid_sandbox" },
            })
        },
    )

    it.each(["", "   \n\t"])(
        "rejects an empty or blank prompt %j with empty_prompt",
        prompt => {
            const result = validateExecInput({ prompt }, env())
            expect(result).toMatchObject({
                ok: false,
                error: { kind: "empty_prompt" },
            })
        },
    )

    it("accepts a cwd that is an existing directory inside the repository", () => {
        const result = validateExecInput(
            { prompt: "x", cwd: path.join(repoRoot, "src") },
            env(),
        )
        expect(result).toEqual({
            ok: true,
            value: {
                prompt: "x",
                sandbox: "workspace-write",
                cwd: path.join(repoRoot, "src"),
            },
        })
    })

    it("accepts the repository root itself as cwd", () => {
        const result = validateExecInput({ prompt: "x", cwd: repoRoot }, env())
        expect(result.ok).toBe(true)
    })

    it("rejects a cwd that does not exist with cwd_not_found", () => {
        const result = validateExecInput(
            { prompt: "x", cwd: path.join(repoRoot, "missing") },
            env(),
        )
        expect(result).toMatchObject({
            ok: false,
            error: { kind: "cwd_not_found" },
        })
    })

    it("rejects a cwd outside the repository with cwd_outside_repo", () => {
        const result = validateExecInput(
            { prompt: "x", cwd: outsideDir },
            env(),
        )
        expect(result).toMatchObject({
            ok: false,
            error: { kind: "cwd_outside_repo" },
        })
    })

    it("rejects a symlink inside the repository that points outside it", () => {
        const result = validateExecInput(
            { prompt: "x", cwd: path.join(repoRoot, "escape-link") },
            env(),
        )
        expect(result).toMatchObject({
            ok: false,
            error: { kind: "cwd_outside_repo" },
        })
    })

    it("rejects a cwd that is the parent of the repository", () => {
        const result = validateExecInput({ prompt: "x", cwd: root }, env())
        expect(result).toMatchObject({
            ok: false,
            error: { kind: "cwd_outside_repo" },
        })
    })

    it("returns a message with every rejection", () => {
        const result = validateExecInput(
            { prompt: "x", cwd: outsideDir },
            env(),
        )
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.message.length).toBeGreaterThan(0)
    })
})

describe("buildCodexArgs", () => {
    it("places the approval flag before exec and stdin marker last", () => {
        const args = buildCodexArgs(
            { prompt: "p", sandbox: "read-only", cwd: "/repo/src" },
            "/tmp/out.txt",
        )
        expect(args).toEqual([
            "--ask-for-approval",
            "never",
            "exec",
            "--sandbox",
            "read-only",
            "--cd",
            "/repo/src",
            "--output-last-message",
            "/tmp/out.txt",
            "-",
        ])
    })

    it("uses the given sandbox value", () => {
        const args = buildCodexArgs(
            { prompt: "p", sandbox: "workspace-write", cwd: "/r" },
            "/o",
        )
        expect(args[args.indexOf("--sandbox") + 1]).toBe("workspace-write")
    })
})

describe("formatFailure", () => {
    it("includes the exit code, the last message, and the stderr tail", () => {
        const text = formatFailure({
            exitCode: 3,
            signal: null,
            lastMessage: "last words",
            stderrTail: "boom on stderr",
        })
        expect(text).toContain("3")
        expect(text).toContain("last words")
        expect(text).toContain("boom on stderr")
    })

    it("includes the signal when the process ended by a signal", () => {
        const text = formatFailure({
            exitCode: null,
            signal: "SIGTERM",
            lastMessage: "",
            stderrTail: "",
        })
        expect(text).toContain("SIGTERM")
    })

    it("keeps only the last 4000 characters of stderr", () => {
        const stderr = "H".repeat(5000) + "END"
        const text = formatFailure({
            exitCode: 1,
            signal: null,
            lastMessage: "",
            stderrTail: stderr,
        })
        expect(text).toContain("H".repeat(3997) + "END")
        expect(text).not.toContain("H".repeat(3998) + "END")
    })
})
