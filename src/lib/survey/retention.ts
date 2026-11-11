/**
 * 保持期限を過ぎたアンケートデータを削除する。
 *
 * - 集合は終了時刻以後、回答は終了の 1 か月後以後に削除し、開催中・未開催は削除しない。
 * - 設定がない・読めない場合は D1 に触れない。項目単位の失敗を記録して続行し、全体の例外も外へ出さない。
 * - `present: true` を指定して設定を読み、ログにエラー内容や回答者情報を含めない。
 */

import type { D1Database } from "@/lib/platform/cfTypes"
import { readSurveyConfig } from "@/lib/survey/loadConfig"
import { retentionExpired } from "@/lib/survey/period"
import { purgeAnswers, purgeRespondents } from "@/lib/survey/store"

/** 削除の実行に必要なバインディング */
export type SurveyRetentionEnv = {
    DB: D1Database
    ASSETS: { fetch(input: Request | string): Promise<Response> }
}

/** ASSETS はパスで引くため、原点は固定の仮の値でよい */
const PLACEHOLDER_ORIGIN = "https://example.invalid"

/**
 * 1 項目の削除を実行し、失敗は記録して握りつぶす。
 *
 * Input: 項目名（ログ用）、アンケートの識別子、削除の関数
 * Output: なし（例外を投げない）
 * 例: await purgeSafely("respondents", "s1", () => purgeRespondents(db, "s1"))
 */
const purgeSafely = async (
    label: string,
    surveyId: string,
    purge: () => Promise<number>,
): Promise<void> => {
    try {
        await purge()
    } catch {
        console.error(
            `runSurveyRetention: ${label} purge failed id=${surveyId}`,
        )
    }
}

/**
 * 保持期限を過ぎたデータを削除する。
 *
 * Input: env（DB・ASSETS）、現在時刻
 * Output: なし（失敗は記録し、例外を外へ投げない）
 * 例: await runSurveyRetention(env, new Date()) // 終了済みのアンケートの集合を削除
 * 削除対象は期限だけで決まり、繰り返しても結果は同じ。失敗した削除は翌日の実行で再試行する。
 */
export const runSurveyRetention = async (
    env: SurveyRetentionEnv,
    now: Date,
): Promise<void> => {
    try {
        const config = await readSurveyConfig(env.ASSETS, PLACEHOLDER_ORIGIN, {
            present: true,
        })
        if (!config) return
        for (const survey of config.surveys) {
            const expired = retentionExpired(survey, now)
            if (expired.respondents) {
                await purgeSafely("respondents", survey.id, () =>
                    purgeRespondents(env.DB, survey.id),
                )
            }
            if (expired.answers) {
                await purgeSafely("answers", survey.id, () =>
                    purgeAnswers(env.DB, survey.id),
                )
            }
        }
    } catch {
        console.error("runSurveyRetention: unexpected error")
    }
}
