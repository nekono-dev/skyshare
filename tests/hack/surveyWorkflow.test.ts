/**
 * アンケート設定の元の変数（SURVEY_CONFIG）の受け渡し先の検査。
 *
 * 責務と処理概要:
 * - ワークフロー定義を行ベースで工程（`- name:`）に分け、SURVEY_CONFIG を参照する工程が
 *   deploy.yaml と preview.yaml の "Run build" だけであることを確かめる。
 * - その工程が配備（wrangler deploy / wrangler preview）より前にあること、
 *   e2e.yaml と deploy.yaml の verify ジョブには SURVEY_CONFIG がないことを確かめる。
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "../..")

type Step = { name: string; body: string }

/**
 * ワークフローを工程ごとの本文に分ける（行ベース）。
 * Input: ワークフローのファイル名（.github/workflows 配下）
 * Output: 工程名と本文の配列。工程より前の部分は name を "(header)" として先頭に入れる
 * 例: steps("deploy.yaml") -> [{ name: "(header)", ... }, { name: "Run build", ... }, ...]
 */
const steps = (file: string): Step[] => {
    const lines = readFileSync(
        path.join(ROOT, ".github/workflows", file),
        "utf8",
    ).split("\n")
    const result: Step[] = [{ name: "(header)", body: "" }]
    for (const line of lines) {
        const m = /^\s*- name:\s*(.+?)\s*$/.exec(line)
        if (m) result.push({ name: m[1], body: "" })
        result[result.length - 1].body += line + "\n"
    }
    return result
}

/** SURVEY_CONFIG を参照する行（コメント行は除く）があるか */
const refsSurvey = (body: string): boolean =>
    body
        .split("\n")
        .some(l => !l.trim().startsWith("#") && l.includes("SURVEY_CONFIG"))

/** 配備の工程か（wrangler deploy / wrangler preview を実行する） */
const isDeploy = (body: string): boolean =>
    /wrangler (deploy|preview)(?! --dry-run)/.test(body)

describe("SURVEY_CONFIG の受け渡し先", () => {
    for (const file of ["deploy.yaml", "preview.yaml"]) {
        it(`[survey-definition/6.1] ${file} では Run build だけが SURVEY_CONFIG を参照する`, () => {
            const refs = steps(file).filter(s => refsSurvey(s.body))
            expect(refs.map(s => s.name)).toEqual(["Run build"])
        })

        it(`[survey-definition/6.3] ${file} の Run build は配備の工程より前にある`, () => {
            const all = steps(file)
            const build = all.findIndex(s => s.name === "Run build")
            const firstDeploy = all.findIndex(s => isDeploy(s.body))
            expect(build).toBeGreaterThan(0)
            expect(firstDeploy).toBeGreaterThan(build)
        })
    }

    it("[survey-definition/6.2] e2e.yaml には SURVEY_CONFIG がない", () => {
        expect(steps("e2e.yaml").filter(s => refsSurvey(s.body))).toEqual([])
    })

    it("[survey-definition/6.2] deploy.yaml の verify ジョブには SURVEY_CONFIG がない", () => {
        const text = readFileSync(
            path.join(ROOT, ".github/workflows/deploy.yaml"),
            "utf8",
        )
        const verify = /^ {2}verify:\n([\s\S]*?)(?=^ {2}[\w-]+:\n)/m.exec(text)
        expect(verify).not.toBeNull()
        expect(refsSurvey(verify![1])).toBe(false)
    })

    it("[survey-definition/6.2] ワークフロー全体の env（トップレベル）にも SURVEY_CONFIG がない", () => {
        for (const file of ["deploy.yaml", "preview.yaml", "e2e.yaml"]) {
            expect(refsSurvey(steps(file)[0].body)).toBe(false)
        }
    })
})
