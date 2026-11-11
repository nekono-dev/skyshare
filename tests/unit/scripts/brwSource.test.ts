/**
 * Checks BRW source URLs, branch names, and source file errors.
 * Invalid input reports the file and field that caused the failure.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import {
    readBrwSource,
    sourceProblem,
} from "../../../scripts/agent/brw-source.mjs"

const roots: string[] = []
afterAll(() => {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

describe("BRW source validation", () => {
    it("accepts a valid source", () => {
        expect(
            sourceProblem({
                repository:
                    "https://github.com/nekono-dev/branch-release-workflow.git",
                branch: "main",
            }),
        ).toBeNull()
    })

    it("rejects URLs that are not HTTPS GitHub URLs", () => {
        expect(
            sourceProblem({
                repository: "git@github.com:nekono-dev/x.git",
                branch: "main",
            }),
        ).toMatch(/HTTPS/)
        expect(
            sourceProblem({
                repository: "https://example.com/x.git",
                branch: "main",
            }),
        ).toMatch(/HTTPS/)
        expect(
            sourceProblem({
                repository: "https://github.com/nekono-dev/x",
                branch: "main",
            }),
        ).toMatch(/HTTPS/)
    })

    it("rejects invalid branch names", () => {
        const repository = "https://github.com/nekono-dev/x.git"
        expect(sourceProblem({ repository, branch: "" })).toMatch(/ブランチ名/)
        expect(sourceProblem({ repository, branch: "-bad" })).toMatch(
            /ブランチ名/,
        )
        expect(sourceProblem({ repository, branch: "a b" })).toMatch(
            /ブランチ名/,
        )
    })
})

describe("Reading the BRW source file", () => {
    it("reports a clear error when the file is missing", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brw-source-"))
        roots.push(dir)
        expect(() => readBrwSource(path.join(dir, "missing.json"))).toThrow(
            /取得元のファイルがありません/,
        )
    })

    it("returns the repository and branch from a valid file", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brw-source-"))
        roots.push(dir)
        const file = path.join(dir, "source.json")
        fs.writeFileSync(
            file,
            JSON.stringify({
                repository: "https://github.com/nekono-dev/x.git",
                branch: "main",
            }),
        )
        expect(readBrwSource(file)).toEqual({
            repository: "https://github.com/nekono-dev/x.git",
            branch: "main",
        })
    })

    it("includes the filename in errors for invalid files", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brw-source-"))
        roots.push(dir)
        const file = path.join(dir, "source.json")
        fs.writeFileSync(
            file,
            JSON.stringify({ repository: "x", branch: "main" }),
        )
        expect(() => readBrwSource(file)).toThrow(file)
    })

    it("includes the filename and field name for an invalid repository", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brw-source-"))
        roots.push(dir)
        const file = path.join(dir, "source.json")
        fs.writeFileSync(
            file,
            JSON.stringify({ repository: "x", branch: "main" }),
        )
        expect(() => readBrwSource(file)).toThrow(
            new RegExp(`${file}.*repository`),
        )
    })

    it("includes the filename and field name for an invalid branch", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brw-source-"))
        roots.push(dir)
        const file = path.join(dir, "source.json")
        fs.writeFileSync(
            file,
            JSON.stringify({
                repository: "https://github.com/nekono-dev/x.git",
                branch: "",
            }),
        )
        expect(() => readBrwSource(file)).toThrow(new RegExp(`${file}.*branch`))
    })

    it("reports the filename and malformed format for invalid JSON", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brw-source-"))
        roots.push(dir)
        const file = path.join(dir, "source.json")
        fs.writeFileSync(file, "{")
        expect(() => readBrwSource(file)).toThrow(file)
        expect(() => readBrwSource(file)).toThrow(/JSON|形式/)
    })
})
