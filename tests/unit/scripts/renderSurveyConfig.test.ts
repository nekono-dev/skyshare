/**
 * アンケート設定生成の結果と、出力ファイルへの副作用を検証する。
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
    renderSurveyConfig,
    UNREADABLE_MESSAGE,
} from "../../../scripts/survey/render-survey-config"

const validConfig = {
    surveys: [
        {
            id: "render-test",
            opensAt: "2026-11-01T00:00:00Z",
            closesAt: "2026-12-01T00:00:00Z",
            questions: [
                {
                    id: "question",
                    kind: "single",
                    title: { ja: "質問", en: "Question" },
                    options: [
                        { id: "yes", label: { ja: "はい", en: "Yes" } },
                        { id: "no", label: { ja: "いいえ", en: "No" } },
                    ],
                },
            ],
        },
    ],
}

describe("renderSurveyConfig", () => {
    let directory: string
    let outputPath: string

    beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), "survey-render-"))
        outputPath = path.join(directory, "surveys", "index.json")
    })

    afterEach(() => {
        fs.rmSync(directory, { recursive: true, force: true })
    })

    it("未設定なら生成物を作らず absent を返す", () => {
        expect(renderSurveyConfig(undefined, outputPath)).toEqual({
            status: "absent",
        })
        expect(fs.existsSync(outputPath)).toBe(false)
    })

    it.each([undefined, "", "   \n\t"])(
        "%j なら既存の生成物を取り除く",
        raw => {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true })
            fs.writeFileSync(outputPath, "existing")

            expect(renderSurveyConfig(raw, outputPath)).toEqual({
                status: "removed",
            })
            expect(fs.existsSync(outputPath)).toBe(false)
        },
    )

    it("空白だけで生成物がなければ absent を返す", () => {
        expect(renderSurveyConfig(" \n ", outputPath)).toEqual({
            status: "absent",
        })
        expect(fs.existsSync(outputPath)).toBe(false)
    })

    it("有効な設定を整形した JSON として書き込む", () => {
        expect(
            renderSurveyConfig(JSON.stringify(validConfig), outputPath),
        ).toEqual({
            status: "written",
        })
        expect(fs.readFileSync(outputPath, "utf8")).toBe(
            `${JSON.stringify(validConfig, null, 2)}\n`,
        )
    })

    it("読めない値は固定の issue を返し、ファイルに触れない", () => {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true })
        fs.writeFileSync(outputPath, "existing")

        const result = renderSurveyConfig("{", outputPath)

        expect(result).toEqual({
            status: "failed",
            issues: [UNREADABLE_MESSAGE],
        })
        expect(result.issues?.join(" ")).not.toContain("{")
        expect(fs.readFileSync(outputPath, "utf8")).toBe("existing")
    })

    it("検証に失敗する設定では生成物を作らない", () => {
        expect(
            renderSurveyConfig(
                JSON.stringify({ surveys: [{ id: "invalid" }] }),
                outputPath,
            ),
        ).toMatchObject({
            status: "failed",
        })
        expect(fs.existsSync(outputPath)).toBe(false)
    })

    it("検証に失敗しても既存の生成物を保ち、入力の断片を返さない", () => {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true })
        fs.writeFileSync(outputPath, "existing")
        const marker = "UNIQUE-INPUT-FRAGMENT-8f3a"

        const result = renderSurveyConfig(
            JSON.stringify({ surveys: [{ id: marker }] }),
            outputPath,
        )

        expect(result.status).toBe("failed")
        expect(result.issues?.length).toBeGreaterThan(0)
        expect(result.issues?.join(" ")).not.toContain(marker)
        expect(fs.readFileSync(outputPath, "utf8")).toBe("existing")
    })
})
