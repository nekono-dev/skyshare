/**
 * survey CLI の引数解析で受理する指定と使い方エラーを確かめる。
 */
import { describe, expect, it } from "vitest"

import { parseArgs } from "../../../../hack/survey-cli/args"

describe("parseArgs", () => {
    it.each([
        [
            ["add", "--file", "draft.json", "--env", "production"],
            {
                name: "add",
                file: "draft.json",
                env: "production",
                dryRun: false,
            },
        ],
        [
            ["add", "--file", "draft.json", "--dry-run", "--env", "develop"],
            {
                name: "add",
                file: "draft.json",
                env: "develop",
                dryRun: true,
            },
        ],
        [
            ["status", "--env", "production"],
            { name: "status", env: "production" },
        ],
        [["status", "--env", "develop"], { name: "status", env: "develop" }],
        [
            ["publish", "survey-1", "--env", "production"],
            {
                name: "publish",
                id: "survey-1",
                env: "production",
                deploy: true,
                dryRun: false,
            },
        ],
        [
            [
                "publish",
                "survey-1",
                "--env",
                "develop",
                "--dry-run",
                "--no-deploy",
            ],
            {
                name: "publish",
                id: "survey-1",
                env: "develop",
                deploy: false,
                dryRun: true,
            },
        ],
        [
            ["unpublish", "survey-1", "--env", "production"],
            {
                name: "unpublish",
                id: "survey-1",
                env: "production",
                deploy: true,
                dryRun: false,
            },
        ],
        [
            [
                "unpublish",
                "survey-1",
                "--env",
                "develop",
                "--dry-run",
                "--no-deploy",
            ],
            {
                name: "unpublish",
                id: "survey-1",
                env: "develop",
                deploy: false,
                dryRun: true,
            },
        ],
        [
            ["prune", "--env", "production"],
            { name: "prune", env: "production", dryRun: false },
        ],
        [
            ["prune", "--dry-run", "--env", "develop"],
            { name: "prune", env: "develop", dryRun: true },
        ],
        [
            ["remove", "survey-1", "--env", "production"],
            {
                name: "remove",
                id: "survey-1",
                env: "production",
                dryRun: false,
            },
        ],
        [
            ["remove", "survey-1", "--dry-run", "--env", "develop"],
            {
                name: "remove",
                id: "survey-1",
                env: "develop",
                dryRun: true,
            },
        ],
    ] as const)("accepts %j", (argv, command) => {
        expect(parseArgs(argv)).toEqual({ ok: true, command })
    })

    it("accepts a valid repository override", () => {
        expect(
            parseArgs(["status", "--env", "develop", "--repo", "owner/repo"]),
        ).toEqual({
            ok: true,
            command: { name: "status", env: "develop" },
            repo: "owner/repo",
        })
    })

    it.each([
        [["wat"], "unknown command"],
        [["add", "--env", "develop"], "missing file"],
        [["status"], "missing environment"],
        [["publish", "--env", "develop"], "missing id"],
        [["prune", "extra"], "extra positional argument"],
        [["status", "--env", "develop", "extra"], "extra positional argument"],
        [
            ["publish", "survey-1", "--env", "develop", "extra"],
            "extra positional argument",
        ],
        [["add", "--file", "a.json", "--file", "b.json"], "duplicate option"],
        [
            ["status", "--env", "develop", "--env", "production"],
            "duplicate option",
        ],
        [["prune", "--dry-run", "--dry-run"], "duplicate option"],
        [["remove", "survey-1", "--dry-run", "--dry-run"], "duplicate option"],
        [["add", "--file", "a.json", "--unknown"], "unknown option"],
        [["status", "--env", "develop", "--unknown"], "unknown option"],
        [["prune", "--force"], "force is forbidden"],
        [["remove", "survey-1", "--force"], "force is forbidden"],
        [
            ["publish", "survey-1", "--env", "develop", "--force"],
            "force is forbidden",
        ],
        [["add", "--file", "a.json"], "missing environment"],
        [["prune"], "missing environment"],
        [["remove", "survey-1"], "missing environment"],
        [["add", "--file", "a.json", "--env", "bad"], "invalid environment"],
        [["prune", "--env", "bad"], "invalid environment"],
        [["remove", "survey-1", "--env", "bad"], "invalid environment"],
        [["status", "--env", "develop", "--dry-run"], "dry-run forbidden"],
        [
            [
                "publish",
                "survey-1",
                "--env",
                "develop",
                "--no-deploy",
                "--no-deploy",
            ],
            "duplicate option",
        ],
        [
            ["add", "--file", "a.json", "--env", "develop", "--no-deploy"],
            "deploy option forbidden",
        ],
        [
            ["prune", "--env", "develop", "--no-deploy"],
            "deploy option forbidden",
        ],
        [
            ["remove", "survey-1", "--env", "develop", "--no-deploy"],
            "deploy option forbidden",
        ],
        [["publish", "survey-1", "--env", "bad"], "invalid environment"],
        [["unpublish", "survey-1", "--env", "bad"], "invalid environment"],
        [["status", "--env", "bad"], "invalid environment"],
        [["publish", "Bad_ID", "--env", "develop"], "invalid id"],
        [["remove", "Bad_ID", "--env", "develop"], "invalid id"],
        [["publish", "survey-1"], "missing environment"],
        [["unpublish", "survey-1"], "missing environment"],
        [["add", "--file"], "missing option value"],
        [["status", "--env"], "missing option value"],
        [["add", "--file", "a.json", "--repo", "invalid"], "invalid repo"],
        [
            ["prune", "--repo", "owner/repo", "--repo", "other/repo"],
            "duplicate repo",
        ],
    ] as const)("rejects %s (%s)", (argv, _label) => {
        const result = parseArgs(argv)
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.usage).toMatch(/^error: usage: /)
    })
})

describe("使い方の文言", () => {
    it.each([
        ["未知の指定", ["status", "--env", "develop", "--secret-token"]],
        ["環境の値", ["status", "--env", "secret-env"]],
        ["識別子の値", ["publish", "secret id", "--env", "develop"]],
        ["リポジトリの値", ["prune", "--repo", "secret-repo"]],
        ["余分な引数", ["status", "--env", "develop", "secret-extra"]],
    ])("%s の失敗は 1 行で、入力の値を含まない", (_name, argv) => {
        const result = parseArgs(argv)

        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.usage).not.toContain("\n")
        expect(result.usage).not.toMatch(/secret/)
    })
})
