/**
 * アンケートの段階判定と、回答データを確認した後の除去判定。
 *
 * 責務と処理概要:
 * - 段階は引数の時刻と survey-definition の保持期限判定から決める。
 * - 回答保持期限を過ぎたアンケートだけを除去候補にする。
 * - すべての環境で行が無い候補だけを除去し、行あり・確認不能は理由付きで残す。
 */
import type { Survey, SurveyConfig } from "@/lib/survey/definition"
import { retentionExpired } from "@/lib/survey/period"

export type SurveyPhase = "upcoming" | "active" | "retained" | "expired"
export type RowPresence = "none" | "present" | "unknown"

export type PruneDecision = {
    remove: string[]
    kept: { id: string; reason: "rows" | "unknown" }[]
}

/** 指定時刻でのアンケートの段階を返す。 */
export const surveyPhase = (survey: Survey, now: Date): SurveyPhase => {
    const time = now.getTime()
    if (time < Date.parse(survey.opensAt)) return "upcoming"
    if (time < Date.parse(survey.closesAt)) return "active"
    return retentionExpired(survey, now).answers ? "expired" : "retained"
}

/** 回答の保持期限を過ぎたアンケートだけを返す。 */
export const pruneCandidates = (config: SurveyConfig, now: Date): Survey[] =>
    config.surveys.filter(survey => surveyPhase(survey, now) === "expired")

/** 回答行の有無に基づき、候補を除去するか残すか決める。 */
export const decidePrune = (
    candidates: readonly Survey[],
    presence: Readonly<Record<string, readonly RowPresence[]>>,
): PruneDecision => {
    const remove: string[] = []
    const kept: PruneDecision["kept"] = []

    for (const survey of candidates) {
        const checks = presence[survey.id]
        if (checks?.length && checks.every(result => result === "none")) {
            remove.push(survey.id)
            continue
        }

        kept.push({
            id: survey.id,
            reason: checks?.includes("present") ? "rows" : "unknown",
        })
    }

    return { remove, kept }
}
