/**
 * Checks import allowlist entries that must be absent when the repository is complete.
 * Uses a temporary invalid entry to verify that forbidden rules are detected.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import {
    loadAllowlist,
    type AllowlistEntry,
} from "../../../scripts/architecture/allowlist"

const repoRoot = path.resolve(__dirname, "../../..")
const realAllowlistPath = path.join(
    repoRoot,
    "config/architecture/import-allowlist.json",
)

const ownerExists = (owner: string) =>
    fs.existsSync(path.join(repoRoot, ".kiro/specs", owner))

/** Import rules that must not remain in the completed allowlist. */
const FORBIDDEN_AT_COMPLETION = [
    "libLayer",
    "utilShared",
    "typesLeaf",
    "typesOnly",
] as const

/** Selects forbidden entries for both repository checks and the negative case. */
const forbiddenEntriesOf = (entries: AllowlistEntry[]): AllowlistEntry[] =>
    entries.filter(entry =>
        (FORBIDDEN_AT_COMPLETION as readonly string[]).includes(entry.ruleId),
    )

const tmpDirs: string[] = []

afterAll(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true })
})

describe("Completed import allowlist", () => {
    it("loads the repository allowlist without errors", () => {
        const loaded = loadAllowlist(realAllowlistPath, ownerExists)
        expect(loaded.errors).toEqual([])
    })

    it("contains no libLayer, utilShared, typesLeaf, or typesOnly entries", () => {
        const loaded = loadAllowlist(realAllowlistPath, ownerExists)
        expect(forbiddenEntriesOf(loaded.entries)).toEqual([])
    })

    it("detects a utilShared entry in a temporary allowlist", () => {
        const dir = fs.mkdtempSync(
            path.join(os.tmpdir(), "allowlist-completion-"),
        )
        tmpDirs.push(dir)
        const file = path.join(dir, "import-allowlist.json")
        fs.writeFileSync(
            file,
            JSON.stringify({
                version: 1,
                entries: [
                    {
                        ruleId: "utilShared",
                        from: "src/util/x.ts",
                        specifier: "",
                        owner: "structure-checks",
                        reason: "負例",
                    },
                ],
            }),
        )
        const loaded = loadAllowlist(file, ownerExists)
        expect(loaded.errors).toEqual([])
        const found = forbiddenEntriesOf(loaded.entries)
        expect(found).toHaveLength(1)
        expect(found[0].ruleId).toBe("utilShared")
    })
})
