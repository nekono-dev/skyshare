/**
 * BRW の取得元の検査（brwSource.mjs）の単体テスト。
 * HTTPS の GitHub の URL と、ブランチ名の規則を確かめる。欠落は原因が分かる文言で止まる。
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import {
    readBrwSource,
    sourceProblem,
} from "../../../scripts/agent/brwSource.mjs"

const roots: string[] = []
afterAll(() => {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

describe("取得元の検査（sourceProblem）", () => {
    it("正しい取得元は、問題なし", () => {
        expect(
            sourceProblem({
                repository:
                    "https://github.com/nekono-dev/branch-release-workflow.git",
                branch: "main",
            }),
        ).toBeNull()
    })

    it("HTTPS の GitHub 以外の URL は、問題あり", () => {
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

    it("不正なブランチ名は、問題あり", () => {
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

describe("取得元のファイルの読み取り（readBrwSource）", () => {
    it("ファイルが無ければ、ファイルが無いと分かる文言で例外", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brw-source-"))
        roots.push(dir)
        expect(() => readBrwSource(path.join(dir, "missing.json"))).toThrow(
            /取得元のファイルがありません/,
        )
    })

    it("正しいファイルは、repository と branch を返す", () => {
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

    it("不正なファイルは、ファイル名を含む文言で例外", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brw-source-"))
        roots.push(dir)
        const file = path.join(dir, "source.json")
        fs.writeFileSync(
            file,
            JSON.stringify({ repository: "x", branch: "main" }),
        )
        expect(() => readBrwSource(file)).toThrow(file)
    })

    it("repository が不正なら、ファイル名と項目名を含む文言で例外", () => {
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

    it("branch が不正なら、ファイル名と項目名を含む文言で例外", () => {
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

    it("壊れた JSON は、ファイル名と形式不正を含む文言で例外", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brw-source-"))
        roots.push(dir)
        const file = path.join(dir, "source.json")
        fs.writeFileSync(file, "{")
        expect(() => readBrwSource(file)).toThrow(file)
        expect(() => readBrwSource(file)).toThrow(/JSON|形式/)
    })
})
