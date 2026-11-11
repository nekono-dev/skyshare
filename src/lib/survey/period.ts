/**
 * アンケートの開催期間とデータ保持期限を判定する。
 *
 * - 開催期間は開始時刻を含み終了時刻を含まない。期間の重複は設定検証で排除する。
 * - 集合は終了時刻、回答は日本標準時の暦で終了の 1 か月後（同日がなければ月末）まで保持し、期限ちょうどで期限切れとする。
 */

import type { Survey, SurveyConfig } from "@/lib/survey/definition"

/** 日本標準時の UTC からの差（ミリ秒） */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 保持期限の組 */
export type RetentionDeadlines = {
    /** 回答済みの利用者の集合の保持期限 = closesAt */
    respondentsUntil: Date
    /** 回答の保持期限 = closesAt の 1 か月後 */
    answersUntil: Date
}

/**
 * 現在のアンケートを返す。
 *
 * Input: 検証済みの設定、判定する時刻
 * Output: `opensAt <= now < closesAt` のアンケート。無ければ undefined
 * 例: 開始ちょうどは該当、終了ちょうどは該当しない
 */
export const currentSurvey = (
    config: SurveyConfig,
    now: Date,
): Survey | undefined => {
    const time = now.getTime()
    return config.surveys.find(survey => {
        return (
            Date.parse(survey.opensAt) <= time &&
            time < Date.parse(survey.closesAt)
        )
    })
}

/**
 * 日本標準時の暦で 1 か月後の時刻を返す。同じ日が無ければ月末にする。
 *
 * Input: 基準の時刻（ミリ秒）
 * Output: 1 か月後の時刻（時刻部分は日本標準時で保つ）
 * 例: 1/31 -> 2/28（うるう年は 2/29）、12/15 -> 翌年 1/15
 */
const addOneMonthInJst = (baseMs: number): Date => {
    const jst = new Date(baseMs + JST_OFFSET_MS)
    const year = jst.getUTCFullYear()
    const month = jst.getUTCMonth() + 1
    // 翌月の末日（Date.UTC の日に 0 を渡すと前月末日になる）
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const day = Math.min(jst.getUTCDate(), lastDay)
    const shifted = Date.UTC(
        year,
        month,
        day,
        jst.getUTCHours(),
        jst.getUTCMinutes(),
        jst.getUTCSeconds(),
        jst.getUTCMilliseconds(),
    )
    return new Date(shifted - JST_OFFSET_MS)
}

/**
 * 保持期限を求める。
 *
 * Input: アンケート
 * Output: 回答済みの集合の期限（終了時刻）と回答の期限（終了の 1 か月後）
 */
export const retentionDeadlines = (survey: Survey): RetentionDeadlines => {
    const closes = Date.parse(survey.closesAt)
    return {
        respondentsUntil: new Date(closes),
        answersUntil: addOneMonthInJst(closes),
    }
}

/**
 * 保持期限を過ぎたかを判定する。
 *
 * Input: アンケート、判定する時刻
 * Output: それぞれ、`now >= 期限` なら true（期限ちょうども過ぎたものとする）
 */
export const retentionExpired = (
    survey: Survey,
    now: Date,
): { respondents: boolean; answers: boolean } => {
    const deadlines = retentionDeadlines(survey)
    const time = now.getTime()
    return {
        respondents: time >= deadlines.respondentsUntil.getTime(),
        answers: time >= deadlines.answersUntil.getTime(),
    }
}
