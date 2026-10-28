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
const workflowPath = ".kiro/steering/workflow.md"

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
    })

    it("[survey-operation/4.1] スキル文書が Git の作業ツリーで読める", () => {
        const skill = readFileSync(skillPath, "utf8")

        expect(skill).toContain("name: survey-run")
        expect(skill).toContain("アンケートの運用")
    })
})
