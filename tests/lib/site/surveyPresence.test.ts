/**
 * 配信用のアンケート設定の有無の判定の検証。
 *
 * 責務と処理概要:
 * - 変数が空白でない場合・生成物が存在する場合・どちらもない場合の判定と、旗の文字列を検証する。
 */
import { describe, expect, it } from "vitest"
import {
    isSurveyConfigPresentAtBuild,
    surveyConfigPresentFlag,
} from "@/lib/site/surveyPresence"

describe("isSurveyConfigPresentAtBuild", () => {
    it("[survey-definition/4.1] 変数が空白でないなら、生成物がなくても「ある」", () => {
        expect(
            isSurveyConfigPresentAtBuild({ SURVEY_CONFIG: "{}" }, false),
        ).toBe(true)
    })

    it("[survey-definition/4.1] 生成物が存在するなら、変数がなくても「ある」", () => {
        expect(isSurveyConfigPresentAtBuild({}, true)).toBe(true)
    })

    it("[survey-definition/4.3] 変数が未設定・空・空白だけで生成物もないなら「ない」", () => {
        expect(isSurveyConfigPresentAtBuild({}, false)).toBe(false)
        expect(isSurveyConfigPresentAtBuild({ SURVEY_CONFIG: "" }, false)).toBe(
            false,
        )
        expect(
            isSurveyConfigPresentAtBuild({ SURVEY_CONFIG: " \n\t" }, false),
        ).toBe(false)
    })
})

describe("surveyConfigPresentFlag", () => {
    it('[survey-definition/4.1] 旗は "true" / "false" の文字列になる', () => {
        expect(surveyConfigPresentFlag({ SURVEY_CONFIG: "{}" }, false)).toBe(
            "true",
        )
        expect(surveyConfigPresentFlag({}, false)).toBe("false")
    })
})
