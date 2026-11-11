/**
 * Tests the import graph, architecture rules, allowlist, and command-line check.
 * Fixtures keep expected behavior stable across representative project layouts.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { scanModules } from "../../../scripts/architecture/import-graph"
import { regionOf } from "../../../scripts/architecture/regions"
import {
    evaluateImportRules,
    RULE_BASIS,
    RULE_IDS,
} from "../../../scripts/architecture/rules"
import { findCycleViolations } from "../../../scripts/architecture/cycles"
import {
    checkAllowlist,
    emitAllowlist,
    loadAllowlist,
} from "../../../scripts/architecture/allowlist"
import { runImportCheck } from "../../../scripts/architecture/check-imports"

const scanRoot = path.resolve(__dirname, "../../fixtures/import-rules/scan")

describe("Module scanning", () => {
    const graph = scanModules(scanRoot)
    const targetsOf = (from: string) =>
        graph.edges
            .filter(e => e.from === from)
            .map(e => ({
                spec: e.specifier,
                typeOnly: e.typeOnly,
                target: e.target,
            }))

    it("excludes generated files and declaration files", () => {
        expect(graph.modules).not.toContain("src/client/openapi/client.ts")
        expect(graph.modules).not.toContain("src/global.d.ts")
        expect(graph.modules).toContain("src/lib/entry/entry.ts")
    })

    it("extracts type-only imports and dynamic import literals distinctly", () => {
        const edges = targetsOf("src/lib/entry/entry.ts")
        expect(edges).toContainEqual({
            spec: "@/lib/timeline/shape",
            typeOnly: true,
            target: { kind: "module", path: "src/lib/timeline/shape.ts" },
        })
        expect(edges).toContainEqual({
            spec: "@/util/time",
            typeOnly: false,
            target: { kind: "module", path: "src/util/time.ts" },
        })
    })

    it("resolves relative paths from the importing file", () => {
        expect(targetsOf("src/lib/entry/entry.ts")).toContainEqual({
            spec: "./helper",
            typeOnly: false,
            target: { kind: "module", path: "src/lib/entry/helper.ts" },
        })
    })

    it("ignores imports of generated files", () => {
        expect(targetsOf("src/lib/entry/gen.ts")).toEqual([])
        expect(
            graph.unresolved.some(u => u.from === "src/lib/entry/gen.ts"),
        ).toBe(false)
    })

    it("extracts Astro frontmatter imports and ignores script contents", () => {
        const specs = targetsOf("src/pages/index.astro").map(e => e.spec)
        expect(specs).toContain("@/components/common/Badge/index")
        expect(specs).not.toContain("@/nothere/ignored")
    })

    it("resolves external packages and records whether imports are type-only", () => {
        expect(targetsOf("src/lib/entry/view.ts")).toContainEqual({
            spec: "react",
            typeOnly: true,
            target: { kind: "package", name: "react" },
        })
    })
})

describe("Region classification", () => {
    it.each([
        ["src/lib/entry/entry.ts", "lib/entry"],
        ["src/lib/guestMode.ts", "lib"],
        ["src/components/common/Badge/index.tsx", "components/common/Badge"],
        ["src/components/common/Icon.tsx", "components/common"],
        ["src/pages/index.astro", "pages"],
        ["src/util/http.ts", "util"],
        ["src/env.ts", "(root)"],
    ])("%s belongs to region %s", (file, region) => {
        expect(regionOf(file)).toBe(region)
    })
})

const violationsRoot = path.resolve(
    __dirname,
    "../../fixtures/import-rules/violations",
)

describe("Import rules", () => {
    const violations = evaluateImportRules(scanModules(violationsRoot))
    const has = (ruleId: string, from: string, specifier: string) =>
        violations.some(
            v =>
                v.ruleId === ruleId &&
                v.from === from &&
                v.specifier === specifier,
        )

    it("rejects imports from lib into components and pages", () => {
        expect(
            has(
                "layer",
                "src/lib/timeline/bad-layer.ts",
                "@/components/common/Badge/index",
            ),
        ).toBe(true)
    })

    it("rejects imports from util into lib", () => {
        expect(
            has("layer", "src/util/bad-util.ts", "@/lib/timeline/shape"),
        ).toBe(true)
    })

    it("rejects react and react-easy-crop imports from lib, including type-only imports", () => {
        expect(has("uiInLib", "src/lib/timeline/ui.ts", "react")).toBe(true)
        expect(
            has("uiInLib", "src/lib/timeline/ui.ts", "react-easy-crop"),
        ).toBe(true)
    })

    it("allows react imports from components", () => {
        expect(
            violations.some(
                v => v.from === "src/components/common/Badge/index.tsx",
            ),
        ).toBe(false)
    })

    it("rejects relative imports that cross regions", () => {
        expect(
            has(
                "crossRegionRelative",
                "src/lib/entry/cross.ts",
                "../timeline/shape",
            ),
        ).toBe(true)
    })

    it("allows relative imports within the same region", () => {
        expect(violations.some(v => v.from === "src/lib/entry/same.ts")).toBe(
            false,
        )
    })

    it("rejects imports with three or more parent-directory segments", () => {
        expect(
            has(
                "relativeDepth",
                "src/lib/entry/deep/x.ts",
                "../../../util/time",
            ),
        ).toBe(true)
    })

    it("rejects imports with a .js extension", () => {
        expect(
            has(
                "jsExtension",
                "src/lib/entry/js-ext.ts",
                "@/lib/timeline/shape.js",
            ),
        ).toBe(true)
    })

    it("allows imports that do not violate any rule", () => {
        expect(violations.some(v => v.from === "src/lib/clean/ok.ts")).toBe(
            false,
        )
    })

    it("reports both directions of a type-only cycle", () => {
        const cycles = findCycleViolations(scanModules(violationsRoot))
        expect(cycles.map(v => v.from).sort()).toEqual([
            "src/lib/cyc/a.ts",
            "src/lib/cyc/b.ts",
        ])
        expect(cycles.every(v => v.ruleId === "cycle")).toBe(true)
    })
})

describe("Allowlist", () => {
    const viol = (
        ruleId:
            | "layer"
            | "uiInLib"
            | "cycle"
            | "crossRegionRelative"
            | "relativeDepth"
            | "jsExtension",
        from: string,
        specifier: string,
    ) => ({
        ruleId,
        from,
        specifier,
        message: "m",
    })
    const entry = (
        ruleId: string,
        from: string,
        specifier: string,
        owner = "src-cycles",
    ) => ({
        ruleId: ruleId as "cycle",
        from,
        specifier,
        owner,
        reason: "テスト用の理由",
    })
    const tmpFile = (content: string) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-rules-"))
        const file = path.join(dir, "allowlist.json")
        fs.writeFileSync(file, content)
        return file
    }
    const ownerExists = (owner: string) =>
        owner === "src-cycles" || owner === "src-import-style"

    it("counts listed violations without treating them as failures", () => {
        const result = checkAllowlist(
            [viol("cycle", "src/a.ts", "./b")],
            [entry("cycle", "src/a.ts", "./b")],
        )
        expect(result.unlisted).toEqual([])
        expect(result.listedCount).toBe(1)
    })

    it("includes unlisted violations in the unlisted results", () => {
        const result = checkAllowlist([viol("cycle", "src/a.ts", "./b")], [])
        expect(result.unlisted).toHaveLength(1)
    })

    it("marks allowlist entries with no remaining violation as stale", () => {
        const result = checkAllowlist([], [entry("cycle", "src/a.ts", "./b")])
        expect(result.stale).toHaveLength(1)
        expect(result.unlisted).toEqual([])
    })

    it("rejects malformed JSON, duplicate keys, unknown rules, and missing owners", () => {
        expect(
            loadAllowlist(tmpFile("{ broken"), ownerExists).errors.length,
        ).toBeGreaterThan(0)
        const dup = JSON.stringify({
            version: 1,
            entries: [
                entry("cycle", "src/a.ts", "./b"),
                entry("cycle", "src/a.ts", "./b"),
            ],
        })
        expect(
            loadAllowlist(tmpFile(dup), ownerExists).errors.length,
        ).toBeGreaterThan(0)
        const unknown = JSON.stringify({
            version: 1,
            entries: [entry("nope", "src/a.ts", "./b")],
        })
        expect(
            loadAllowlist(tmpFile(unknown), ownerExists).errors.length,
        ).toBeGreaterThan(0)
        const noOwner = JSON.stringify({
            version: 1,
            entries: [entry("cycle", "src/a.ts", "./b", "no-such-spec")],
        })
        expect(
            loadAllowlist(tmpFile(noOwner), ownerExists).errors.length,
        ).toBeGreaterThan(0)
    })

    it("rejects entries with missing or blank reasons", () => {
        const missing = {
            ruleId: "cycle",
            from: "src/a.ts",
            specifier: "./b",
            owner: "src-cycles",
        }
        const empty = { ...missing, reason: "" }
        const blank = { ...missing, reason: "   " }
        for (const bad of [missing, empty, blank]) {
            const loaded = loadAllowlist(
                tmpFile(JSON.stringify({ version: 1, entries: [bad] })),
                ownerExists,
            )
            expect(loaded.errors).toHaveLength(1)
            expect(loaded.errors[0]).toMatch(/reason/)
            expect(loaded.entries).toEqual([])
        }
    })

    it("returns valid entries without errors", () => {
        const ok = JSON.stringify({
            version: 1,
            entries: [entry("cycle", "src/a.ts", "./b")],
        })
        const loaded = loadAllowlist(tmpFile(ok), ownerExists)
        expect(loaded.errors).toEqual([])
        expect(loaded.entries).toHaveLength(1)
    })

    it("assigns default owners to drafts that match without unlisted or stale entries", () => {
        const violations = [
            viol("cycle", "src/a.ts", "./b"),
            viol(
                "crossRegionRelative",
                "src/lib/entry/cross.ts",
                "../timeline/shape",
            ),
        ]
        const draft = emitAllowlist(violations)
        expect(draft.entries.every(e => e.reason === "")).toBe(true)
        expect(draft.entries.map(e => e.owner).sort()).toEqual([
            "src-cycles",
            "src-import-style",
        ])
        const result = checkAllowlist(violations, draft.entries)
        expect(result.unlisted).toEqual([])
        expect(result.stale).toEqual([])
    })
})

describe("Import check CLI", () => {
    // Owner validation checks configured owners, including built-in owners.
    const ownerExists = (owner: string) =>
        owner.startsWith("src-") || owner === "structure-checks"
    const writeAllowlist = (entries: unknown[]) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "import-cli-"))
        const file = path.join(dir, "import-allowlist.json")
        fs.writeFileSync(file, JSON.stringify({ version: 1, entries }))
        return file
    }

    it("returns exit code 1 when the allowlist is missing", () => {
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: path.join(
                os.tmpdir(),
                "does-not-exist-allowlist.json",
            ),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(1)
    })

    it("returns exit code 1 and reports an unlisted violation in the output lines", () => {
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist([]),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(1)
        expect(
            result.lines.some(line => line.includes("src/lib/cyc/a.ts")),
        ).toBe(true)
    })

    // Draft reasons are empty, so fill them before loading the allowlist.
    const fillReasons = (entries: { reason: string }[]) =>
        entries.map(e => ({ ...e, reason: "テスト用の理由" }))

    it("emits drafts with empty reasons and succeeds after reasons are filled", () => {
        const draft = runImportCheck({
            root: violationsRoot,
            allowlistPath: "",
            emit: true,
            ownerExists,
        })
        expect(draft.exitCode).toBe(0)
        const parsed = JSON.parse(draft.lines.join("\n")) as {
            entries: { reason: string }[]
        }
        expect(parsed.entries.every(e => e.reason === "")).toBe(true)
        const unfilled = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist(parsed.entries),
            emit: false,
            ownerExists,
        })
        expect(unfilled.exitCode).toBe(1)
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist(fillReasons(parsed.entries)),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(0)
        expect(result.lines.some(line => line.startsWith("警告"))).toBe(false)
    })

    it("returns exit code 1 when an allowlist entry has no reason", () => {
        const draft = runImportCheck({
            root: violationsRoot,
            allowlistPath: "",
            emit: true,
            ownerExists,
        })
        const parsed = JSON.parse(draft.lines.join("\n")) as {
            entries: { reason: string }[]
        }
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist(fillReasons(parsed.entries)),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(0)
        const missing = parsed.entries.map(
            ({ reason: _reason, ...rest }) => rest,
        )
        const negative = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist(missing),
            emit: false,
            ownerExists,
        })
        expect(negative.exitCode).toBe(1)
        expect(
            negative.lines.some(
                line => line.startsWith("エラー") && line.includes("reason"),
            ),
        ).toBe(true)
    })

    it("warns about stale allowlist entries while returning exit code 0", () => {
        const extra = {
            ruleId: "cycle",
            from: "src/lib/gone.ts",
            specifier: "./x",
            owner: "src-cycles",
            reason: "テスト用の理由",
        }
        const draft = runImportCheck({
            root: violationsRoot,
            allowlistPath: "",
            emit: true,
            ownerExists,
        })
        const parsed = JSON.parse(draft.lines.join("\n")) as {
            entries: { reason: string }[]
        }
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist([
                ...fillReasons(parsed.entries),
                extra,
            ]),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(0)
        expect(
            result.lines.some(
                line =>
                    line.startsWith("警告") && line.includes("src/lib/gone.ts"),
            ),
        ).toBe(true)
    })

    it("returns exit code 1 when the allowlist contains an invalid owner", () => {
        // A valid reason isolates the owner validation error.
        const bad = {
            ruleId: "cycle",
            from: "src/a.ts",
            specifier: "./b",
            owner: "no-such-spec",
            reason: "テスト用の理由",
        }
        const result = runImportCheck({
            root: violationsRoot,
            allowlistPath: writeAllowlist([bad]),
            emit: false,
            ownerExists,
        })
        expect(result.exitCode).toBe(1)
        // Unlisted violations also cause exit code 1, so verify the owner error line.
        expect(
            result.lines.some(
                line =>
                    line.startsWith("エラー") &&
                    line.includes("所有 spec no-such-spec"),
            ),
        ).toBe(true)
        expect(result.lines.some(line => line.includes("reason"))).toBe(false)
    })

    describe("utilShared rule", () => {
        const utilSharedRoot = path.resolve(
            __dirname,
            "../../fixtures/import-rules/util-shared",
        )
        const utilSharedOkRoot = path.resolve(
            __dirname,
            "../../fixtures/import-rules/util-shared-ok",
        )
        const lonelyEntry = {
            ruleId: "utilShared",
            from: "src/util/lonely.ts",
            specifier: "",
            owner: "structure-checks",
            reason: "テスト用の理由",
        }

        it("reports a util used by only one region and returns exit code 1", () => {
            const result = runImportCheck({
                root: utilSharedRoot,
                allowlistPath: writeAllowlist([]),
                emit: false,
                ownerExists: ownerExists,
            })
            expect(result.exitCode).toBe(1)
            expect(
                result.lines.some(line =>
                    line.startsWith("違反: [utilShared] src/util/lonely.ts"),
                ),
            ).toBe(true)
        })

        it("returns exit code 0 when the violation is allowlisted with a reason", () => {
            const result = runImportCheck({
                root: utilSharedRoot,
                allowlistPath: writeAllowlist([lonelyEntry]),
                emit: false,
                ownerExists: ownerExists,
            })
            expect(result.exitCode).toBe(0)
            expect(result.lines.some(line => line.startsWith("違反:"))).toBe(
                false,
            )
        })

        it("allows a util used by two regions and returns exit code 0", () => {
            const result = runImportCheck({
                root: utilSharedOkRoot,
                allowlistPath: writeAllowlist([]),
                emit: false,
                ownerExists: ownerExists,
            })
            expect(result.exitCode).toBe(0)
            expect(result.lines.some(line => line.includes("utilShared"))).toBe(
                false,
            )
        })

        it("includes utilShared entries with the built-in owner in emitted drafts", () => {
            const draft = runImportCheck({
                root: utilSharedRoot,
                allowlistPath: "",
                emit: true,
                ownerExists: ownerExists,
            })
            const parsed = JSON.parse(draft.lines.join("\n")) as {
                entries: { ruleId: string; owner: string; from: string }[]
            }
            expect(parsed.entries).toContainEqual(
                expect.objectContaining({
                    ruleId: "utilShared",
                    from: "src/util/lonely.ts",
                    owner: "structure-checks",
                }),
            )
        })
    })

    describe("typesOnly rule", () => {
        const typesOnlyRoot = path.resolve(
            __dirname,
            "../../fixtures/import-rules/types-only",
        )
        const typesOnlyOkRoot = path.resolve(
            __dirname,
            "../../fixtures/import-rules/types-only-ok",
        )
        const badEntry = {
            ruleId: "typesOnly",
            from: "src/types/bad.ts",
            specifier: "",
            owner: "structure-checks",
            reason: "テスト用の理由",
        }

        it("reports src/types .ts files with value declarations and returns exit code 1", () => {
            const result = runImportCheck({
                root: typesOnlyRoot,
                allowlistPath: writeAllowlist([]),
                emit: false,
                ownerExists: ownerExists,
            })
            expect(result.exitCode).toBe(1)
            expect(
                result.lines.some(line =>
                    line.startsWith("違反: [typesOnly] src/types/bad.ts"),
                ),
            ).toBe(true)
        })

        it("returns exit code 0 when the violation is allowlisted with a reason", () => {
            const result = runImportCheck({
                root: typesOnlyRoot,
                allowlistPath: writeAllowlist([badEntry]),
                emit: false,
                ownerExists: ownerExists,
            })
            expect(result.exitCode).toBe(0)
            expect(result.lines.some(line => line.startsWith("違反:"))).toBe(
                false,
            )
        })

        it("allows src/types .ts files containing only type declarations", () => {
            const result = runImportCheck({
                root: typesOnlyOkRoot,
                allowlistPath: writeAllowlist([]),
                emit: false,
                ownerExists: ownerExists,
            })
            expect(result.exitCode).toBe(0)
            expect(result.lines.some(line => line.includes("typesOnly"))).toBe(
                false,
            )
        })

        it("excludes Astro files from typesOnly violations", () => {
            const result = runImportCheck({
                root: typesOnlyRoot,
                allowlistPath: writeAllowlist([badEntry]),
                emit: false,
                ownerExists: ownerExists,
            })
            expect(result.lines.some(line => line.includes("page.astro"))).toBe(
                false,
            )
        })

        it("formats violations with an empty specifier without extra words or spaces", () => {
            const result = runImportCheck({
                root: typesOnlyRoot,
                allowlistPath: writeAllowlist([]),
                emit: false,
                ownerExists: ownerExists,
            })
            const line = result.lines.find(l => l.includes("[typesOnly]"))
            expect(line).toBeDefined()
            expect(line).not.toContain("で import")
            expect(line).not.toContain("  ")
        })

        it("formats utilShared violations with an empty specifier without extra words", () => {
            const result = runImportCheck({
                root: path.resolve(
                    __dirname,
                    "../../fixtures/import-rules/util-shared",
                ),
                allowlistPath: writeAllowlist([]),
                emit: false,
                ownerExists: ownerExists,
            })
            const line = result.lines.find(l => l.includes("[utilShared]"))
            expect(line).toBeDefined()
            expect(line).not.toContain("で import")
            expect(line).not.toContain("  ")
        })

        it("formats violations with a specifier as an import message", () => {
            const result = runImportCheck({
                root: violationsRoot,
                allowlistPath: writeAllowlist([]),
                emit: false,
                ownerExists: ownerExists,
            })
            const line = result.lines.find(l => l.startsWith("違反: [cycle]"))
            expect(line).toBeDefined()
            expect(line).toMatch(/ を \S+ で import: /)
        })
    })
})

describe("Independence from a prescribed project layout", () => {
    const arbitraryRoot = path.resolve(
        __dirname,
        "../../fixtures/import-rules/arbitrary",
    )

    it("reports no violations for a tree with arbitrary folder names and layout", () => {
        const graph = scanModules(arbitraryRoot)
        expect(evaluateImportRules(graph)).toEqual([])
        expect(findCycleViolations(graph)).toEqual([])
    })

    it("associates every rule with a supporting steering section", () => {
        for (const id of RULE_IDS) {
            expect(RULE_BASIS[id]).toMatch(/structure\*\.md/)
        }
    })
})

describe("libLayer rule", () => {
    // Fixture edge layers follow the mapping in lib-layers.ts.
    const libLayerRoot = path.resolve(
        __dirname,
        "../../fixtures/import-rules/lib-layers",
    )
    const libLayerViolations = evaluateImportRules(scanModules(libLayerRoot))
        .filter(v => v.ruleId === "libLayer")
        .map(v => [v.from, v.specifier])

    it("rejects imports from foundation modules into business modules", () => {
        expect(libLayerViolations).toContainEqual([
            "src/lib/api/bad.ts",
            "@/lib/feedback/y",
        ])
        expect(libLayerViolations).toContainEqual([
            "src/lib/site/bad-guest.ts",
            "@/lib/guestMode",
        ])
    })

    it("allows business-to-foundation, foundation-to-foundation, and business-to-business imports", () => {
        // Only the two invalid imports above are present; valid direction examples are excluded.
        expect(libLayerViolations).toHaveLength(2)
        expect(
            libLayerViolations.some(
                ([from]) => from === "src/lib/session/x.ts",
            ),
        ).toBe(false)
        expect(
            libLayerViolations.some(([from]) => from === "src/lib/entry/x.ts"),
        ).toBe(false)
        expect(
            libLayerViolations.some(([from]) => from === "src/lib/entry/z.ts"),
        ).toBe(false)
    })

    it("treats guestMode.ts as a business module and allows its timeline import", () => {
        expect(
            libLayerViolations.some(
                ([from]) => from === "src/lib/guestMode.ts",
            ),
        ).toBe(false)
    })

    it("rejects imports of guestMode.ts from foundation modules", () => {
        expect(
            libLayerViolations.some(
                ([from, spec]) =>
                    from === "src/lib/site/bad-guest.ts" &&
                    spec === "@/lib/guestMode",
            ),
        ).toBe(true)
    })
})
