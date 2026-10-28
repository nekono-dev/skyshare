import {
    parseSurveyConfig,
    type Survey,
    type SurveyConfig,
} from "@/lib/survey/definition"

/** 変数の容量の上限（GitHub の変数は 48KB まで） */
export const VARIABLE_LIMIT_BYTES = 48 * 1024

/** 聞き取りの結果。識別子は省略できる */
export type DraftSurvey = Omit<Survey, "id"> & { id?: string }

export type AddOutcome =
    | {
          status: "created" | "updated" | "unchanged"
          id: string
          config: SurveyConfig
          value: string
      }
    | { status: "invalid"; issues: string[] }
    | { status: "too-large"; bytes: number }

const INVALID_OPENS_AT = "opensAt: 開始時刻が日時として読めない"

/** 設定の各項目をスキーマの定義順に並べ直す。 */
const canonicalSurvey = (survey: Survey): Survey => ({
    id: survey.id,
    opensAt: survey.opensAt,
    closesAt: survey.closesAt,
    title: { ja: survey.title.ja, en: survey.title.en },
    ...(survey.description === undefined
        ? {}
        : {
              description: {
                  ja: survey.description.ja,
                  en: survey.description.en,
              },
          }),
    questions: survey.questions.map(question => ({
        id: question.id,
        kind: question.kind,
        title: { ja: question.title.ja, en: question.title.en },
        options: question.options.map(option => ({
            id: option.id,
            label: { ja: option.label.ja, en: option.label.en },
            ...(option.decline === undefined
                ? {}
                : { decline: option.decline }),
        })),
        ...(question.kind === "multiple" && question.maxSelect !== undefined
            ? { maxSelect: question.maxSelect }
            : {}),
    })),
})

const sortSurveys = (surveys: Survey[]): Survey[] =>
    [...surveys].sort((left, right) => {
        const byOpening = Date.parse(left.opensAt) - Date.parse(right.opensAt)
        return byOpening || left.id.localeCompare(right.id)
    })

/** 検証済み設定を開始時刻順・スキーマキー順の JSON にする。 */
export const serializeConfig = (config: SurveyConfig): string =>
    JSON.stringify({
        surveys: sortSurveys(config.surveys).map(canonicalSurvey),
    })

/** 文字列の UTF-8 バイト数を返す。 */
export const byteLength = (value: string): number =>
    new TextEncoder().encode(value).byteLength

const contentWithoutId = (survey: Survey): string => {
    const { id: _id, ...content } = canonicalSurvey(survey)
    return JSON.stringify(content)
}

const monthOf = (opensAt: string): string => {
    const jst = new Date(Date.parse(opensAt) + 9 * 60 * 60 * 1000)
    return `${String(jst.getUTCFullYear()).padStart(4, "0")}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`
}

const candidateSurvey = (draft: unknown): Survey | null => {
    if (draft === null || typeof draft !== "object" || Array.isArray(draft)) {
        return null
    }
    const opensAt = (draft as Record<string, unknown>).opensAt
    if (typeof opensAt !== "string" || Number.isNaN(Date.parse(opensAt))) {
        return null
    }
    const result = parseSurveyConfig({ surveys: [{ ...draft, id: "draft" }] })
    return result.ok ? result.config.surveys[0] : null
}

/** 下書きを設定に加え、検証・正規化した結果を返す。 */
export const addSurvey = (
    current: SurveyConfig,
    draft: unknown,
): AddOutcome => {
    const source =
        draft !== null && typeof draft === "object" && !Array.isArray(draft)
            ? (draft as Record<string, unknown>)
            : null
    const opensAt = source?.opensAt
    if (typeof opensAt !== "string" || Number.isNaN(Date.parse(opensAt))) {
        return { status: "invalid", issues: [INVALID_OPENS_AT] }
    }

    const provisional = candidateSurvey(draft)
    if (!provisional) {
        const hasId =
            source !== null &&
            Object.prototype.hasOwnProperty.call(source, "id")
        let temporaryId = "draft"
        while (current.surveys.some(survey => survey.id === temporaryId)) {
            temporaryId = `${temporaryId}-draft`
        }
        const invalidCandidate =
            source === null
                ? draft
                : hasId
                  ? source
                  : { ...source, id: temporaryId }
        const invalidId = hasId ? source?.id : temporaryId
        const validation = parseSurveyConfig({
            surveys: [
                ...current.surveys.filter(survey => survey.id !== invalidId),
                invalidCandidate as Survey,
            ],
        })
        return {
            status: "invalid",
            issues: validation.ok
                ? ["survey: 条件を満たしていない"]
                : validation.issues,
        }
    }

    let id: string
    const hasExplicitId =
        source !== null && Object.prototype.hasOwnProperty.call(source, "id")
    if (hasExplicitId) {
        // 全体の検証器が、値を漏らさず不正な明示 ID を報告する。
        id = source.id as string
    } else {
        const match = current.surveys.find(
            survey =>
                contentWithoutId(survey) === contentWithoutId(provisional),
        )
        if (match) {
            id = match.id
        } else {
            const month = monthOf(provisional.opensAt)
            const used = new Set(current.surveys.map(survey => survey.id))
            let sequence = 1
            while (used.has(`${month}-${sequence}`)) sequence += 1
            id = `${month}-${sequence}`
        }
    }

    const replacement: Survey = { ...provisional, id }
    const previous = current.surveys.find(survey => survey.id === id)
    const surveys = previous
        ? current.surveys.map(survey =>
              survey.id === id ? replacement : survey,
          )
        : [...current.surveys, replacement]
    const validation = parseSurveyConfig({ surveys })
    if (!validation.ok) return { status: "invalid", issues: validation.issues }

    const config = { surveys: sortSurveys(validation.config.surveys) }
    const value = serializeConfig(config)
    const bytes = byteLength(value)
    if (bytes > VARIABLE_LIMIT_BYTES) return { status: "too-large", bytes }

    const status =
        serializeConfig(current) === value
            ? "unchanged"
            : previous
              ? "updated"
              : "created"
    return { status, id, config, value }
}

/** 指定した識別子だけを設定から除く。 */
export const removeSurveys = (
    config: SurveyConfig,
    ids: readonly string[],
): SurveyConfig => {
    const removed = new Set(ids)
    return { surveys: config.surveys.filter(survey => !removed.has(survey.id)) }
}
