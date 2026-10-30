/**
 * アンケート設定の生成（`hack/render-survey-config.ts`）の検証。
 *
 * 責務と処理概要:
 * - 一時ディレクトリへ書き出して、有効・未設定・空白・不正・古い生成物がある場合の挙動を確かめる。
 * - CLI（tsx 実行）では終了コードと標準エラーに入力の値が含まれないことを確かめる。
 */
import { spawnSync } from "node:child_process"
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "vitest"

import {
    IO_FAILED_MESSAGE,
    renderSurveyConfig,
    UNREADABLE_MESSAGE,
} from "../../hack/render-survey-config"
import {
    createInvalidCases,
    createValidConfig,
} from "../fixtures/survey/config"

const ROOT = path.resolve(__dirname, "../..")
const SECRET = "SECRET-VALUE-XYZ"

let dir = ""
let out = ""
beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "render-survey-"))
    out = path.join(dir, "surveys", "index.json")
})
afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
})

const stale = () => {
    mkdirSync(path.dirname(out), { recursive: true })
    writeFileSync(out, "STALE")
}

const failed = (raw: string): string[] => {
    const result = renderSurveyConfig(raw, out)
    expect(result.status).toBe("failed")
    return result.issues ?? []
}

describe("有効な値", () => {
    test("[survey-definition/5.1] 検証を通した内容が書き出され、ディレクトリがなくても作られる", () => {
        const config = createValidConfig()
        const result = renderSurveyConfig(JSON.stringify(config), out)
        expect(result.status).toBe("written")
        expect(JSON.parse(readFileSync(out, "utf8"))).toEqual(config)
    })

    test("[survey-definition/5.4] キーの順が違う入力でも同じ内容になり、繰り返しても変わらない", () => {
        const config = createValidConfig()
        const reordered = JSON.stringify(config, (_key, value) =>
            value && typeof value === "object" && !Array.isArray(value)
                ? Object.fromEntries(Object.entries(value).reverse())
                : value,
        )
        renderSurveyConfig(JSON.stringify(config, null, 4), out)
        const first = readFileSync(out, "utf8")
        renderSurveyConfig(reordered, out)
        expect(readFileSync(out, "utf8")).toBe(first)
        renderSurveyConfig(reordered, out)
        expect(readFileSync(out, "utf8")).toBe(first)
        expect(first.indexOf('"id"')).toBeLessThan(first.indexOf('"opensAt"'))
    })

    test("[survey-definition/5.1] 古い生成物は新しい内容で置き換わる", () => {
        stale()
        renderSurveyConfig(JSON.stringify(createValidConfig()), out)
        expect(readFileSync(out, "utf8")).not.toBe("STALE")
    })
})

describe("未設定・空白", () => {
    test.each([undefined, "", "  \n\t "])(
        "[survey-definition/5.2][survey-definition/4.3] %j ではファイルを作らず absent",
        raw => {
            expect(renderSurveyConfig(raw, out)).toEqual({ status: "absent" })
            expect(existsSync(out)).toBe(false)
        },
    )

    test.each([undefined, "", "   "])(
        "[survey-definition/5.2][survey-definition/6.5] %j では古い生成物を取り除いて removed",
        raw => {
            stale()
            expect(renderSurveyConfig(raw, out)).toEqual({ status: "removed" })
            expect(existsSync(out)).toBe(false)
        },
    )
})

