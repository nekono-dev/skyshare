import {
    parseSurveyConfig,
    type Survey,
    type SurveyConfig,
} from "@/lib/survey/definition"

/** 変数の容量の上限（GitHub の変数は 48KB まで） */
export const VARIABLE_LIMIT_BYTES = 48 * 1024

/** 聞き取りの結果。識別子は省略でき、開始日時は登録時に補う。 */
export type DraftSurvey = Omit<Survey, "id" | "opensAt"> & { id?: string }

export type AddOutcome =
    | {
          status: "created" | "updated" | "unchanged"
          id: string
          config: SurveyConfig
          value: string
      }
    | { status: "invalid"; issues: string[] }
    | { status: "too-large"; bytes: number }

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

const contentWithoutIdAndOpensAt = (survey: Survey): string => {
    const { id: _id, opensAt: _opensAt, ...content } = canonicalSurvey(survey)
    return JSON.stringify(content)
}

const monthOf = (opensAt: string): string => {
    const jst = new Date(Date.parse(opensAt) + 9 * 60 * 60 * 1000)
    return `${String(jst.getUTCFullYear()).padStart(4, "0")}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`
}

/**
 * 開始日時と仮 ID を補い、下書き単体を上流スキーマで検証する。
 *
 * Input:
 * - `draft`: 開始日時を含まない下書き
 * - `opensAt`: 検証時に使う登録候補時刻
 *
 * Output:
 * - 有効なら正規化された Survey、不正なら `null`
 *
 * 例:
 * - 入力: startless 下書きと ISO 日時 / 出力: `draft` ID と開始日時付き Survey
 */
const candidateSurvey = (draft: unknown, opensAt: string): Survey | null => {
    if (draft === null || typeof draft !== "object" || Array.isArray(draft)) {
        return null
    }
    const result = parseSurveyConfig({
        surveys: [{ ...draft, id: "draft", opensAt }],
    })
    return result.ok ? result.config.surveys[0] : null
}

/**
 * 下書きを登録候補時刻とともに設定へ加え、検証・正規化した結果を返す。
 *
 * Input:
 * - `current`: 検証済みの現在の設定
 * - `draft`: 開始時刻を含まない任意の下書き入力
 * - `registeredAt`: 有限の初回登録候補日時
 *
 * Output:
 * - 検証済みの追加・更新結果、入力値を含まない不正、または容量超過
 *
 * 例:
 * - 入力: 2026年11月の下書き / 出力: `2026-11-1` と ISO 開始時刻を持つ設定
 */
export const addSurvey = (
    current: SurveyConfig,
    draft: unknown,
    registeredAt: Date,
): AddOutcome => {
    const source =
        draft !== null && typeof draft === "object" && !Array.isArray(draft)
            ? (draft as Record<string, unknown>)
            : null
    if (
        !(registeredAt instanceof Date) ||
        !Number.isFinite(registeredAt.getTime())
    ) {
        return {
            status: "invalid",
            issues: ["registeredAt: 日時として読めない"],
        }
    }
    const candidateOpensAt = registeredAt.toISOString()

    const hasExplicitId =
        source !== null && Object.prototype.hasOwnProperty.call(source, "id")
    const match = hasExplicitId
        ? undefined
        : current.surveys.find(survey => {
              const candidate = candidateSurvey(draft, survey.opensAt)
              return (
                  candidate !== null &&
                  contentWithoutIdAndOpensAt(survey) ===
                      contentWithoutIdAndOpensAt(candidate)
              )
          })
    let id: string
    if (hasExplicitId) {
        // 全体の検証器が、値を漏らさず不正な明示 ID を報告する。
        id = source.id as string
    } else {
        if (match) {
            id = match.id
        } else {
            const month = monthOf(candidateOpensAt)
            const used = new Set(current.surveys.map(survey => survey.id))
            let sequence = 1
            while (used.has(`${month}-${sequence}`)) sequence += 1
            id = `${month}-${sequence}`
        }
    }

    const previous = current.surveys.find(survey => survey.id === id)
    const replacement = {
        ...(source ?? {}),
        id,
        opensAt: previous?.opensAt ?? candidateOpensAt,
    } as Survey
    const validation = parseSurveyConfig({
        surveys: [
            ...current.surveys.filter(survey => survey.id !== id),
            replacement,
        ],
    })
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
