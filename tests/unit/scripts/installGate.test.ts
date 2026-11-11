/**
 * Checks whether installation failure records block prompts and explain how to retry.
 * No record means the gate leaves the prompt unchanged.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import {
    decideUserPromptSubmit,
    pendingInstallFailures,
} from "../../../scripts/agent/install-gate.mjs"

const roots: string[] = []
const makeRoot = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "install-gate-test-"))
    roots.push(root)
    return root
}

afterAll(() => {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

describe("Installation failure records", () => {
    it("does nothing when no failure record exists", () => {
        const root = makeRoot()
        expect(pendingInstallFailures(root)).toEqual([])
        expect(decideUserPromptSubmit(root)).toBeNull()
    })

    it("blocks the prompt and explains how to retry after a cc-sdd failure", () => {
        const root = makeRoot()
        fs.mkdirSync(path.join(root, ".cache"))
        fs.writeFileSync(
            path.join(root, ".cache", "cc-sdd-install.failed"),
            "x",
        )
        const output = decideUserPromptSubmit(root)
        expect(output?.decision).toBe("block")
        expect(output?.reason).toContain("install-cc-sdd.sh --claude")
        expect(output?.hookSpecificOutput.suppressOriginalPrompt).toBe(true)
    })

    it("also blocks the prompt after a BRW failure", () => {
        const root = makeRoot()
        fs.mkdirSync(path.join(root, ".cache"))
        fs.writeFileSync(
            path.join(root, ".cache", "brw-plugin-install.failed"),
            "x",
        )
        const output = decideUserPromptSubmit(root)
        expect(output?.reason).toContain("ensure-brw-plugin.mjs")
    })

    it("stops blocking after the failure record is removed", () => {
        const root = makeRoot()
        fs.mkdirSync(path.join(root, ".cache"))
        const file = path.join(root, ".cache", "cc-sdd-install.failed")
        fs.writeFileSync(file, "x")
        fs.rmSync(file)
        expect(decideUserPromptSubmit(root)).toBeNull()
    })
})
