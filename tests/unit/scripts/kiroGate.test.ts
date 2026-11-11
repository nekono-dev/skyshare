/**
 * Tests command gating, required document reads, completion checks, and the hook entry point.
 * The optional installed skill may be absent in CI; temporary files and child-process state are removed after each run.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { afterAll, describe, expect, it } from "vitest"
import {
    decidePreToolUse,
    decideStop,
    markRead,
    missingBriefs,
    newestSpecNames,
    parseKiroCommand,
    repoRoot,
    skillPathFor,
    startState,
    summarizeSpecs,
    unreadRequired,
} from "../../../scripts/agent/kiro-gate.mjs"

const tmpRoots: string[] = []
const makeRoot = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kiro-gate-test-"))
    tmpRoots.push(root)
    return root
}
const writeFile = (file: string, text: string): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
}

const skill = path.join(repoRoot, ".claude/skills/kiro-discovery/SKILL.md")
const cwd = repoRoot

describe("parseKiroCommand", () => {
    it("returns the name of a leading slash command", () => {
        expect(parseKiroCommand("/kiro-discovery 依頼の内容")).toBe(
            "kiro-discovery",
        )
        expect(parseKiroCommand("  /kiro-impl a --review off")).toBe(
            "kiro-impl",
        )
    })

    it("returns null when the command is not leading or is not a kiro command", () => {
        expect(parseKiroCommand("依頼 /kiro-discovery")).toBeNull()
        expect(parseKiroCommand("/init")).toBeNull()
        expect(parseKiroCommand("")).toBeNull()
    })
})

describe("Pre-tool-use decisions while the required document is unread", () => {
    const state = startState({
        command: "kiro-discovery",
        skillPath: skill,
        now: 1,
    })

    it("does not block sessions without a kiro command", () => {
        expect(decidePreToolUse(null, "Bash", {}, cwd)).toBeNull()
        expect(
            decidePreToolUse(
                { active: false, required: [skill], read: [] },
                "Bash",
                {},
                cwd,
            ),
        ).toBeNull()
    })

    it("denies Bash, Edit, and Glob while the document is unread", () => {
        expect(
            decidePreToolUse(state, "Bash", { command: "ls" }, cwd),
        ).toContain("先に Read")
        expect(decidePreToolUse(state, "Edit", {}, cwd)).toContain("先に Read")
        expect(decidePreToolUse(state, "Glob", {}, cwd)).toContain("先に Read")
    })

    it("denies reads of files other than the required document", () => {
        expect(
            decidePreToolUse(
                state,
                "Read",
                { file_path: path.join(repoRoot, "CLAUDE.md") },
                cwd,
            ),
        ).not.toBeNull()
    })

    it("allows reading the required document and using ToolSearch", () => {
        expect(
            decidePreToolUse(state, "Read", { file_path: skill }, cwd),
        ).toBeNull()
        expect(
            decidePreToolUse(state, "ToolSearch", { query: "x" }, cwd),
        ).toBeNull()
    })

    it("resolves a relative document path from cwd and allows the read", () => {
        const rel = path.relative(repoRoot, skill)
        expect(
            decidePreToolUse(state, "Read", { file_path: rel }, repoRoot),
        ).toBeNull()
    })

    it("does not block tools after the document has been read", () => {
        const read = markRead(state, "Read", { file_path: skill }, cwd)
        expect(unreadRequired(read)).toEqual([])
        expect(
            decidePreToolUse(read, "Bash", { command: "ls" }, cwd),
        ).toBeNull()
    })
})

describe("Read tracking", () => {
    const state = startState({
        command: "kiro-discovery",
        skillPath: skill,
        now: 1,
    })

    it("records a read of the required document", () => {
        const next = markRead(state, "Read", { file_path: skill }, cwd)
        expect(next.read).toEqual([path.resolve(skill)])
    })

    it("leaves state unchanged for other reads and non-Read tools", () => {
        expect(
            markRead(
                state,
                "Read",
                { file_path: path.join(repoRoot, "CLAUDE.md") },
                cwd,
            ),
        ).toBe(state)
        expect(markRead(state, "Bash", { file_path: skill }, cwd)).toBe(state)
    })

    it("records repeated reads of the same document only once", () => {
        const once = markRead(state, "Read", { file_path: skill }, cwd)
        expect(markRead(once, "Read", { file_path: skill }, cwd)).toBe(once)
    })
})

describe("Latest roadmap entries", () => {
    it("returns only names from the last Specs (dependency order) section", () => {
        const text = [
            "# Roadmap",
            "## Specs (dependency order)",
            "- [ ] old-a -- 古い節。Dependencies: none",
            "## Phase 2",
            "### Specs (dependency order)",
            "- [ ] new-a -- 説明。Dependencies: none",
            "- [x] new-b -- 説明。Dependencies: new-a",
            "### 既知の論点",
            "- [ ] not-a-spec -- 節の外",
        ].join("\n")
        expect(newestSpecNames(text)).toEqual(["new-a", "new-b"])
    })

    it("returns an empty list when the section is absent", () => {
        expect(newestSpecNames("# Roadmap\n- [ ] x -- y")).toEqual([])
    })
})

describe("Brief file checks", () => {
    it("returns names whose brief.md file is missing", () => {
        const root = makeRoot()
        writeFile(path.join(root, ".kiro/specs/a/brief.md"), "# Brief")
        expect(missingBriefs(root, ["a", "b"])).toEqual(["b"])
    })
})

describe("Stop decisions", () => {
    const state = startState({
        command: "kiro-discovery",
        skillPath: skill,
        now: 1000,
    })
    const readState = markRead(state, "Read", { file_path: skill }, cwd)
    const roadmapText =
        "## Specs (dependency order)\n- [ ] alpha -- x. Dependencies: none\n"

    it("allows the stop event when stop_hook_active is true", () => {
        expect(
            decideStop({
                state,
                stopHookActive: true,
                root: repoRoot,
                roadmapMtimeMs: null,
                roadmapText: "",
            }),
        ).toBeNull()
    })

    it("blocks the stop event while the required document is unread", () => {
        const reason = decideStop({
            state,
            stopHookActive: false,
            root: repoRoot,
            roadmapMtimeMs: null,
            roadmapText: "",
        })
        expect(reason).toContain("Read していません")
    })

    it("blocks when the roadmap changes during the session and a brief is missing", () => {
        const root = makeRoot()
        const reason = decideStop({
            state: readState,
            stopHookActive: false,
            root,
            roadmapMtimeMs: 2000,
            roadmapText,
        })
        expect(reason).toContain("alpha")
    })

    it("allows the stop event when the roadmap has not changed since the session began", () => {
        const root = makeRoot()
        expect(
            decideStop({
                state: readState,
                stopHookActive: false,
                root,
                roadmapMtimeMs: 500,
                roadmapText,
            }),
        ).toBeNull()
    })

    it("allows the stop event when all brief files exist", () => {
        const root = makeRoot()
        writeFile(path.join(root, ".kiro/specs/alpha/brief.md"), "# Brief")
        expect(
            decideStop({
                state: readState,
                stopHookActive: false,
                root,
                roadmapMtimeMs: 2000,
                roadmapText,
            }),
        ).toBeNull()
    })

    it("allows the stop event for sessions without a kiro command", () => {
        expect(
            decideStop({
                state: null,
                stopHookActive: false,
                root: repoRoot,
                roadmapMtimeMs: null,
                roadmapText: "",
            }),
        ).toBeNull()
    })
})

describe("Spec summaries", () => {
    it("returns one line for each phase and approval state", () => {
        const root = makeRoot()
        writeFile(
            path.join(root, ".kiro/specs/alpha/spec.json"),
            JSON.stringify({
                phase: "tasks-approved",
                approvals: {
                    requirements: { approved: true },
                    design: { approved: true },
                    tasks: { approved: false },
                },
            }),
        )
        const lines = summarizeSpecs(root)
        expect(lines).toEqual([
            "- alpha: tasks-approved（要件 済・設計 済・タスク 未）",
        ])
    })

    it("reports when no specs are present", () => {
        expect(summarizeSpecs(makeRoot())).toEqual(["（.kiro/specs が無い）"])
    })
})

describe("Skill document path", () => {
    it("returns the .claude/skills/<name>/SKILL.md path", () => {
        expect(skillPathFor(repoRoot, "kiro-review")).toBe(
            path.join(repoRoot, ".claude/skills/kiro-review/SKILL.md"),
        )
    })
})

describe("Hook entry point in a child process", () => {
    const entry = path.join(repoRoot, "scripts/agent/kiro-gate.mjs")
    const sessionId = `vitest-${process.pid}-${Date.now()}`
    const run = (event: string, input: object) =>
        spawnSync(process.execPath, [entry, event], {
            input: JSON.stringify({
                session_id: sessionId,
                cwd: repoRoot,
                ...input,
            }),
            encoding: "utf8",
        })

    afterAll(() => {
        const stateFile = path.join(
            os.tmpdir(),
            "skyshare-kiro-gate",
            `${sessionId}.json`,
        )
        fs.rmSync(stateFile, { force: true })
        for (const root of tmpRoots)
            fs.rmSync(root, { recursive: true, force: true })
    })

    it("blocks prompts for missing skills and recommends installing cc-sdd", () => {
        const out = run("user-prompt-submit", {
            prompt: "/kiro-no-such-command",
        })
        expect(out.status).toBe(0)
        const parsed = JSON.parse(out.stdout)
        expect(parsed.decision).toBe("block")
        expect(parsed.reason).toContain("cc-sdd が導入されていません")
        expect(parsed.reason).toContain(
            "scripts/agent/install-cc-sdd.sh --claude",
        )
    })

    it.skipIf(!fs.existsSync(skill))(
        "prompts kiro-discovery to read its skill and denies Bash until it is read",
        () => {
            const prompt = run("user-prompt-submit", {
                prompt: "/kiro-discovery テスト",
            })
            expect(prompt.stdout).toContain(skill)

            const denied = run("pre-tool-use", {
                tool_name: "Bash",
                tool_input: { command: "ls" },
            })
            const parsed = JSON.parse(denied.stdout)
            expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny")

            const stopBlocked = run("stop", { stop_hook_active: false })
            expect(JSON.parse(stopBlocked.stdout).decision).toBe("block")

            run("post-tool-use", {
                tool_name: "Read",
                tool_input: { file_path: skill },
            })
            const allowed = run("pre-tool-use", {
                tool_name: "Bash",
                tool_input: { command: "ls" },
            })
            expect(allowed.stdout).toBe("")
        },
    )

    it("handles invalid input without throwing and exits with code 0", () => {
        const out = spawnSync(process.execPath, [entry, "no-such-event"], {
            input: "{}",
            encoding: "utf8",
        })
        expect(out.status).toBe(0)
        expect(out.stderr).toContain("未知のイベント")
    })
})
