/**
 * Checks that installation scripts record failures and clear the record after success.
 * Runs copied scripts in temporary directories to keep the repository cache untouched.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"

const repoScript = path.resolve(
    __dirname,
    "../../../scripts/agent/install-cc-sdd.sh",
)
const roots: string[] = []

const makeCopy = (fakeNpxBody: string): { root: string; bin: string } => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-sdd-record-"))
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), "cc-sdd-bin-"))
    roots.push(root, bin)
    fs.mkdirSync(path.join(root, "scripts", "agent"), { recursive: true })
    fs.copyFileSync(
        repoScript,
        path.join(root, "scripts", "agent", "install-cc-sdd.sh"),
    )
    fs.writeFileSync(path.join(bin, "npx"), `#!/bin/sh\n${fakeNpxBody}\n`)
    fs.chmodSync(path.join(bin, "npx"), 0o755)
    return { root, bin }
}

const runInstall = (root: string, bin: string) =>
    spawnSync(
        "bash",
        [path.join(root, "scripts", "agent", "install-cc-sdd.sh"), "--claude"],
        {
            env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
            encoding: "utf8",
        },
    )

afterAll(() => {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

describe("cc-sdd installation failure records", () => {
    it("records a failed installation and exits with a nonzero code", () => {
        const { root, bin } = makeCopy("echo 'simulated failure' >&2; exit 7")
        const result = runInstall(root, bin)
        expect(result.status).toBe(7)
        expect(
            fs.existsSync(path.join(root, ".cache", "cc-sdd-install.failed")),
        ).toBe(true)
        expect(result.stderr).toContain("導入に失敗しました")
    })

    it("removes the record after a successful installation", () => {
        const { root, bin } = makeCopy("exit 0")
        const result = runInstall(root, bin)
        expect(result.status).toBe(0)
        expect(
            fs.existsSync(path.join(root, ".cache", "cc-sdd-install.failed")),
        ).toBe(false)
    })

    it("writes the record before installation begins", () => {
        // The fake npx fails only after confirming that the record already exists.
        const { root, bin } = makeCopy(
            `test -f "${path.join("__ROOT__", ".cache", "cc-sdd-install.failed")}" && exit 9 || exit 1`,
        )
        const body = fs
            .readFileSync(path.join(bin, "npx"), "utf8")
            .replace("__ROOT__", root)
        fs.writeFileSync(path.join(bin, "npx"), body)
        const result = runInstall(root, bin)
        expect(result.status).toBe(9)
    })
})
