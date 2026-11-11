/**
 * Codex の MCP の登録と設定の試験。
 * .mcp.json の登録、.codex/config.toml の値、個人の承認（.claude/settings.local.json）を確かめる。
 * CLAUDE.md の試験は、後続のタスクで追加する。
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve(__dirname, "../../..")
const read = (relative: string): string =>
    fs.readFileSync(path.join(root, relative), "utf8")

describe("mcp registration", () => {
    it("parses .mcp.json as a JSON object", () => {
        const parsed = JSON.parse(read(".mcp.json"))
        expect(typeof parsed).toBe("object")
        expect(parsed).not.toBeNull()
        expect(parsed).toHaveProperty("mcpServers.codex")
    })

    it("registers codex as a stdio server launched through sh -c", () => {
        const server = JSON.parse(read(".mcp.json")).mcpServers.codex
        expect(server.type).toBe("stdio")
        expect(server.command).toBe("sh")
        expect(server.args[0]).toBe("-c")
        expect(server.args[1]).toContain("git rev-parse --show-toplevel")
        expect(server.args[1]).toContain("scripts/agent/codex-mcp-server.mjs")
        expect(server.args[1]).toContain("exec node")
    })

    it("points at a script path that exists in the repository", () => {
        expect(
            fs.existsSync(
                path.join(root, "scripts/agent/codex-mcp-server.mjs"),
            ),
        ).toBe(true)
    })
})

describe("codex project config", () => {
    // 行単位で読む。値は引用符を含む生の文字列のまま比べる。
    // セクションの無い行は "key"、[sandbox_workspace_write] の下は "sandbox_workspace_write.key" として持つ。
    const parseEntries = (text: string): Record<string, string> => {
        const entries: Record<string, string> = {}
        let section = ""
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim()
            if (line === "" || line.startsWith("#")) continue
            const header = /^\[([A-Za-z0-9_.-]+)\]$/.exec(line)
            if (header) {
                section = header[1]
                continue
            }
            const pair = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line)
            if (pair) {
                const key = section ? `${section}.${pair[1]}` : pair[1]
                entries[key] = pair[2].trim()
            }
        }
        return entries
    }

    const config = (): string => read(".codex/config.toml")

    it("holds exactly the five required values and nothing else", () => {
        expect(parseEntries(config())).toEqual({
            model: '"gpt-6-luna"',
            model_reasoning_effort: '"medium"',
            approval_policy: '"never"',
            sandbox_mode: '"workspace-write"',
            "sandbox_workspace_write.network_access": "false",
        })
    })

    it("sets network_access = false under the sandbox_workspace_write header", () => {
        const lines = config()
            .split(/\r?\n/)
            .map(line => line.trim())
        const headerIndex = lines.indexOf("[sandbox_workspace_write]")
        expect(headerIndex).toBeGreaterThanOrEqual(0)
        const following = lines.slice(headerIndex + 1).find(line => line !== "")
        expect(following).toBe("network_access = false")
    })

    it("does not contain approvals_reviewer anywhere", () => {
        expect(config()).not.toContain("approvals_reviewer")
    })
})

describe("personal approval", () => {
    // 個人の承認は追跡しないファイルに置く。このファイルは別のマシンには無いことがあるため、
    // 無い場合は該当の項目を飛ばす（失敗にしない）。
    const personalPath = path.join(root, ".claude/settings.local.json")
    const hasPersonalFile = fs.existsSync(personalPath)

    it.skipIf(!hasPersonalFile)(
        "enables the codex MCP server in .claude/settings.local.json (skipped when the personal file is absent)",
        () => {
            const parsed = JSON.parse(read(".claude/settings.local.json"))
            expect(Array.isArray(parsed.enabledMcpjsonServers)).toBe(true)
            const codexCount = parsed.enabledMcpjsonServers.filter(
                (name: unknown) => name === "codex",
            ).length
            expect(codexCount).toBe(1)
        },
    )

    it("ignores the personal settings file through the repository gitignore", () => {
        // 個人のグローバル除外（~/.config/git/ignore など）に頼らないよう core.excludesFile を無効にし、
        // リポジトリの .gitignore の規則だけで無視されていることを確かめる。
        const result = spawnSync(
            "git",
            [
                "-c",
                "core.excludesFile=/dev/null",
                "check-ignore",
                "-v",
                ".claude/settings.local.json",
            ],
            { cwd: root, encoding: "utf8" },
        )
        expect(result.status).toBe(0)
        expect(result.stdout).toMatch(
            /^\.gitignore:\d+:.*\.claude\/settings\.local\.json/,
        )
    })

    it("keeps the codex approval out of the tracked .claude/settings.json", () => {
        const shared = JSON.parse(read(".claude/settings.json"))
        const servers: unknown = shared.enabledMcpjsonServers ?? []
        expect(Array.isArray(servers) ? servers : []).not.toContain("codex")
    })
})

describe("delegation policy", () => {
    const heading = "## Codex as a Child Agent (MCP)"
    const claudeMd = (): string => read("CLAUDE.md")
    // 見出しの行から、ファイルの末尾までを節とする
    const section = (): string => {
        const lines = claudeMd().split(/\r?\n/)
        const index = lines.indexOf(heading)
        return index < 0 ? "" : lines.slice(index).join("\n")
    }

    it("has the exact section heading as its own line in CLAUDE.md", () => {
        const lines = claudeMd().split(/\r?\n/)
        expect(lines.filter(line => line === heading)).toHaveLength(1)
    })

    it("covers thinking-heavy work beyond review", () => {
        const body = section()
        expect(body).toMatch(/not limited to review/i)
        expect(body).toMatch(/root-cause/i)
        expect(body).toMatch(/broad exploration/i)
    })

    it("requires proactive delegation before doing the work directly", () => {
        expect(section()).toMatch(/before (doing|starting) the work directly/i)
    })

    it("forbids self-review and assigns independent review to codex_exec", () => {
        const body = section()
        expect(body).toMatch(/self-review/i)
        expect(body).toMatch(/independent review/i)
        expect(body).toContain("codex_exec")
    })

    it("orders parallel read-only calls and one-at-a-time write calls", () => {
        const body = section()
        expect(body).toMatch(/in parallel/i)
        expect(body).toMatch(/one at a time/i)
        expect(body).toMatch(/read-only/)
        expect(body).toMatch(/warning/i)
    })

    it("requires reporting delegation and lists the direct-work exceptions", () => {
        const body = itemText(5)
        expect(body).toMatch(/report/i)
        expect(body).toMatch(/mechanical/i)
        expect(body).toContain("spec.json")
        expect(body).toMatch(/git operations/i)
        expect(body).toMatch(/secrets?/i)
        expect(body).toMatch(/destructive/i)
        expect(body).toMatch(/explicitly approved/i)
    })

    it("describes the CLI fallback, scratchpad prompt file, and plan-limit rule in item 6", () => {
        const body = itemText(6)
        expect(body).toContain("codex -a never exec --sandbox")
        expect(body).toMatch(/scratchpad/i)
        expect(body).toContain("/tmp")
        expect(body).toMatch(/plan limit/i)
        expect(body).toMatch(/usage or billing limit/i)
        expect(body).toMatch(/do not delegate/i)
    })

    it("chooses Codex models by sandbox and Claude subagent models by kind of work", () => {
        expect(itemText(4)).toContain("gpt-6.1-sol")
        expect(itemText(4)).toContain("gpt-6-luna")
        expect(itemText(6)).toContain("--model")
        expect(itemText(9)).toContain('model: "sonnet"')
        expect(itemText(9)).toContain('model: "haiku"')
    })

    it("waits for the preceding write call before the CLI fallback when the wait limit is hit", () => {
        const body = itemText(6)
        expect(body).toMatch(/wait limit|wait-limit/i)
        expect(body).toMatch(/preceding write/i)
    })

    it("sets the sandbox per call and does not fix it to read-only", () => {
        const body = section()
        expect(body).toMatch(/per call/i)
        expect(body).toMatch(/Do not fix the sandbox to read-only/)
        expect(body).toContain("workspace-write")
    })

    it("writes prompts that are self-contained and copies only needed project rules", () => {
        const body = section()
        expect(body).toMatch(/self-contained/i)
        expect(body).toMatch(/whole conversation/i)
        expect(body).toMatch(/absolute/i)
        expect(body).toContain("AGENTS.md")
    })

    it("names write directories only for requests that may write", () => {
        const body = itemText(7)
        expect(body).toContain(
            "Name the directories Codex may read; for a request that may write, also name the directories it may write.",
        )
    })

    it("forbids Codex from committing, pushing, branching, or changing spec.json approval in item 7", () => {
        const body = itemText(7)
        expect(body).toMatch(/commit/i)
        expect(body).toMatch(/push/i)
        expect(body).toMatch(/branch/i)
        expect(body).toMatch(/spec\.json/)
        expect(body).toMatch(/approval/i)
    })

    it("requires verification with git diff and kiro-verify-completion", () => {
        const body = section()
        expect(body).toMatch(/unverified/i)
        expect(body).toContain("git diff")
        expect(body).toContain("kiro-verify-completion")
    })

    it("covers environments without codex_exec and checks the tool list first", () => {
        expect(section()).toContain("codex_exec")
        expect(section()).toMatch(/tool list/i)
        expect(itemText(9)).toMatch(/cloud/i)
    })

    // 番号付きの項目（例: "4. **..."）の本文を取り出す。次の項目の直前までを範囲とする
    const itemText = (n: number): string => {
        const lines = section().split("\n")
        const start = lines.findIndex(line => line.startsWith(`${n}. **`))
        if (start < 0) return ""
        const end = lines.findIndex(
            (line, i) => i > start && line.startsWith(`${n + 1}. **`),
        )
        return lines.slice(start, end < 0 ? undefined : end).join("\n")
    }
    // 委譲してはならない作業の段落。項目 1 の末尾から項目 2 の直前までを範囲とする
    const doNotDelegate = (): string => {
        const body = section()
        const start = body.indexOf("Do not delegate the following")
        const end = body.indexOf("\n2. **")
        return start < 0 || end < 0 ? "" : body.slice(start, end)
    }

    it("lists the work that must not be delegated to Codex", () => {
        const span = doNotDelegate()
        expect(span).not.toBe("")
        expect(span).toMatch(/decisions?|approvals?/i)
        expect(span).toMatch(/destructive/i)
        expect(span).toMatch(/reset/i)
        expect(span).toMatch(/forced deletion/i)
        expect(span).toMatch(/volumes?/i)
        expect(span).toMatch(/external systems?/i)
        expect(span).toMatch(/secrets|credentials/i)
    })

    it("excludes the do-not-delegate list from the delegation duty in item 1", () => {
        expect(itemText(1)).toMatch(
            /except the work in the do-not-delegate list/i,
        )
    })

    it("states the parallel read-only rule with shall-level wording", () => {
        const body = itemText(4)
        expect(body).toContain("must be sent in the same turn")
        expect(body).toMatch(/read-only/)
        expect(body).toMatch(/never sent in parallel|sent one at a time/i)
        expect(section()).not.toMatch(/may be sent in parallel/)
    })

    it("makes the direct-work list an explicit exception to delegation", () => {
        const body = itemText(5)
        expect(body).toContain(
            "Work directly without delegation in these cases:",
        )
        expect(body).toMatch(/items? 6 and 9/)
        expect(body).not.toContain("Direct work is allowed only for:")
        expect(body).not.toContain("Work directly without delegation only for")
    })

    it("states that destructive and external operations need explicit user approval before they are done", () => {
        const body = itemText(1)
        expect(body).toContain(
            "Destructive operations and operations that act on external systems are not delegated and are not done without explicit approval from the user; ask the user first, and do them yourself only after the user approves them.",
        )
    })

    it("does not stop work on a client-side time limit while waiting for a response", () => {
        const body = itemText(2)
        expect(body).toMatch(/time limit/i)
        expect(body).toMatch(/not a reason to stop/i)
        expect(body).toContain("10 minutes")
        expect(body).toContain("2 minutes")
    })

    it("defines when Codex is not usable in item 9", () => {
        const body = itemText(9)
        expect(body).toContain("Codex is not usable")
        expect(body).toContain("`codex` executable")
        expect(body).toMatch(/plan limit/i)
        expect(body).toContain("do not stop")
        expect(body).toMatch(/cloud/i)
        expect(body).not.toMatch(/tool list/i)
    })

    it("names the CLI command with -a never exec before exec in item 6", () => {
        expect(itemText(6)).toContain("codex -a never exec --sandbox")
    })

    it("routes a missing codex_exec through the cause check in item 6, not straight to item 9", () => {
        const body = section()
        expect(body).not.toContain("skip the delegation duty")
        expect(body).toContain("find the cause as described in item 6")
        expect(body).toMatch(
            /Only when Codex cannot be used at all, follow item 9/,
        )
    })

    it("contains no Japanese characters anywhere in CLAUDE.md", () => {
        const japanese = /[぀-ゟ゠-ヿ一-鿿　-〿＀-￯]/
        expect(claudeMd()).not.toMatch(japanese)
    })

    it("keeps the existing top-level sections", () => {
        expect(claudeMd()).toContain(
            "# Agentic SDLC and Spec-Driven Development",
        )
        expect(claudeMd()).toContain("## Session Initialization Rules")
    })
})

describe("user prompt hooks", () => {
    type HookEntry = { type: string; command: string; timeout?: number }
    type Settings = {
        hooks: Record<string, Array<{ matcher?: string; hooks: HookEntry[] }>>
    }

    const settings = (): Settings => JSON.parse(read(".claude/settings.json"))
    const commandsOf = (event: string): string[] =>
        (settings().hooks[event] ?? []).flatMap(group =>
            group.hooks.map(hook => hook.command),
        )

    const installGate =
        'node "$CLAUDE_PROJECT_DIR/scripts/agent/install-gate.mjs" user-prompt-submit'
    const kiroGate =
        'node "$CLAUDE_PROJECT_DIR/scripts/agent/kiro-gate.mjs" user-prompt-submit'
    const codexTrustGate =
        'node "$CLAUDE_PROJECT_DIR/scripts/agent/codex-trust-gate.mjs" user-prompt-submit'

    it("registers the codex-trust-gate entry with the exact command and timeout 10 under UserPromptSubmit", () => {
        const entries = (settings().hooks.UserPromptSubmit ?? []).flatMap(
            group => group.hooks,
        )
        const matched = entries.filter(hook => hook.command === codexTrustGate)
        expect(matched).toHaveLength(1)
        expect(matched[0].type).toBe("command")
        expect(matched[0].timeout).toBe(10)
    })

    it("keeps the install-gate and kiro-gate entries in the same order and places codex-trust-gate after them", () => {
        expect(commandsOf("UserPromptSubmit")).toEqual([
            installGate,
            kiroGate,
            codexTrustGate,
        ])
    })

    it("does not change the commands of the other hook events", () => {
        expect(commandsOf("SessionStart")).toEqual([
            '"$CLAUDE_PROJECT_DIR/scripts/agent/install-cc-sdd.sh" --claude',
            'node "$CLAUDE_PROJECT_DIR/scripts/agent/ensure-brw-plugin.mjs"',
            "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh",
            'node "$CLAUDE_PROJECT_DIR/scripts/agent/kiro-gate.mjs" session-start',
        ])
        expect(commandsOf("PreToolUse")).toEqual([
            'node "$CLAUDE_PROJECT_DIR/scripts/agent/kiro-gate.mjs" pre-tool-use',
        ])
        expect(commandsOf("PostToolUse")).toEqual([
            'node "$CLAUDE_PROJECT_DIR/scripts/agent/kiro-gate.mjs" post-tool-use',
        ])
        expect(commandsOf("Stop")).toEqual([
            'node "$CLAUDE_PROJECT_DIR/scripts/agent/kiro-gate.mjs" stop',
        ])
    })

    it("has the codex-trust-gate script in scripts/agent", () => {
        expect(
            fs.existsSync(
                path.join(root, "scripts/agent/codex-trust-gate.mjs"),
            ),
        ).toBe(true)
    })
})
