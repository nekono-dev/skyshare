/**
 * Sanitizes feedback fields before building an issue body.
 */
import { describe, expect, it } from "vitest"
import {
    buildIssue,
    fencedBlock,
    inlineValue,
} from "@/lib/feedback/issueContent"
import type { RequestBodyType } from "@/lib/api/schema/v2/feedback/post"

const environment = {
    os: "Linux",
    browser: "Chrome",
    userAgent: "UA-fixture",
    standalone: false,
    version: "1.0.0",
    commit: "",
}
const build = { version: "1.0.0", commit: null, repository: "owner/repo" }
const reporter = {
    did: "did:plc:testfixturealice0000000000",
    handle: "alice.test",
}

describe("fencedBlock", () => {
    it("uses a longer fence than any backtick run in the text, so the text cannot close the block", () => {
        const block = fencedBlock("a ``` b")
        expect(block.startsWith("````text\n")).toBe(true)
        expect(block.endsWith("\n````")).toBe(true)
    })

    it("normalizes CRLF line endings inside the block", () => {
        expect(fencedBlock("a\r\nb")).toBe("```text\na\nb\n```")
    })
})

describe("inlineValue", () => {
    it("removes backticks and line breaks so the inline code cannot be broken", () => {
        expect(inlineValue("Mozilla `x`\nline")).toBe("`Mozilla xline`")
    })

    it("shows an unknown marker for an empty value", () => {
        expect(inlineValue("  \n ")).toBe("不明")
    })
})

describe("buildIssue", () => {
    it("collapses a title with line breaks into one line", () => {
        const input = {
            kind: "bug",
            title: "落ちる\n  再現",
            steps: "押した",
            reproducibility: "always",
            environment,
        } as RequestBodyType
        expect(buildIssue(input, reporter, build).title).toBe("落ちる 再現")
    })

    it("keeps a handle that contains a backtick or a mention inside inline code, not as a mention", () => {
        const input = {
            kind: "bug",
            title: "t",
            steps: "s",
            reproducibility: "no",
            environment,
        } as RequestBodyType
        const issue = buildIssue(
            input,
            { did: reporter.did, handle: "evil`x" },
            build,
        )
        expect(issue.body).toContain("`@evilx`")
    })

    it("omits the technical notes section when a proposal has none", () => {
        const input = {
            kind: "enhancement",
            title: "t",
            description: "d",
            environment,
        } as RequestBodyType
        expect(buildIssue(input, reporter, build).body).not.toContain(
            "### 技術的な補足",
        )
    })

    it("lists the screen version only when it differs from the server version", () => {
        const input = {
            kind: "bug",
            title: "t",
            steps: "s",
            reproducibility: "no",
            environment,
        } as RequestBodyType
        expect(buildIssue(input, reporter, build).body).not.toContain(
            "画面の版",
        )
        const other = {
            ...input,
            environment: { ...environment, version: "0.9.0" },
        } as RequestBodyType
        expect(buildIssue(other, reporter, build).body).toContain("画面の版")
    })
})

describe("buildIssue (commit lines)", () => {
    const SHA_A = "a".repeat(40)
    const SHA_B = "b".repeat(40)

    it("links the server commit and also lists the screen commit when they differ", () => {
        const input = {
            kind: "bug",
            title: "t",
            steps: "s",
            reproducibility: "no",
            environment: { ...environment, commit: SHA_B },
        } as RequestBodyType
        const body = buildIssue(input, reporter, {
            ...build,
            commit: SHA_A,
        }).body
        expect(body).toContain(
            `[aaaaaaa](https://github.com/owner/repo/commit/${SHA_A})`,
        )
        expect(body).toContain("画面のコミット")
    })

    it("does not list the screen commit when it equals the server commit", () => {
        const input = {
            kind: "bug",
            title: "t",
            steps: "s",
            reproducibility: "no",
            environment: { ...environment, commit: SHA_A },
        } as RequestBodyType
        expect(
            buildIssue(input, reporter, { ...build, commit: SHA_A }).body,
        ).not.toContain("画面のコミット")
    })
})