describe("不正な値", () => {
    test("[survey-definition/5.3] 設定として読めない値は固定の文言だけで failed になり、ファイルは作られない", () => {
        const issues = failed(`{"a": ${SECRET}`)
        expect(issues).toEqual([UNREADABLE_MESSAGE])
        expect(issues.join("\n")).not.toContain(SECRET)
        expect(existsSync(out)).toBe(false)
    })

    test("[survey-definition/5.3] 読めない値でも古い生成物には触れない", () => {
        stale()
        failed("not json")
        expect(readFileSync(out, "utf8")).toBe("STALE")
    })

    test.each(createInvalidCases())(
        "[survey-definition/5.3][survey-definition/5.6] $name は位置を示して失敗し、値を含めない",
        ({ config, expectedPath }) => {
            const issues = failed(JSON.stringify(config))
            expect(issues.some(i => i.startsWith(expectedPath))).toBe(true)
            expect(existsSync(out)).toBe(false)
        },
    )

    test("[survey-definition/5.3] 検証の失敗でも古い生成物には触れない", () => {
        stale()
        const config = createValidConfig()
        config.surveys[0].id = "Survey-A"
        failed(JSON.stringify(config))
        expect(readFileSync(out, "utf8")).toBe("STALE")
    })

    test("[survey-definition/5.3] 書き出せないときは固定の文言で failed になり、パスを含めない", () => {
        writeFileSync(path.join(dir, "blocker"), "x")
        const blocked = path.join(dir, "blocker", "index.json")
        const result = renderSurveyConfig(
            JSON.stringify(createValidConfig()),
            blocked,
        )
        expect(result).toEqual({
            status: "failed",
            issues: [IO_FAILED_MESSAGE],
        })
    })

    test("[survey-definition/5.6] 検証の失敗の報告に入力の値が含まれない", () => {
        const config = createValidConfig()
        config.surveys[0].id = SECRET
        const issues = failed(JSON.stringify(config))
        expect(issues.length).toBeGreaterThan(0)
        expect(issues.join("\n")).not.toContain(SECRET)
    })

    test("[survey-definition/5.3] JSON として正しくても設定の形でない値は失敗する", () => {
        for (const raw of ["null", "[]", "123", '"x"']) {
            expect(failed(raw).length).toBeGreaterThan(0)
        }
    })
})

describe("CLI", () => {
    // 出力先は必ず一時ディレクトリを第2引数で渡し、リポジトリの生成物には触れない
    const run = (raw: string | undefined) =>
        spawnSync(
            path.join(ROOT, "node_modules/.bin/tsx"),
            [path.join(ROOT, "hack/render-survey-config.ts"), out],
            {
                cwd: dir,
                encoding: "utf8",
                env: { ...process.env, SURVEY_CONFIG: raw },
            },
        )

    test("[survey-definition/6.5] 未設定は終了コード 0 でファイルを作らず absent と表示する", () => {
        const result = run(undefined)
        expect(result.status).toBe(0)
        expect(result.stdout.trim()).toBe("survey config: absent")
        expect(existsSync(out)).toBe(false)
    })

    test("[survey-definition/5.2] 未設定で古い生成物があれば終了コード 0 で取り除き removed と表示する", () => {
        stale()
        const result = run("  ")
        expect(result.status).toBe(0)
        expect(result.stdout.trim()).toBe("survey config: removed")
        expect(existsSync(out)).toBe(false)
    })

    test("[survey-definition/5.1] 有効な値は終了コード 0 で書き出し written と表示する", () => {
        const config = createValidConfig()
        const result = run(JSON.stringify(config))
        expect(result.status).toBe(0)
        expect(result.stdout.trim()).toBe("survey config: written")
        expect(JSON.parse(readFileSync(out, "utf8"))).toEqual(config)
    })

    test("[survey-definition/5.3][survey-definition/5.6] 読めない値は終了コード 1 で、ファイルを作らず標準エラーに入力の値を含めない", () => {
        const result = run(`{${SECRET}`)
        expect(result.status).toBe(1)
        expect(result.stderr.split("\n")[0]).toBe(
            "survey config: 生成に失敗しました",
        )
        expect(result.stderr).toContain(UNREADABLE_MESSAGE)
        expect(result.stderr).not.toContain(SECRET)
        expect(existsSync(out)).toBe(false)
    })

    test("[survey-definition/5.3][survey-definition/5.6] 検証の失敗は終了コード 1 で、位置を示し入力の値を含めず、ファイルを作らない", () => {
        const config = createValidConfig()
        config.surveys[0].id = SECRET
        const result = run(JSON.stringify(config))
        expect(result.status).toBe(1)
        expect(result.stderr.split("\n")[0]).toBe(
            "survey config: 生成に失敗しました",
        )
        expect(result.stderr).toContain("surveys.0.id")
        expect(result.stderr).not.toContain(SECRET)
        expect(existsSync(out)).toBe(false)
    })
})
