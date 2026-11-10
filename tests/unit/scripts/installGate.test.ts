/**
 * 導入の失敗の記録で止める判断（install-gate.mjs）の単体テスト。
 * 記録が無ければ何もしない。記録があれば、プロンプトを止め、再試行の方法を示す。
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

describe("導入の失敗の記録", () => {
    it("記録が無ければ、判定は null（何もしない）", () => {
        const root = makeRoot()
        expect(pendingInstallFailures(root)).toEqual([])
        expect(decideUserPromptSubmit(root)).toBeNull()
    })

    it("cc-sdd の記録があれば、プロンプトを止め、再試行の方法を示す", () => {
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

    it("BRW の記録も、同じく止める", () => {
        const root = makeRoot()
        fs.mkdirSync(path.join(root, ".cache"))
        fs.writeFileSync(
            path.join(root, ".cache", "brw-plugin-install.failed"),
            "x",
        )
        const output = decideUserPromptSubmit(root)
        expect(output?.reason).toContain("ensure-brw-plugin.mjs")
    })

    it("記録を消せば、止めなくなる", () => {
        const root = makeRoot()
        fs.mkdirSync(path.join(root, ".cache"))
        const file = path.join(root, ".cache", "cc-sdd-install.failed")
        fs.writeFileSync(file, "x")
        fs.rmSync(file)
        expect(decideUserPromptSubmit(root)).toBeNull()
    })
})
