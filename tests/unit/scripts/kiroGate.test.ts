/**
 * kiro ワークフローのゲート（scripts/agent/kiro-gate.mjs）の単体テストと、フックの入口の確認。
 *
 * 責務と処理概要:
 * - スラッシュコマンドの検出、未読の手順書に対する deny、Read の記録、終了の判定を、純粋な関数で確かめる。
 * - roadmap の新規 spec（最後の「Specs (dependency order)」節）と brief.md の判定を、一時ディレクトリで確かめる。
 * - 実際のフックの入口（標準入力の JSON → 標準出力の判定）を子プロセスで確かめる。
 *   手順書（.claude/skills/kiro-discovery/SKILL.md）は cc-sdd の導入物で .gitignore 対象のため、
 *   無い環境（CI など）では手順書を使う確認だけを飛ばす。
 *
 * 実装上の制約:
 * - 一時ファイルは `fs.mkdtempSync` で作り、テストの後に削除する。
 * - 子プロセスの状態は OS の一時ディレクトリに残るため、テストの後に削除する。
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
    it("先頭のスラッシュコマンドの名前を返す", () => {
        expect(parseKiroCommand("/kiro-discovery 依頼の内容")).toBe(
            "kiro-discovery",
        )
        expect(parseKiroCommand("  /kiro-impl a --review off")).toBe(
            "kiro-impl",
        )
    })

    it("先頭に無い、または kiro でない入力は null", () => {
        expect(parseKiroCommand("依頼 /kiro-discovery")).toBeNull()
        expect(parseKiroCommand("/init")).toBeNull()
        expect(parseKiroCommand("")).toBeNull()
    })
})

describe("手順書が未読の間の deny（decidePreToolUse）", () => {
    const state = startState({
        command: "kiro-discovery",
        skillPath: skill,
        now: 1,
    })

    it("kiro コマンドでないセッションは何も止めない", () => {
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

    it("未読の間は Bash・Edit・Glob を deny する", () => {
        expect(
            decidePreToolUse(state, "Bash", { command: "ls" }, cwd),
        ).toContain("先に Read")
        expect(decidePreToolUse(state, "Edit", {}, cwd)).toContain("先に Read")
        expect(decidePreToolUse(state, "Glob", {}, cwd)).toContain("先に Read")
    })

    it("手順書以外の Read は deny する", () => {
        expect(
            decidePreToolUse(
                state,
                "Read",
                { file_path: path.join(repoRoot, "CLAUDE.md") },
                cwd,
            ),
        ).not.toBeNull()
    })

    it("手順書の Read と ToolSearch は許可する", () => {
        expect(
            decidePreToolUse(state, "Read", { file_path: skill }, cwd),
        ).toBeNull()
        expect(
            decidePreToolUse(state, "ToolSearch", { query: "x" }, cwd),
        ).toBeNull()
    })

    it("相対パスの手順書の Read も、cwd を基準に解決して許可する", () => {
        const rel = path.relative(repoRoot, skill)
        expect(
            decidePreToolUse(state, "Read", { file_path: rel }, repoRoot),
        ).toBeNull()
    })

    it("手順書を読んだ後は止めない", () => {
        const read = markRead(state, "Read", { file_path: skill }, cwd)
        expect(unreadRequired(read)).toEqual([])
        expect(
            decidePreToolUse(read, "Bash", { command: "ls" }, cwd),
        ).toBeNull()
    })
})

describe("Read の記録（markRead）", () => {
    const state = startState({
        command: "kiro-discovery",
        skillPath: skill,
        now: 1,
    })

    it("手順書の Read を記録する", () => {
        const next = markRead(state, "Read", { file_path: skill }, cwd)
        expect(next.read).toEqual([path.resolve(skill)])
    })

    it("手順書以外の Read、Read 以外のツールは状態を変えない", () => {
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

    it("同じ手順書を二度読んでも記録は一つ", () => {
        const once = markRead(state, "Read", { file_path: skill }, cwd)
        expect(markRead(once, "Read", { file_path: skill }, cwd)).toBe(once)
    })
})

describe("roadmap の新規 spec（newestSpecNames）", () => {
    it("最後の「Specs (dependency order)」節の名前だけを返す", () => {
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

    it("節が無ければ空", () => {
        expect(newestSpecNames("# Roadmap\n- [ ] x -- y")).toEqual([])
    })
})

describe("brief.md の判定（missingBriefs）", () => {
    it("brief.md が無い spec の名前だけを返す", () => {
        const root = makeRoot()
        writeFile(path.join(root, ".kiro/specs/a/brief.md"), "# Brief")
        expect(missingBriefs(root, ["a", "b"])).toEqual(["b"])
    })
})

describe("終了の判定（decideStop）", () => {
    const state = startState({
        command: "kiro-discovery",
        skillPath: skill,
        now: 1000,
    })
    const readState = markRead(state, "Read", { file_path: skill }, cwd)
    const roadmapText =
        "## Specs (dependency order)\n- [ ] alpha -- x. Dependencies: none\n"

    it("stop_hook_active が真なら通す", () => {
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

    it("手順書が未読なら止める", () => {
        const reason = decideStop({
            state,
            stopHookActive: false,
            root: repoRoot,
            roadmapMtimeMs: null,
            roadmapText: "",
        })
        expect(reason).toContain("Read していません")
    })

    it("roadmap がセッション中に更新され brief.md が無ければ止める", () => {
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

    it("roadmap がセッション前から変わっていなければ通す", () => {
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

    it("brief.md が揃っていれば通す", () => {
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

    it("kiro コマンドでないセッションは通す", () => {
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

describe("spec の要約（summarizeSpecs）", () => {
    it("phase と承認の状態を一行ずつ返す", () => {
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

    it("spec が無ければその旨を返す", () => {
        expect(summarizeSpecs(makeRoot())).toEqual(["（.kiro/specs が無い）"])
    })
})

describe("手順書の場所（skillPathFor）", () => {
    it(".claude/skills/<名前>/SKILL.md を返す", () => {
        expect(skillPathFor(repoRoot, "kiro-review")).toBe(
            path.join(repoRoot, ".claude/skills/kiro-review/SKILL.md"),
        )
    })
})

describe("フックの入口（子プロセス）", () => {
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

    it("SKILL.md が無いスラッシュコマンドは、プロンプトをブロックし、cc-sdd の導入を促す", () => {
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
        "kiro-discovery で手順書の Read を促し、未読の間の Bash を deny する",
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

    it("不正な入力でも例外で止まらず、終了コード 0 で通す", () => {
        const out = spawnSync(process.execPath, [entry, "no-such-event"], {
            input: "{}",
            encoding: "utf8",
        })
        expect(out.status).toBe(0)
        expect(out.stderr).toContain("未知のイベント")
    })
})
