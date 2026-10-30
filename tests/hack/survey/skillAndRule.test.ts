/**
 * アンケート運用スキルと取り込み前の除去ルールを Git に保つ検査。
 *
 * 責務と処理概要:
 * - survey-run スキルが存在し、Git の無視対象でないことを確かめる。
 * - workflow の main 取り込み前ルールが prune と運用スキルを参照することを確かめる。
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { parseDocument } from "yaml"
import { describe, expect, it } from "vitest"

const skillPath = ".claude/skills/survey-run/SKILL.md"
const codexSkillPath = ".agents/skills/survey-run/SKILL.md"
const workflowPath = "DEVELOP.md"

const readSkill = (skill: string) => {
    const match = skill.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
    expect(match, "frontmatter は独立した --- 行で囲む").not.toBeNull()
    const body = match?.[2] ?? ""
    expect(body.trim(), "スキル本文は空でない").not.toBe("")

    const document = parseDocument(match?.[1] ?? "", { uniqueKeys: true })
    expect(document.errors, "frontmatter は重複キーのない有効な YAML").toEqual(
        [],
    )
    const metadata = document.toJS() as Record<string, unknown>
    expect(metadata).toEqual({
        name: expect.any(String),
        description: expect.any(String),
    })
    expect(metadata.name).toBe("survey-run")
    expect((metadata.name as string).trim()).not.toBe("")
    expect(typeof metadata.description).toBe("string")
    expect((metadata.description as string).trim()).not.toBe("")
    return { metadata, body }
}

describe("アンケートの運用手順", () => {
    it.each([skillPath, codexSkillPath])(
        "[survey-operation/4.1] %s が存在する",
        path => {
            expect(existsSync(path)).toBe(true)
        },
    )

    it.each([skillPath, codexSkillPath])(
        "[survey-operation/4.1] %s は Git の無視対象でない",
        path => {
            const result = spawnSync("git", ["check-ignore", "--quiet", path])
            // git check-ignore は、無視対象なら 0、対象外なら 1 を返す。
            expect(result.error).toBeUndefined()
            expect(result.status).toBe(1)
        },
    )

    it("[survey-operation/4.1] workflow が main 前の prune と運用スキルを参照する", () => {
        const workflow = readFileSync(workflowPath, "utf8")
        const releaseRule = workflow.split(
            "## main への取り込み前のアンケート除去",
        )[1]

        expect(workflow).toMatch(/^## main への取り込み前のアンケート除去$/m)
        expect(releaseRule).toContain("npm run survey -- prune")
        expect(releaseRule).toContain(skillPath)
        expect(releaseRule).toContain(codexSkillPath)
    })

    it("[survey-operation/4.1] 両スキルの frontmatter を構造的に検証する", () => {
        const skill = readFileSync(skillPath, "utf8")
        const claude = readSkill(skill)
        const codex = readSkill(readFileSync(codexSkillPath, "utf8"))

        expect(claude.metadata.description).toMatch(
            /アンケート.*(?:実施|追加|修正|状態確認).*main への取り込み前/,
        )
        expect(codex.metadata.description).toMatch(
            /アンケート.*(?:実施|追加|修正|状態確認).*main への取り込み前/,
        )
        expect(codex.metadata).toEqual(claude.metadata)
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
            "npm run survey -- prune",
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
            "開始は初回登録時に自動設定され",
            "更新では既存の開始日時が保持される",
        ]) {
            expect(claude.body).toContain(phrase)
        }
    })

    it.each([
        ["区切りがない", "name: survey-run\ndescription: valid\n\nbody"],
        [
            "不正な YAML",
            "---\nname: [survey-run\ndescription: valid\n---\nbody",
        ],
        [
            "重複キー",
            "---\nname: survey-run\nname: other\ndescription: valid\n---\nbody",
        ],
        [
            "想定外のキー",
            "---\nname: survey-run\ndescription: valid\nextra: value\n---\nbody",
        ],
        ["空の値", "---\nname: survey-run\ndescription: \n---\nbody"],
        ["空の本文", "---\nname: survey-run\ndescription: valid\n---\n  \n"],
    ])(
        "[survey-operation/4.1] %s のスキル文書を拒否する",
        (_case, malformed) => {
            expect(() => readSkill(malformed)).toThrow()
        },
    )
})
