/**
 * アンケートの開催期間と終了状態を判定する。
 *
 * - 開催期間は開始時刻を含み終了時刻を含まない。期間の重複は設定検証で排除する。
 */

import type { Survey, SurveyConfig } from "@/lib/survey/definition"

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
 * アンケートが終了しているかを判定する。
 *
 * Input: アンケート、判定する時刻
 * Output: `now >= closesAt` なら true
 * 例: 終了時刻ちょうどは true、1 ミリ秒前は false
 */
export const isClosed = (survey: Survey, now: Date): boolean => {
    return now.getTime() >= Date.parse(survey.closesAt)
}
