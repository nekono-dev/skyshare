/**
 * リポジトリの信頼の判定（codex-trust-gate.mjs）の単体テストと、フックの入口の試験。
 * 一時ディレクトリと実ファイル（シンボリックリンクを含む）を使い、Codex の設定は読み取りだけを確かめる。
 */
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it, vi } from "vitest"
import {
    codexAvailable,
    decideUserPromptSubmit,
    isRepoTrusted,
    resolveTrustCandidates,
} from "../../../scripts/agent/codex-trust-gate.mjs"

const gatePath = fileURLToPath(
    new URL("../../../scripts/agent/codex-trust-gate.mjs", import.meta.url),
)

const roots: string[] = []
const makeDir = (): string => {
    const dir = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), "codex-trust-test-")),
    )
    roots.push(dir)
    return dir
}

afterAll(() => {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

/** 偽の codex（実行可能なファイル）を置く。 */
const writeFakeCodex = (dir: string): string => {
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, "codex")
    fs.writeFileSync(file, "#!/bin/sh\nexit 0\n")
    fs.chmodSync(file, 0o755)
    return file
}

/** 指定したパスを trusted にした設定の本文。 */
const trustedConfig = (...paths: string[]): string =>
    paths.map(p => `[projects."${p}"]\ntrust_level = "trusted"\n`).join("\n")

describe("isRepoTrusted", () => {
    it("returns true when a candidate has a trusted project table", () => {
        const config = `[projects."/work/a"]\ntrust_level = "trusted"\n`
        expect(isRepoTrusted(config, ["/work/a"])).toBe(true)
    })

    it("returns false without trust_level, with another value, or for another path", () => {
        expect(isRepoTrusted(`[projects."/work/a"]\n`, ["/work/a"])).toBe(false)
        expect(
            isRepoTrusted(`[projects."/work/a"]\ntrust_level = "untrusted"\n`, [
                "/work/a",
            ]),
        ).toBe(false)
        expect(
            isRepoTrusted(`[projects."/work/b"]\ntrust_level = "trusted"\n`, [
                "/work/a",
            ]),
        ).toBe(false)
    })

    it("ignores trust_level in tables that are not project tables", () => {
        const config = `[mcp_servers.codex]\ntrust_level = "trusted"\n`
        expect(isRepoTrusted(config, ["/work/a"])).toBe(false)
    })

    it("handles table order, comments and blank lines", () => {
        const before = [
            "# 利用者の設定",
            "",
            '[projects."/work/b"]',
            "# コメント",
            'trust_level = "untrusted"',
            "",
            "[model]",
            'name = "x"',
            "",
            '[projects."/work/a"]',
            'trust_level = "trusted"',
            "",
        ].join("\n")
        const after = [
            '[projects."/work/a"]',
            'trust_level = "trusted"',
            '[projects."/work/b"]',
            'trust_level = "untrusted"',
        ].join("\n")
        expect(isRepoTrusted(before, ["/work/a"])).toBe(true)
        expect(isRepoTrusted(after, ["/work/a"])).toBe(true)
        expect(isRepoTrusted(after, ["/work/b"])).toBe(false)
    })

    it("accepts dotted and quoted table headers that are not project tables", () => {
        const config = [
            "[hooks.state]",
            '[hooks.state."/x/hooks.json:session_start:0:0"]',
            'trust_level = "trusted"',
            '[projects."/work/a"]',
            'trust_level = "trusted"',
            "",
        ].join("\n")
        expect(isRepoTrusted(config, ["/work/a"])).toBe(true)
        expect(isRepoTrusted(config, ["/x/hooks.json:session_start:0:0"])).toBe(
            false,
        )
    })

    it("throws on a malformed table header", () => {
        expect(() =>
            isRepoTrusted(`[projects."/work/a]\ntrust_level = "trusted"\n`, [
                "/work/a",
            ]),
        ).toThrow()
    })

    it("treats a trusted parent repository as trusting the worktree candidate", () => {
        const config = trustedConfig("/work/main")
        expect(isRepoTrusted(config, ["/work/wt", "/work/main"])).toBe(true)
    })

    it("matches a symlinked worktree through its real path candidate", () => {
        const realDir = makeDir()
        const linkDir = path.join(makeDir(), "link")
        fs.symlinkSync(realDir, linkDir)
        const candidates = resolveTrustCandidates({
            worktreeRoot: linkDir,
            commonDir: null,
            realpath: fs.realpathSync,
        })
        expect(candidates).toContain(realDir)
        expect(isRepoTrusted(trustedConfig(realDir), candidates)).toBe(true)
    })
})

describe("resolveTrustCandidates", () => {
    it("adds the parent of the common dir and removes duplicates", () => {
        const candidates = resolveTrustCandidates({
            worktreeRoot: "/work/wt",
            commonDir: "/work/main/.git",
            realpath: p => p,
        })
        expect(candidates).toEqual(["/work/wt", "/work/main"])
    })

    it("adds the real path of each candidate", () => {
        const candidates = resolveTrustCandidates({
            worktreeRoot: "/work/wt",
            commonDir: "/work/main/.git",
            realpath: p => (p === "/work/wt" ? "/real/wt" : p),
        })
        expect(candidates).toEqual(["/work/wt", "/work/main", "/real/wt"])
    })

    it("uses only the worktree root when the common dir is null", () => {
        const candidates = resolveTrustCandidates({
            worktreeRoot: "/work/a",
            commonDir: null,
            realpath: p => p,
        })
        expect(candidates).toEqual(["/work/a"])
    })

    it("collapses a symlink and its target into one candidate when both point to the same repo", () => {
        const realDir = makeDir()
        const linkDir = path.join(makeDir(), "link")
        fs.symlinkSync(realDir, linkDir)
        const candidates = resolveTrustCandidates({
            worktreeRoot: linkDir,
            commonDir: path.join(realDir, ".git"),
            realpath: fs.realpathSync,
        })
        expect(candidates).toEqual([linkDir, realDir])
    })
})

describe("codexAvailable", () => {
    it("finds an executable codex in a later search path entry, ignoring empty entries", () => {
        const bin = path.join(makeDir(), "bin")
        writeFakeCodex(bin)
        const searchPath = ["", makeDir(), bin].join(path.delimiter)
        expect(codexAvailable(searchPath)).toBe(true)
    })

    it("returns false when codex is not executable", () => {
        const bin = path.join(makeDir(), "bin")
        const file = writeFakeCodex(bin)
        fs.chmodSync(file, 0o644)
        expect(codexAvailable(bin)).toBe(false)
    })

    it("returns false when only a directory named codex exists", () => {
        const bin = path.join(makeDir(), "bin")
        fs.mkdirSync(path.join(bin, "codex"), { recursive: true })
        expect(codexAvailable(bin)).toBe(false)
    })

    it("returns false for an empty search path", () => {
        expect(codexAvailable("")).toBe(false)
    })
})

describe("decideUserPromptSubmit", () => {
    /** 候補の 1 件、偽の codex の場所、ホームを用意する。 */
    const setup = () => {
        const repo = makeDir()
        const bin = path.join(makeDir(), "bin")
        writeFakeCodex(bin)
        return { repo, bin, home: makeDir() }
    }

    it("returns null and does not read config when codex is not on the search path", () => {
        const { repo, home } = setup()
        const readFile = vi.fn(() => null)
        const result = decideUserPromptSubmit({
            candidates: [repo],
            env: {},
            homeDir: home,
            searchPath: makeDir(),
            readFile,
        })
        expect(result).toBeNull()
        expect(readFile).not.toHaveBeenCalled()
    })

    it("blocks an untrusted repo and gives the trust steps and the retry in the reason", () => {
        const { repo, bin, home } = setup()
        const result = decideUserPromptSubmit({
            candidates: [repo],
            env: {},
            homeDir: home,
            searchPath: bin,
            readFile: () =>
                `[projects."/elsewhere"]\ntrust_level = "trusted"\n`,
        })
        expect(result).not.toBeNull()
        expect(result).toMatchObject({
            decision: "block",
            hookSpecificOutput: {
                hookEventName: "UserPromptSubmit",
                suppressOriginalPrompt: true,
            },
        })
        const reason = result?.reason ?? ""
        expect(reason).toContain("Codex")
        expect(reason).toContain(`[projects."${repo}"]`)
        expect(reason).toContain('trust_level = "trusted"')
        expect(reason).toContain("もう一度入力")
    })

    it("returns null when the repo is trusted", () => {
        const { repo, bin, home } = setup()
        const result = decideUserPromptSubmit({
            candidates: [repo],
            env: {},
            homeDir: home,
            searchPath: bin,
            readFile: () => trustedConfig(repo),
        })
        expect(result).toBeNull()
    })

    it("reads config.toml under CODEX_HOME when it is set", () => {
        const { repo, bin, home } = setup()
        const codexHome = makeDir()
        const readFile = vi.fn((p: string) =>
            p === `${codexHome}/config.toml` ? trustedConfig(repo) : null,
        )
        const result = decideUserPromptSubmit({
            candidates: [repo],
            env: { CODEX_HOME: codexHome },
            homeDir: home,
            searchPath: bin,
            readFile,
        })
        expect(result).toBeNull()
        expect(readFile).toHaveBeenCalledWith(`${codexHome}/config.toml`)
    })

    it("reads ~/.codex/config.toml when CODEX_HOME is unset or empty", () => {
        const { repo, bin, home } = setup()
        const readFile = vi.fn((p: string) =>
            p === `${home}/.codex/config.toml` ? trustedConfig(repo) : null,
        )
        expect(
            decideUserPromptSubmit({
                candidates: [repo],
                env: {},
                homeDir: home,
                searchPath: bin,
                readFile,
            }),
        ).toBeNull()
        expect(
            decideUserPromptSubmit({
                candidates: [repo],
                env: { CODEX_HOME: "" },
                homeDir: home,
                searchPath: bin,
                readFile,
            }),
        ).toBeNull()
        expect(readFile).toHaveBeenCalledWith(`${home}/.codex/config.toml`)
    })

    it("blocks when the config file does not exist", () => {
        const { repo, bin, home } = setup()
        const result = decideUserPromptSubmit({
            candidates: [repo],
            env: {},
            homeDir: home,
            searchPath: bin,
            readFile: () => null,
        })
        expect(result?.decision).toBe("block")
    })

    it("returns null and writes the reason to stderr when reading the config throws", () => {
        const { repo, bin, home } = setup()
        const stderr = vi
            .spyOn(process.stderr, "write")
            .mockImplementation(() => true)
        try {
            const result = decideUserPromptSubmit({
                candidates: [repo],
                env: {},
                homeDir: home,
                searchPath: bin,
                readFile: () => {
                    throw new Error("EACCES: permission denied")
                },
            })
            expect(result).toBeNull()
            expect(stderr).toHaveBeenCalledWith(
                expect.stringContaining("EACCES"),
            )
        } finally {
            stderr.mockRestore()
        }
    })

    it("returns null and writes the reason to stderr when the config cannot be parsed", () => {
        const { repo, bin, home } = setup()
        const stderr = vi
            .spyOn(process.stderr, "write")
            .mockImplementation(() => true)
        try {
            const result = decideUserPromptSubmit({
                candidates: [repo],
                env: {},
                homeDir: home,
                searchPath: bin,
                readFile: () =>
                    `[projects."${repo}]\ntrust_level = "trusted"\n`,
            })
            expect(result).toBeNull()
            expect(stderr).toHaveBeenCalled()
        } finally {
            stderr.mockRestore()
        }
    })

    it("never writes to the Codex config", () => {
        const { repo, bin } = setup()
        const codexHome = makeDir()
        const configPath = path.join(codexHome, "config.toml")
        const original = `[projects."/elsewhere"]\ntrust_level = "untrusted"\n`
        fs.writeFileSync(configPath, original)
        const listingBefore = fs.readdirSync(codexHome).sort()

        decideUserPromptSubmit({
            candidates: [repo],
            env: { CODEX_HOME: codexHome },
            homeDir: makeDir(),
            searchPath: bin,
            readFile: p => fs.readFileSync(p, "utf8"),
        })

        expect(fs.readFileSync(configPath, "utf8")).toBe(original)
        expect(fs.readdirSync(codexHome).sort()).toEqual(listingBefore)
    })
})

describe("hook entry (process)", () => {
    const hookInput = JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        prompt: "hello",
    })

    // 偽の codex を置いた場所（PATH の先頭に足す）
    const fakeBin = path.join(makeDir(), "bin")
    writeFakeCodex(fakeBin)

    /** フックを 1 回実行する。searchPath を省くと、偽の codex が使える PATH になる。 */
    const runHook = (
        cwd: string,
        codexHome: string,
        input: string,
        searchPath?: string,
    ) =>
        spawnSync(process.execPath, [gatePath, "user-prompt-submit"], {
            cwd,
            input,
            encoding: "utf8",
            env: {
                ...process.env,
                CODEX_HOME: codexHome,
                PATH:
                    searchPath ??
                    `${fakeBin}${path.delimiter}${process.env.PATH}`,
            },
        })

    const makeGitRepo = (): string => {
        const repo = makeDir()
        execFileSync("git", ["init", "-q", repo])
        return repo
    }

    it("prints a block decision for an untrusted repo", () => {
        const repo = makeGitRepo()
        const codexHome = makeDir()

        const result = runHook(repo, codexHome, hookInput)

        expect(result.status).toBe(0)
        const output = JSON.parse(result.stdout)
        expect(output).toMatchObject({
            decision: "block",
            hookSpecificOutput: {
                hookEventName: "UserPromptSubmit",
                suppressOriginalPrompt: true,
            },
        })
        expect(output.reason).toContain(`[projects."${repo}"]`)
    })

    it("prints nothing for a trusted repo", () => {
        const repo = makeGitRepo()
        const codexHome = makeDir()
        fs.writeFileSync(
            path.join(codexHome, "config.toml"),
            trustedConfig(repo),
        )

        const result = runHook(repo, codexHome, hookInput)

        expect(result.status).toBe(0)
        expect(result.stdout).toBe("")
    })

    it("prints nothing and passes through when codex is not on the search path", () => {
        const repo = makeGitRepo()
        const emptyBin = makeDir()

        const result = runHook(repo, makeDir(), hookInput, emptyBin)

        expect(result.status).toBe(0)
        expect(result.stdout).toBe("")
    })

    it("exits 0 with the reason on stderr when stdin is not JSON", () => {
        const repo = makeGitRepo()

        const result = runHook(repo, makeDir(), "not json")

        expect(result.status).toBe(0)
        expect(result.stdout).toBe("")
        expect(result.stderr).not.toBe("")
    })
})
