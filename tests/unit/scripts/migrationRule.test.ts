/**
 * マイグレーションの運用規則（release 以外は 0001 だけ）の判定・CLI・Claude のフックを確かめる。
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import {
    findMigrationViolations,
    isInitialOnlyRequired,
    isLaterMigrationPath,
} from "../../../scripts/git/migration-rule.mjs"
import {
    decideMigrationToolUse,
    gateReason,
} from "../../../scripts/agent/migration-gate.mjs"

const repoRoot = path.resolve(__dirname, "../../..")

describe("isInitialOnlyRequired", () => {
    it.each([
        ["develop", undefined, true],
        ["main", undefined, true],
        ["dev/survey-results-publishing", undefined, true],
        ["dev/x", "develop", true],
        ["release/v2.0.0", undefined, false],
        ["release/v2.0.0", "release/v2.0.0", false],
        ["release/v2.0.0", "main", true],
        ["release/v2.0.0", "develop", true],
    ])("%s (base %s) -> %s", (branch, base, expected) => {
        expect(isInitialOnlyRequired({ branch, baseBranch: base })).toBe(
            expected,
        )
    })
})

describe("findMigrationViolations", () => {
    it("accepts exactly one 0001 file", () => {
        expect(findMigrationViolations(["0001_initial.sql"])).toEqual([])
    })

    it("reports later migrations", () => {
        expect(
            findMigrationViolations(["0001_initial.sql", "0002_add.sql"]),
        ).toEqual(["0002_add.sql"])
    })

    it("reports a second 0001 file and a missing 0001", () => {
        expect(
            findMigrationViolations(["0001_a.sql", "0001_b.sql"]),
        ).not.toEqual([])
        expect(findMigrationViolations(["0002_add.sql"])).not.toEqual([])
    })

    it("reports every .sql file other than 0001_initial.sql, whatever its name", () => {
        expect(
            findMigrationViolations(["0001_initial.sql", "2_extra.sql"]),
        ).toEqual(["2_extra.sql"])
        expect(
            findMigrationViolations(["0001_initial.sql", "extra.sql"]),
        ).toEqual(["extra.sql"])
        expect(findMigrationViolations(["0001_renamed.sql"])).not.toEqual([])
    })

    it("ignores files that are not migrations", () => {
        expect(
            findMigrationViolations(["0001_initial.sql", "README.md"]),
        ).toEqual([])
    })
})

describe("isLaterMigrationPath", () => {
    it.each([
        ["migrations/0002_x.sql", true],
        ["/repo/migrations/0010_x.sql", true],
        ["migrations/0001_initial.sql", false],
        ["migrations/extra.sql", true],
        ["migrations/2_extra.sql", true],
        ["migrations/0001_renamed.sql", true],
        ["migrations/README.md", false],
        ["src/migrations/readme.md", false],
        ["docs/0002_x.sql", false],
    ])("%s -> %s", (p, expected) => {
        expect(isLaterMigrationPath(p)).toBe(expected)
    })
})

describe("decideMigrationToolUse (Claude hook)", () => {
    it("denies writing a later migration outside a release branch", () => {
        const reason = decideMigrationToolUse(
            "Write",
            { file_path: "/repo/migrations/0002_x.sql" },
            "dev/foo",
        )
        expect(reason).toBe(gateReason)
    })

    it("denies a shell command that creates or writes a later migration", () => {
        expect(
            decideMigrationToolUse(
                "Bash",
                { command: "npx wrangler d1 migrations create DB add_col" },
                "develop",
            ),
        ).toBe(gateReason)
        expect(
            decideMigrationToolUse(
                "Bash",
                { command: "cat > migrations/0003_y.sql <<'E'\nselect 1\nE" },
                "main",
            ),
        ).toBe(gateReason)
    })

    it("allows later migrations on a release branch", () => {
        expect(
            decideMigrationToolUse(
                "Write",
                { file_path: "migrations/0002_x.sql" },
                "release/v2.0.0",
            ),
        ).toBeNull()
    })

    it("denies a command that writes any other .sql file under migrations", () => {
        expect(
            decideMigrationToolUse(
                "Bash",
                { command: "echo 'select 1' > migrations/extra.sql" },
                "develop",
            ),
        ).toBe(gateReason)
    })

    it("denies a name that only starts with the initial file name", () => {
        expect(
            decideMigrationToolUse(
                "Bash",
                {
                    command:
                        "echo test > migrations/0001_initial.sql_extra.sql",
                },
                "develop",
            ),
        ).toBe(gateReason)
        expect(
            decideMigrationToolUse(
                "Write",
                { file_path: "migrations/0001_initial.sql_extra.sql" },
                "develop",
            ),
        ).toBe(gateReason)
    })

    it("allows editing 0001 and unrelated commands", () => {
        expect(
            decideMigrationToolUse(
                "Edit",
                { file_path: "migrations/0001_initial.sql" },
                "develop",
            ),
        ).toBeNull()
        expect(
            decideMigrationToolUse(
                "Bash",
                { command: "npm run test:unit" },
                "main",
            ),
        ).toBeNull()
    })

    it("does not decide when the branch is unknown", () => {
        expect(
            decideMigrationToolUse(
                "Write",
                { file_path: "migrations/0002_x.sql" },
                null,
            ),
        ).toBeNull()
    })
})

describe("check-migrations CLI", () => {
    const tmpRoots: string[] = []
    afterAll(() => {
        for (const root of tmpRoots)
            fs.rmSync(root, { recursive: true, force: true })
    })
    const makeRoot = (files: string[]): string => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "migration-rule-"))
        tmpRoots.push(root)
        fs.mkdirSync(path.join(root, "migrations"))
        for (const f of files)
            fs.writeFileSync(path.join(root, "migrations", f), "select 1;")
        return root
    }
    const run = (root: string, args: string[]) =>
        spawnSync(
            "node",
            [
                path.join(repoRoot, "scripts/git/check-migrations.mjs"),
                "--root",
                root,
                ...args,
            ],
            { encoding: "utf8" },
        )

    it("fails on develop with a later migration", () => {
        const result = run(makeRoot(["0001_initial.sql", "0002_x.sql"]), [
            "--branch",
            "develop",
        ])
        expect(result.status).toBe(1)
        expect(result.stderr).toContain("0002_x.sql")
    })

    it("passes on a release branch with later migrations", () => {
        const result = run(makeRoot(["0001_initial.sql", "0002_x.sql"]), [
            "--branch",
            "release/v2.0.0",
        ])
        expect(result.status).toBe(0)
    })

    it("fails for a release head whose base is main", () => {
        const result = run(makeRoot(["0001_initial.sql", "0002_x.sql"]), [
            "--branch",
            "release/v2.0.0",
            "--base",
            "main",
        ])
        expect(result.status).toBe(1)
    })

    it("checks the index with --index: a staged extra file fails and a removed 0001 fails", () => {
        const root = makeRoot(["0001_initial.sql"])
        const git = (...args: string[]) =>
            spawnSync("git", ["-C", root, ...args], { encoding: "utf8" })
        git("init", "-q")
        git("add", "migrations/0001_initial.sql")
        expect(run(root, ["--branch", "develop", "--index"]).status).toBe(0)

        git("rm", "-q", "--cached", "migrations/0001_initial.sql")
        const removed = run(root, ["--branch", "develop", "--index"])
        expect(removed.status).toBe(1)

        fs.writeFileSync(
            path.join(root, "migrations", "x_extra.sql"),
            "select 1;",
        )
        git("add", "migrations/0001_initial.sql", "migrations/x_extra.sql")
        const extra = run(root, ["--branch", "develop", "--index"])
        expect(extra.status).toBe(1)
        expect(extra.stderr).toContain("x_extra.sql")
    })

    it("checks the index with --index even when the file name needs quoting", () => {
        const root = makeRoot(["0001_initial.sql"])
        const git = (...args: string[]) =>
            spawnSync("git", ["-C", root, ...args], { encoding: "utf8" })
        git("init", "-q")
        fs.writeFileSync(
            path.join(root, "migrations", "追加の変更.sql"),
            "select 1;",
        )
        git("add", "migrations/0001_initial.sql", "migrations/追加の変更.sql")
        const result = run(root, ["--branch", "develop", "--index"])
        expect(result.status).toBe(1)
        expect(result.stderr).toContain("追加の変更.sql")
    })

    it("passes on develop with only 0001", () => {
        const result = run(makeRoot(["0001_initial.sql"]), [
            "--branch",
            "develop",
        ])
        expect(result.status).toBe(0)
    })
})
