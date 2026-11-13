/**
 * 日次アンケート処理の入口と独立した回答済み集合の削除を行う。
 */

import type { D1Database, SurveyResultsBucket } from "@/lib/platform/cfTypes"
import { isSurveyFeatureEnabled } from "@/lib/survey/feature"
import type { Survey } from "@/lib/survey/definition"
import {
    isSurveyConfigPresent,
    readSurveyConfig,
} from "@/lib/survey/loadConfig"
import { isClosed } from "@/lib/survey/period"
import {
    appendIndexEntry,
    readIndex,
    readMatchingResult,
    putResultOnce,
} from "@/lib/survey/results/store"
import { tallySurvey } from "@/lib/survey/results/tally"
import type { SurveyIndex } from "@/lib/survey/results/schema"
import {
    purgeRespondentsBatch,
    purgeSurveysBatch,
    readDailyRows,
} from "@/lib/survey/store"

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

/** 識別子を含む失敗は段階と例外名だけを記録する */
const logSurveyFailure = (
    stage: string,
    surveyId: string,
    error: unknown,
): void => {
    console.error(
        `runSurveyDaily: ${stage} failed survey=${surveyId} error=${errorClassName(error)}`,
    )
}

const indexEntry = (
    index: SurveyIndex,
    surveyId: string,
): SurveyIndex["surveys"][number] | undefined =>
    index.surveys.find(entry => entry.id === surveyId)

const confirmsIndexEntry = (
    index: SurveyIndex,
    expected: SurveyIndex["surveys"][number],
): boolean =>
    index.surveys.some(
        entry =>
            entry.id === expected.id &&
            entry.opensAt === expected.opensAt &&
            entry.closesAt === expected.closesAt &&
            entry.outcome === expected.outcome,
    )

const appendAndConfirm = async (
    bucket: SurveyResultsBucket,
    entry: SurveyIndex["surveys"][number],
): Promise<void> => {
    await appendIndexEntry(bucket, entry)
    const snapshot = await readIndex(bucket)
    if (!confirmsIndexEntry(snapshot.index, entry)) throw new Error()
}

const residualCandidates = (
    index: SurveyIndex,
    configuredSurveyIds: Set<string>,
    now: Date,
): SurveyIndex["surveys"] =>
    index.surveys
        .filter(
            entry =>
                !configuredSurveyIds.has(entry.id) &&
                Date.parse(entry.closesAt) <= now.getTime(),
        )
        .sort(
            (left, right) =>
                Date.parse(right.closesAt) - Date.parse(left.closesAt),
        )
        .slice(0, 200)

