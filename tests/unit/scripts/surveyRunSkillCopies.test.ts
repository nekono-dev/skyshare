/**
 * survey-run の Claude 用と Codex 用の手順書が同一であることを検査する。
 *
 * - Codex 用複製を削除するときは、この検査も同時に削除する。
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(__dirname, "../../..")
const claudeSkill = readFileSync(
    path.join(repoRoot, ".claude/skills/survey-run/SKILL.md"),
)
const codexSkill = readFileSync(
    path.join(repoRoot, ".agents/skills/survey-run/SKILL.md"),
)

describe("survey-run の手順書", () => {
    it("Claude 用と Codex 用がバイト単位で一致する", () => {
        expect(Buffer.compare(codexSkill, claudeSkill)).toBe(0)
    })
})
