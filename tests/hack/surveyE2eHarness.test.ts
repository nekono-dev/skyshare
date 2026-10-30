/**
 * E2E の検証用アンケート設定の供給（`hack/surveyE2eHarness.mjs`）の検証。
 *
 * 責務と処理概要:
 * - 自分で dev サーバーを起動するときだけ検証用の設定を生成することを確かめる。
 * - 検証用の設定の環境変数が元の環境変数を変えないこと、生成と復元の往復で通常の状態に戻ることを確かめる。
 * - 検証用の設定が配信用の設定の検証を通り、開催中として扱われ、3 種の質問（単一・複数・回答しない）を含むことを確かめる。
 * - 配信用の設定が無いときの見送りの理由を確かめる。
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "vitest"

import {
    E2E_SURVEY_CONFIG_PATH,
    envWithE2eSurveyConfig,
    readE2eSurveyConfig,
    shouldProvideSurveyConfig,
    exitCodeFor,
    surveyConfigSkipReason,
} from "../../hack/surveyE2eHarness.mjs"
import { renderSurveyConfig } from "../../hack/render-survey-config"
import { parseSurveyConfig, type Survey } from "../../src/lib/survey/definition"
import { currentSurvey } from "../../src/lib/survey/period"

let dir = ""
let out = ""
beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "e2e-survey-"))
    out = path.join(dir, "surveys", "index.json")
})
afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
})

describe("生成の要否", () => {
    test("[survey-form/7.1] 自分で dev サーバーを起動するときは生成する", () => {
        expect(shouldProvideSurveyConfig(false)).toBe(true)
    })

    test("[survey-form/7.1] 起動済みの dev サーバーがあるときは生成しない", () => {
        expect(shouldProvideSurveyConfig(true)).toBe(false)
    })
})

describe("検証用の環境変数", () => {
    test("[survey-form/7.1] 検証用の設定を SURVEY_CONFIG に入れ、他の変数はそのまま残す", () => {
        const base = { PUBLIC_VERSION: "1.2.3", FOO: "bar" }
        const env = envWithE2eSurveyConfig(base, "RAW")
        expect(env).toEqual({
            PUBLIC_VERSION: "1.2.3",
            FOO: "bar",
            SURVEY_CONFIG: "RAW",
        })
    })

    test("[survey-form/7.3] 元の環境変数の値を書き換えない（復元に使うため）", () => {
        const base: Record<string, string | undefined> = {
            SURVEY_CONFIG: "ORIGINAL",
        }
        const env = envWithE2eSurveyConfig(base, "RAW")
        expect(env.SURVEY_CONFIG).toBe("RAW")
        expect(base.SURVEY_CONFIG).toBe("ORIGINAL")
    })
})

describe("検証用の設定（tests/fixtures/survey/e2e-open.json）", () => {
    test("[survey-form/7.5] 配信用の設定の検証を通る", () => {
        const result = parseSurveyConfig(JSON.parse(readE2eSurveyConfig()))
        expect(result.ok).toBe(true)
    })

    test("[survey-form/7.5] 生成処理（renderSurveyConfig）で書き出せる", () => {
        const env = envWithE2eSurveyConfig({}, readE2eSurveyConfig())
        expect(renderSurveyConfig(env.SURVEY_CONFIG, out)).toEqual({
            status: "written",
        })
        expect(existsSync(out)).toBe(true)
    })

    test("[survey-form/7.2] 現在時刻で開催中として返り、終了は遠い将来にある", () => {
        const config = parseSurveyConfig(JSON.parse(readE2eSurveyConfig()))
        if (!config.ok) throw new Error("検証用の設定が検証を通らない")
        const survey = currentSurvey(config.config, new Date())
        expect(survey?.id).toBe("e2e-open")
        expect(Date.parse(survey!.closesAt)).toBeGreaterThan(
            Date.parse("2100-01-01T00:00:00Z"),
        )
    })

    test("[survey-form/7.2] 単一選択（回答しないを含む）と複数選択（上限 2・回答しないを含む）を持つ", () => {
        const config = JSON.parse(readE2eSurveyConfig())
        const survey = config.surveys[0] as Survey
        const single = survey.questions.find(q => q.kind === "single")
        const multiple = survey.questions.find(q => q.kind === "multiple")
        expect(single).toBeDefined()
        expect(single!.options.some(o => o.decline === true)).toBe(true)
        expect(multiple).toBeDefined()
        expect(multiple!.maxSelect).toBe(2)
        expect(multiple!.options.some(o => o.decline === true)).toBe(true)
    })

    test("[survey-form/7.2] 保存先は tests/fixtures/survey 配下にある", () => {
        expect(E2E_SURVEY_CONFIG_PATH).toMatch(
            /tests[/\\]fixtures[/\\]survey[/\\]e2e-open\.json$/,
        )
    })
})

describe("生成と復元の往復", () => {
    test("[survey-form/7.3] 元の環境変数が未設定なら、復元で配信用の設定は取り除かれる", () => {
        const base: Record<string, string | undefined> = {}
        const e2e = envWithE2eSurveyConfig(base, readE2eSurveyConfig())
        expect(renderSurveyConfig(e2e.SURVEY_CONFIG, out).status).toBe(
            "written",
        )
        expect(renderSurveyConfig(base.SURVEY_CONFIG, out)).toEqual({
            status: "removed",
        })
        expect(existsSync(out)).toBe(false)
    })
})

describe("配信用の設定の有無による見送りの理由", () => {
    test("[survey-form/7.4] 配信用の設定があれば見送らない", () => {
        expect(surveyConfigSkipReason(true)).toBeUndefined()
    })

    test("[survey-form/7.4] 配信用の設定が無ければ、理由として生成の手順を示す", () => {
        const reason = surveyConfigSkipReason(false)
        expect(reason).toEqual(expect.stringContaining("survey:render"))
    })
})

describe("終了コードの決定（中断・後始末・子の終了コード）", () => {
    test("[survey-form/7.3] 中断は 128 + シグナル番号（SIGINT 130、SIGTERM 143、SIGHUP 129）", () => {
        expect(exitCodeFor({ status: null, interruptedBy: "SIGINT" })).toBe(130)
        expect(exitCodeFor({ status: null, interruptedBy: "SIGTERM" })).toBe(
            143,
        )
        expect(exitCodeFor({ status: null, interruptedBy: "SIGHUP" })).toBe(129)
    })

    test("[survey-form/7.3] 中断が記録されていれば、子が正常に終わっても 128 + シグナル番号", () => {
        expect(exitCodeFor({ status: 0, interruptedBy: "SIGINT" })).toBe(130)
    })

    test("[survey-form/7.3] 中断と後始末の失敗が重なっても、中断の終了コードを優先する", () => {
        expect(
            exitCodeFor({
                status: 1,
                interruptedBy: "SIGTERM",
                cleanupFailed: true,
            }),
        ).toBe(143)
    })

    test("[survey-form/7.3] 通常の終了は子の終了コードをそのまま返す", () => {
        expect(exitCodeFor({ status: 0 })).toBe(0)
        expect(exitCodeFor({ status: 3 })).toBe(3)
    })

    test("[survey-form/7.3] 子が終了コードを返さず終わったときは 1", () => {
        expect(exitCodeFor({ status: null })).toBe(1)
    })

    test("[survey-form/7.3] 後始末（dev サーバーの停止・復元）が失敗したときは、子が成功でも 1", () => {
        expect(exitCodeFor({ status: 0, cleanupFailed: true })).toBe(1)
        expect(exitCodeFor({ status: 3, cleanupFailed: true })).toBe(1)
    })
})
