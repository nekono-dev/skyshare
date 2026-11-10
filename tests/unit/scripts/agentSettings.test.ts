/**
 * Claude の設定と導入の呼び出しを、読み取りだけで確かめる。
 * BRW の宣言、導入の引数、Codex 向け導入物の不在。
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { repoRoot } from "../../../scripts/agent/kiro-gate.mjs"

const readJson = (relative: string): any =>
    JSON.parse(fs.readFileSync(path.join(repoRoot, relative), "utf8"))

const sessionStartCommands = (settings: any): string[] =>
    (settings.hooks?.SessionStart ?? []).flatMap((group: any) =>
        (group.hooks ?? []).map((hook: any) => String(hook.command)),
    )

describe("プロジェクトの Claude 設定（BRW の有効化）", () => {
    const settings = readJson(".claude/settings.json")

    it("marketplace の宣言（nekono-dev → GitHub の nekono-dev/claude-plugins）を持つ", () => {
        expect(settings.extraKnownMarketplaces?.["nekono-dev"]?.source).toEqual(
            {
                source: "github",
                repo: "nekono-dev/claude-plugins",
            },
        )
    })

    it("branch-release-workflow@nekono-dev を有効にする", () => {
        expect(
            settings.enabledPlugins?.["branch-release-workflow@nekono-dev"],
        ).toBe(true)
    })

    it("SessionStart に、利用者の marketplace を入れ替える呼び出し（setup-brw --install）が無い", () => {
        const commands = sessionStartCommands(settings)
        expect(commands.some(command => command.includes("setup-brw"))).toBe(
            false,
        )
    })

    it("SessionStart の cc-sdd の導入は --claude だけを呼ぶ", () => {
        const commands = sessionStartCommands(settings)
        const installs = commands.filter(command =>
            command.includes("install-cc-sdd.sh"),
        )
        expect(installs).toHaveLength(1)
        expect(installs[0]).toMatch(/install-cc-sdd\.sh" --claude$/)
    })
})

describe("Codex 向けの導入の取り消し", () => {
    it(".codex/hooks.json が無い（Codex の SessionStart で導入しない）", () => {
        expect(fs.existsSync(path.join(repoRoot, ".codex/hooks.json"))).toBe(
            false,
        )
    })

    it("AGENTS.md と .codex/agents/ が無い", () => {
        expect(fs.existsSync(path.join(repoRoot, "AGENTS.md"))).toBe(false)
        expect(fs.existsSync(path.join(repoRoot, ".codex/agents"))).toBe(false)
    })
})
