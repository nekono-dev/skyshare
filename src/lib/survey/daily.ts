/**
 * 日次アンケート処理の入口と独立した回答済み集合の削除を行う。
 */

import type { D1Database, SurveyResultsBucket } from "@/lib/platform/cfTypes"
import { isSurveyFeatureEnabled } from "@/lib/survey/feature"
import {
    isSurveyConfigPresent,
    readSurveyConfig,
} from "@/lib/survey/loadConfig"
import { isClosed } from "@/lib/survey/period"
import { readIndex } from "@/lib/survey/results/store"
import { purgeRespondentsBatch } from "@/lib/survey/store"

/** 日次処理に必要な Worker バインディング */
export type SurveyDailyEnv = {
    DB?: D1Database
    ASSETS?: { fetch(input: Request | string): Promise<Response> }
    SURVEY_RESULTS?: SurveyResultsBucket
}

/** ASSETS はパスで引くため、原点は固定の仮の値でよい */
const PLACEHOLDER_ORIGIN = "https://example.invalid"

/** 例外から記録に使える名前だけを取り出す */
const errorClassName = (error: unknown): string =>
    error instanceof Error ? error.name : "Error"

/** 設定読取前の失敗など、識別子のない段階の失敗を記録する */
const logStageFailure = (stage: string, errorName: string): void => {
    console.error(`runSurveyDaily: ${stage} failed error=${errorName}`)
}

/**
 * 日次アンケート処理を実行する。
 *
 * Input: D1・ASSETS・結果保管先の環境、現在時刻
 * Output: なし。失敗は記録し、例外を外へ投げない
 * 例: await runSurveyDaily(env, new Date())
 */
export const runSurveyDaily = async (
    env: SurveyDailyEnv,
    now: Date = new Date(),
): Promise<void> => {
    if (!isSurveyFeatureEnabled(env)) return
    const db = env.DB
    const bucket = env.SURVEY_RESULTS
    if (!db || !bucket) return

    let config
    if (isSurveyConfigPresent()) {
        if (!env.ASSETS) {
            logStageFailure("config", "Error")
            return
        }
        try {
            config = await readSurveyConfig(env.ASSETS, PLACEHOLDER_ORIGIN, {
                present: true,
            })
        } catch (error) {
            logStageFailure("config", errorClassName(error))
            return
        }
        if (!config) {
            logStageFailure("config", "Error")
            return
        }
    }

    const closedSurveyIds =
        config?.surveys
            .filter(survey => isClosed(survey, now))
            .map(s => s.id) ?? []
    if (closedSurveyIds.length > 0) {
        try {
            await purgeRespondentsBatch(db, closedSurveyIds)
        } catch (error) {
            console.error(
                `runSurveyDaily: respondents purge failed ids=${closedSurveyIds.join(",")} error=${errorClassName(error)}`,
            )
        }
    }

    try {
        await readIndex(bucket)
    } catch (error) {
        logStageFailure("index", errorClassName(error))
    }
}
