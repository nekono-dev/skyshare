/**
 * アンケート運用スキルと取り込み前の除去ルールを Git に保つ検査。
 *
 * 責務と処理概要:
 * - survey-run スキルが存在し、Git の無視対象でないことを確かめる。
 * - workflow の main 取り込み前ルールが prune と運用スキルを参照することを確かめる。
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const skillPath = ".claude/skills/survey-run/SKILL.md"
const codexSkillPath = ".agents/skills/survey-run/SKILL.md"
const workflowPath = ".kiro/steering/workflow.md"

const readSkillMetadata = (skill: string) => {
    const match = skill.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    expect(match).not.toBeNull()
    return { metadata: match?.[1] ?? "", body: match?.[2] ?? "" }
}

describe("アンケートの運用手順", () => {
    it("[survey-operation/4.1] スキルが存在し、Git の無視対象でない", () => {
        expect(existsSync(skillPath)).toBe(true)

        const result = spawnSync("git", ["check-ignore", "--quiet", skillPath])
        // git check-ignore は、無視対象なら 0、対象外なら 1 を返す。
        expect(result.error).toBeUndefined()
        expect(result.status).toBe(1)
    })

    it("[survey-operation/4.1] workflow が main 前の prune と運用スキルを参照する", () => {
        const workflow = readFileSync(workflowPath, "utf8")

        expect(workflow).toMatch(/^## main への取り込み前のアンケート除去$/m)
        expect(workflow).toContain("npm run survey -- prune")
        expect(workflow).toContain(skillPath)
        expect(workflow).toContain(codexSkillPath)
    })

    it("[survey-operation/4.1] スキル文書が Git の作業ツリーで読める", () => {
        const skill = readFileSync(skillPath, "utf8")

        expect(skill).toContain("name: survey-run")
        expect(skill).toContain("アンケートの運用")
    })

    it("[survey-operation/3.2] Claude と Codex のスキルが同じ運用契約を持つ", () => {
        const claudeSkill = readFileSync(skillPath, "utf8")
        const codexSkill = readFileSync(codexSkillPath, "utf8")
        const claude = readSkillMetadata(claudeSkill)
        const codex = readSkillMetadata(codexSkill)

        expect(claude.metadata).toContain("name: survey-run")
        expect(codex.metadata).toBe(claude.metadata)
        expect(claude.metadata).toContain("main への取り込み前")
        expect(codex.metadata).toContain("main への取り込み前")
        expect(codex.body).toBe(claude.body)
        expect(claude.body).toContain("開始日時は尋ねない")
        expect(claude.body).toContain("実施期間について尋ねるのは、終了日時")
        expect(claude.body).toContain("必須のタイトル")
        expect(claude.body).toContain("開始は初回登録時に自動設定され")
        expect(claude.body).toContain("更新では既存の開始日時が保持される")
        expect(claude.body).toContain("明示的な確認を受けた後に限り")

        for (const phrase of [
            "npm run survey -- status",
            "npm run survey -- add --file",
            "npm run survey -- prune --dry-run",
            "SURVEY_CONFIG",
            "src/lib/i18n/locale.ts",
            "LOCALES",
            "開始日時",
            "初回登録時",
            "一時ファイル",
            "--dry-run",
            "kept",
            "unknown",
            "認証情報",
            "gh variable set",
        ]) {
            expect(claude.body).toContain(phrase)
        }
    })
})
