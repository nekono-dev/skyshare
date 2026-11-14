/**
 * codex_exec の依頼の検証と起動引数（codex-exec-request.mjs）の単体テスト。
 * 実際のディレクトリと symlink を使い、プロセスは起動しない。
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parse } from "smol-toml"
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
                effort: "medium",
                cwd: repoRoot,
                network: false,
                scratch: false,
                readPaths: null,
                denyRead: [
                    "**/.dev.vars",
                    "**/.dev.vars.*",
                    "**/.env",
                    "**/.env.*",
                ],
            },
        })
    })

    it("accepts effort high for workspace-write", () => {
        const result = validateExecInput({ prompt: "x", effort: "high" }, env())
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value.effort).toBe("high")
    })

    it.each(["low", "xhigh", "", 1, null])(
        "rejects an unknown effort value %j with invalid_effort",
        effort => {
            const result = validateExecInput({ prompt: "x", effort }, env())
            expect(result.ok).toBe(false)
            if (!result.ok) expect(result.error.kind).toBe("invalid_effort")
        },
    )

    it("rejects effort on a read-only run with effort_on_read_only", () => {
        const result = validateExecInput(
            { prompt: "x", sandbox: "read-only", effort: "high" },
            env(),
        )
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.kind).toBe("effort_on_read_only")
    })

    it("accepts read-only sandbox as given", () => {
        const result = validateExecInput(
            { prompt: "look", sandbox: "read-only" },
            env(),
        )
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value.sandbox).toBe("read-only")
    })

    it("rejects read_paths on workspace-write", () => {
        expect(
            validateExecInput({ prompt: "x", read_paths: ["src"] }, env()),
        ).toMatchObject({
            ok: false,
            error: {
                kind: "read_paths_on_workspace_write",
                message: expect.stringContaining("read-only"),
            },
        })
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

    it("accepts network, scratch, read paths, and additional denied globs", () => {
        const result = validateExecInput(
            {
                prompt: "x",
                sandbox: "read-only",
                network: true,
                scratch: true,
                read_paths: ["src/inner"],
                deny_read: ["private/**"],
            },
            env(),
        )
        expect(result).toMatchObject({
            ok: true,
            value: {
                network: true,
                scratch: true,
                readPaths: ["src/inner"],
                denyRead: [
                    "**/.dev.vars",
                    "**/.dev.vars.*",
                    "**/.env",
                    "**/.env.*",
                    "private/**",
                ],
            },
        })
    })

    it.each([1, "yes", null])("rejects non-boolean network %j", network => {
        expect(
            validateExecInput({ prompt: "x", network }, env()),
        ).toMatchObject({
            ok: false,
            error: { kind: "invalid_network" },
        })
    })

    it.each([1, "yes", null])("rejects non-boolean scratch %j", scratch => {
        expect(
            validateExecInput({ prompt: "x", scratch }, env()),
        ).toMatchObject({
            ok: false,
            error: { kind: "invalid_scratch" },
        })
    })

    it.each([
        "src",
        [],
        [""],
        ["../outside"],
        ["/etc/passwd"],
        ["C:\\private"],
        ["\\\\server\\share"],
        ["missing"],
        ["escape-link"],
        ['src/"quoted'],
        ["src/\nline"],
    ])("rejects invalid read_paths %j", read_paths => {
        expect(
            validateExecInput({ prompt: "x", read_paths }, env()),
        ).toMatchObject({
            ok: false,
            error: { kind: "invalid_read_paths" },
        })
    })

    it("rejects too many read paths", () => {
        expect(
            validateExecInput(
                { prompt: "x", read_paths: Array(65).fill("src") },
                env(),
            ),
        ).toMatchObject({ ok: false, error: { kind: "invalid_read_paths" } })
    })

    it.each(["glob", [], [""], ["bad\npattern"]])(
        "rejects invalid deny_read %j",
        deny_read => {
            expect(
                validateExecInput({ prompt: "x", deny_read }, env()),
            ).toMatchObject({
                ok: false,
                error: { kind: "invalid_deny_read" },
            })
        },
    )

    it("rejects too many denied globs", () => {
        expect(
            validateExecInput(
                { prompt: "x", deny_read: Array(65).fill("a/**") },
                env(),
            ),
        ).toMatchObject({ ok: false, error: { kind: "invalid_deny_read" } })
    })

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
                effort: "medium",
                cwd: path.join(repoRoot, "src"),
                network: false,
                scratch: false,
                readPaths: null,
                denyRead: [
                    "**/.dev.vars",
                    "**/.dev.vars.*",
                    "**/.env",
                    "**/.env.*",
                ],
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
    const packageRoot = "/opt/codex/package"
    const fixedRoots = {
        codexPackageRoot: packageRoot,
        homeDir: "/home/tester",
        nodeExecPath: "/opt/node/bin/node",
        realpath: (p: string) => p,
    }

    it("allows system reads by default and denies home credentials", () => {
        const args = buildCodexArgs(
            { prompt: "p", sandbox: "read-only", cwd: "/repo" },
            "/o",
            fixedRoots,
        )
        const config =
            args.find(value =>
                value.startsWith("permissions.claude.filesystem="),
            ) ?? ""
        expect(config).toContain('"/"="read"')
        for (const denied of [
            ".ssh",
            ".aws",
            ".config/gh",
            ".git-credentials",
            ".codex/auth.json",
        ])
            expect(config).toContain(
                `${JSON.stringify(`/home/tester/${denied}`)}="none"`,
            )
    })

    it("limits explicit read paths to the required read roots and protects git", () => {
        const args = buildCodexArgs(
            {
                prompt: "p",
                sandbox: "read-only",
                cwd: "/repo",
                readPaths: ["src"],
                scratch: true,
            },
            "/o",
            { ...fixedRoots, scratchDir: "/tmp/job" },
        )
        const config =
            args.find(value =>
                value.startsWith("permissions.claude.filesystem="),
            ) ?? ""
        for (const expected of [
            '":minimal"="read"',
            '"/opt/codex/package"="read"',
            '"/opt/node"="read"',
            '":project_roots"={"src"="read",".git"="read"',
        ])
            expect(config).toContain(expected)
        expect(config).not.toContain('"/"="read"')
        expect(config).toContain('"/tmp/job"="write"')
    })

    it("keeps repository writes and protects git in workspace-write", () => {
        const args = buildCodexArgs(
            { prompt: "p", sandbox: "workspace-write", cwd: "/repo" },
            "/o",
            fixedRoots,
        )
        const config =
            args.find(value =>
                value.startsWith("permissions.claude.filesystem="),
            ) ?? ""
        expect(config).toContain('":project_roots"={"."="write",".git"="read"')
    })

    it("places the approval flag before exec and stdin marker last", () => {
        const args = buildCodexArgs(
            { prompt: "p", sandbox: "read-only", cwd: "/repo/src" },
            "/tmp/out.txt",
            fixedRoots,
        )
        expect(args.slice(0, 5)).toEqual([
            "--ask-for-approval",
            "never",
            "exec",
            "--model",
            "gpt-6.1-sol",
        ])
        expect(args[args.indexOf("--cd") + 1]).toBe("/repo/src")
        expect(args[args.indexOf("--output-last-message") + 1]).toBe(
            "/tmp/out.txt",
        )
        expect(args.at(-1)).toBe("-")
        expect(args).not.toContain("--sandbox")
        expect(args).toContain('default_permissions="claude"')
        expect(args).toContain("permissions.claude.network.enabled=false")
    })

    it("uses the given sandbox value", () => {
        const args = buildCodexArgs(
            { prompt: "p", sandbox: "workspace-write", cwd: "/r" },
            "/o",
            { codexPackageRoot: packageRoot },
        )
        expect(args.some(arg => arg.includes('"."="write"'))).toBe(true)
        expect(args).not.toContain("--sandbox")
    })

    it("uses Luna with the requested effort for workspace-write", () => {
        const args = buildCodexArgs(
            {
                prompt: "p",
                sandbox: "workspace-write",
                effort: "high",
                cwd: "/r",
            },
            "/o",
            { codexPackageRoot: packageRoot },
        )
        expect(args[args.indexOf("--model") + 1]).toBe("gpt-6-luna")
        expect(args[args.indexOf("-c") + 1]).toBe(
            'model_reasoning_effort="high"',
        )
    })

    it("escapes request paths and globs as TOML strings", () => {
        const injectedPath = 'src/\"=\"none\",\"evil'
        const args = buildCodexArgs(
            {
                prompt: "x",
                sandbox: "read-only",
                cwd: "/repo",
                readPaths: [injectedPath],
                denyRead: ['**/\"=\"write'],
            },
            "/o",
            { codexPackageRoot: packageRoot },
        )
        const configArg =
            args.find(arg =>
                arg.startsWith("permissions.claude.filesystem="),
            ) ?? ""
        const parsed = parse(
            `config=${configArg.slice(configArg.indexOf("=") + 1)}`,
        ).config as {
            ":project_roots": Record<string, string>
        }
        const projectRoots = parsed[":project_roots"]
        expect(projectRoots).toEqual({
            ".git": "read",
            [injectedPath]: "read",
            ['**/\"=\"write']: "none",
        })
        expect(Object.keys(projectRoots).sort()).toEqual(
            [".git", injectedPath, '**/\"=\"write'].sort(),
        )
    })

    it("keeps denied permissions when scratch is enabled", () => {
        const args = buildCodexArgs(
            {
                prompt: "p",
                sandbox: "read-only",
                cwd: "/repo",
                scratch: true,
                denyRead: ["node_modules/.vite-temp"],
            },
            "/o",
            fixedRoots,
        )
        const configArg =
            args.find(arg =>
                arg.startsWith("permissions.claude.filesystem="),
            ) ?? ""
        const parsed = parse(
            `config=${configArg.slice(configArg.indexOf("=") + 1)}`,
        ).config as {
            ":project_roots": Record<string, string>
        }
        expect(parsed[":project_roots"]["node_modules/.vite-temp"]).toBe("none")
    })

    it("preserves special permission keys", () => {
        const args = buildCodexArgs(
            {
                prompt: "p",
                sandbox: "read-only",
                cwd: "/repo",
                readPaths: ["__proto__"],
                denyRead: ["private/**"],
            },
            "/o",
            fixedRoots,
        )
        const configArg =
            args.find(arg =>
                arg.startsWith("permissions.claude.filesystem="),
            ) ?? ""
        const parsed = parse(
            `config=${configArg.slice(configArg.indexOf("=") + 1)}`,
        ).config as {
            ":project_roots": Record<string, string>
        }
        const projectRoots = parsed[":project_roots"]
        expect(Object.hasOwn(projectRoots, "__proto__")).toBe(true)
        expect(projectRoots["__proto__"]).toBe("read")
        expect(projectRoots["private/**"]).toBe("none")
        expect(Object.keys(projectRoots).sort()).toEqual([
            ".git",
            "__proto__",
            "private/**",
        ])
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
