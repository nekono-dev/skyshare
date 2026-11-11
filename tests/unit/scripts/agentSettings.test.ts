/**
 * Checks Claude settings for BRW configuration and installer arguments.
 * Also verifies that Codex-specific installation files are absent.
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

describe("Project Claude settings enable BRW", () => {
    const settings = readJson(".claude/settings.json")

    it("declares the nekono-dev marketplace", () => {
        expect(settings.extraKnownMarketplaces?.["nekono-dev"]?.source).toEqual(
            {
                source: "github",
                repo: "nekono-dev/claude-plugins",
            },
        )
    })

    it("enables branch-release-workflow@nekono-dev", () => {
        expect(
            settings.enabledPlugins?.["branch-release-workflow@nekono-dev"],
        ).toBe(true)
    })

    it("does not replace the user's marketplace during SessionStart", () => {
        const commands = sessionStartCommands(settings)
        expect(commands.some(command => command.includes("setup-brw"))).toBe(
            false,
        )
    })

    it("installs cc-sdd with --claude during SessionStart", () => {
        const commands = sessionStartCommands(settings)
        const installs = commands.filter(command =>
            command.includes("install-cc-sdd.sh"),
        )
        expect(installs).toHaveLength(1)
        expect(installs[0]).toMatch(/install-cc-sdd\.sh" --claude$/)
    })
})

describe("Codex installation is disabled", () => {
    it("does not configure a Codex SessionStart hook", () => {
        expect(fs.existsSync(path.join(repoRoot, ".codex/hooks.json"))).toBe(
            false,
        )
    })

    it("does not create AGENTS.md or .codex/agents/", () => {
        expect(fs.existsSync(path.join(repoRoot, "AGENTS.md"))).toBe(false)
        expect(fs.existsSync(path.join(repoRoot, ".codex/agents"))).toBe(false)
    })
})