const purgeResidualSurveys = async (
    db: D1Database,
    surveyIds: string[],
): Promise<void> => {
    for (let offset = 0; offset < surveyIds.length; offset += 20) {
        const group = surveyIds.slice(offset, offset + 20)
        try {
            await purgeSurveysBatch(db, group)
        } catch (error) {
            console.error(
                `runSurveyDaily: residual purge failed ids=${group.join(",")} error=${errorClassName(error)}`,
            )
        }
    }
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

    let snapshot
    try {
        snapshot = await readIndex(bucket)
    } catch (error) {
        logStageFailure("index", errorClassName(error))
        return
    }

    const closedSurveys =
        config?.surveys.filter(survey => isClosed(survey, now)) ?? []
    const configuredSurveyIds = new Set<string>(
        config?.surveys.map(survey => survey.id) ?? [],
    )
    const candidates = residualCandidates(
        snapshot.index,
        configuredSurveyIds,
        now,
    )
    const deletions = new Set<string>()
    const blockedSurveyIds = new Set<string>()
    const pending: {
        survey: Survey
        entry?: SurveyIndex["surveys"][number]
    }[] = []

    for (const survey of closedSurveys) {
        const entry = indexEntry(snapshot.index, survey.id)
        if (entry?.outcome === "empty") {
            deletions.add(survey.id)
            continue
        }
        const expected = entry ?? {
            id: survey.id,
            opensAt: survey.opensAt,
            closesAt: survey.closesAt,
            outcome: "result" as const,
        }
        try {
            const result = await readMatchingResult(bucket, expected)
            if (result) {
                if (!entry) {
                    await appendAndConfirm(bucket, {
                        id: result.id,
                        opensAt: result.opensAt,
                        closesAt: result.closesAt,
                        outcome: "result",
                    })
                }
                deletions.add(survey.id)
                continue
            }
            pending.push({ survey, entry })
        } catch (error) {
            blockedSurveyIds.add(survey.id)
            logSurveyFailure("result read", survey.id, error)
        }
    }

    let answerRows: Map<string, string[]>
    let residualIds = new Set<string>()
    try {
        const rows = await readDailyRows(db, {
            answerSurveyIds: pending.map(item => item.survey.id),
            residualSurveyIds: candidates.map(entry => entry.id),
        })
        answerRows = rows.answers
        residualIds = rows.residual
    } catch (error) {
        for (const item of pending) {
            blockedSurveyIds.add(item.survey.id)
            logSurveyFailure("answers read", item.survey.id, error)
        }
        answerRows = new Map()
        pending.length = 0
        for (const candidate of candidates) {
            logSurveyFailure("residual read", candidate.id, error)
        }
    }

    for (const { survey, entry } of pending) {
        try {
            const tallied = tallySurvey(survey, answerRows.get(survey.id) ?? [])
            // 目録に記録があれば、その期間を本体の期間とする（確認の期待値と一致させる）
            const result = tallied && {
                ...tallied,
                opensAt: entry?.opensAt ?? tallied.opensAt,
                closesAt: entry?.closesAt ?? tallied.closesAt,
            }
            if (!result) {
                if (entry?.outcome === "result") {
                    blockedSurveyIds.add(survey.id)
                    logSurveyFailure("result recovery", survey.id, new Error())
                    continue
                }
                await appendAndConfirm(bucket, {
                    id: survey.id,
                    opensAt: survey.opensAt,
                    closesAt: survey.closesAt,
                    outcome: "empty",
                })
                deletions.add(survey.id)
                continue
            }

            await putResultOnce(bucket, result)
            const confirmed = await readMatchingResult(bucket, result)
            if (!confirmed) throw new Error()
            if (!entry) {
                await appendAndConfirm(bucket, {
                    id: result.id,
                    opensAt: result.opensAt,
                    closesAt: result.closesAt,
                    outcome: "result",
                })
            } else {
                const current = await readIndex(bucket)
                if (
                    !confirmsIndexEntry(current.index, {
                        id: entry.id,
                        opensAt: entry.opensAt,
                        closesAt: entry.closesAt,
                        outcome: "result",
                    })
                )
                    throw new Error()
            }
            deletions.add(survey.id)
        } catch (error) {
            blockedSurveyIds.add(survey.id)
            logSurveyFailure("result save", survey.id, error)
        }
    }

    const confirmedSurveyIds = [...deletions].filter(
        surveyId => !blockedSurveyIds.has(surveyId),
    )
    if (confirmedSurveyIds.length > 0) {
        try {
            await purgeSurveysBatch(db, confirmedSurveyIds)
        } catch (error) {
            console.error(
                `runSurveyDaily: answers purge failed ids=${confirmedSurveyIds.join(",")} error=${errorClassName(error)}`,
            )
        }
    }

    const residualDeletions: string[] = []
    for (const candidate of candidates) {
        if (
            !residualIds.has(candidate.id) ||
            blockedSurveyIds.has(candidate.id)
        )
            continue
        if (candidate.outcome === "result") {
            try {
                const result = await readMatchingResult(bucket, candidate)
                if (!result) throw new Error()
                residualDeletions.push(candidate.id)
            } catch (error) {
                logSurveyFailure("residual result read", candidate.id, error)
            }
        } else {
            residualDeletions.push(candidate.id)
        }
    }
    await purgeResidualSurveys(db, residualDeletions)
}
