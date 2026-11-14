/** アンケート設定の検証・正規化と、追加・更新に使う設定操作を提供する。 */
import { randomUUID } from "node:crypto"

import { idSchema } from "@/lib/api/contract/surveyPath"
import {
    parseSurveyConfig,
    type Survey,
    type SurveyConfig,
} from "@/lib/survey/definition"

/** 変数の容量の上限（GitHub の変数は 48KB まで） */
export const VARIABLE_LIMIT_BYTES = 48 * 1024

/** 下書きは識別子と開始日時を省け、締切は日本時間の日付で指定する。 */
export type DraftSurvey = Omit<Survey, "id" | "opensAt" | "closesAt"> & {
    id?: string
    closesAt: string
}

export type AddOutcome =
    | {
          status: "created" | "updated" | "unchanged"
          id: string
          config: SurveyConfig
          value: string
      }
    | { status: "invalid"; issues: string[] }
    | { status: "too-large"; bytes: number }
    | { status: "not-found" }
    | { status: "refused"; line: string }

/** 設定の各項目をスキーマの定義順に並べ直す。 */
const canonicalSurvey = (survey: Survey): Survey => ({
    id: survey.id,
    opensAt: survey.opensAt,
    closesAt: survey.closesAt,
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
        return (
            byOpening || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
        )
    })

/** 検証済み設定を開始時刻順・スキーマキー順の JSON にする。 */
export const serializeConfig = (config: SurveyConfig): string =>
    JSON.stringify({
        surveys: sortSurveys(config.surveys).map(canonicalSurvey),
    })

/** 文字列の UTF-8 バイト数を返す。 */
export const byteLength = (value: string): number =>
    new TextEncoder().encode(value).byteLength

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const EARLIER_DEADLINE_REFUSAL =
    "error: refused: 前倒しできません。自然な終了と集計を待ってください。"
const NOT_EARLIER_REFUSAL =
    "error: refused: 締切は現在の締切より前の日付を指定してください。"
const UPDATE_REFUSAL =
    "error: refused: 開催中は締切の前倒し以外を更新できません。"
const REOPEN_REFUSAL = "error: refused: 終了済みのアンケートは再開できません。"

const deadlineFromDate = (value: unknown): string | null => {
    if (typeof value !== "string") return null
    const match = DATE_PATTERN.exec(value)
    if (!match) return null
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null
    }
    return new Date(
        Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000,
    ).toISOString()
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 指定時刻より後で最も早い日本時間 0 時を返す（ちょうど 0 時なら翌日の 0 時）。 */
const nextJstMidnightAfter = (time: number): number =>
    (Math.floor((time + JST_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - JST_OFFSET_MS

/**
 * 既存の識別子と重ならない、UUID と同じ 36 文字の仮の識別子を返す。
 * 発行前の検証（容量を含む）で、実際に発行される識別子と同じ長さで見積もるために使う。
 */
const placeholderId = (current: SurveyConfig): string => {
    const used = new Set(current.surveys.map(survey => survey.id))
    for (let counter = 0; ; counter += 1) {
        const candidate = `00000000-0000-4000-8000-${counter
            .toString(16)
            .padStart(12, "0")}`
        if (!used.has(candidate)) return candidate
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const invalid = (
    issues: string[] = ["下書き: 形式が正しくない"],
): AddOutcome => ({ status: "invalid", issues })

const refusal = (line: string): AddOutcome => ({ status: "refused", line })

const validateConfig = (value: unknown): value is SurveyConfig =>
    parseSurveyConfig(value).ok

const questionsValue = (survey: Survey): string =>
    JSON.stringify(canonicalSurvey(survey).questions)

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
 * - 入力: `2026年11月の下書き` / 出力: `2026-11-1` と ISO 開始時刻を持つ設定
 */
export const addSurvey = (
    current: SurveyConfig,
    draft: unknown,
    registeredAt: Date,
    createId: () => string = randomUUID,
): AddOutcome => {
    if (!validateConfig(current)) return invalid(["設定: 形式が正しくない"])
    if (
        !(registeredAt instanceof Date) ||
        !Number.isFinite(registeredAt.getTime())
    ) {
        return {
            status: "invalid",
            issues: ["registeredAt: 日時として読めない"],
        }
    }
    if (!isRecord(draft)) return invalid()
    if (Object.prototype.hasOwnProperty.call(draft, "opensAt"))
        return invalid(["下書き: opensAt は指定できない"])
    const hasExplicitId = Object.prototype.hasOwnProperty.call(draft, "id")
    if (
        hasExplicitId &&
        (typeof draft.id !== "string" || !idSchema.safeParse(draft.id).success)
    )
        return invalid(["下書き: 識別子の形式が正しくない"])

    const id = hasExplicitId ? (draft.id as string) : undefined
    const previous =
        id === undefined
            ? undefined
            : current.surveys.find(survey => survey.id === id)

    const closesAt = deadlineFromDate(draft.closesAt)
    if (!closesAt)
        return invalid([
            "下書き.closesAt: 実在する YYYY-MM-DD を指定してください",
        ])
    const opensAt = previous?.opensAt ?? registeredAt.toISOString()
    const openTime = Date.parse(opensAt)
    const closeTime = Date.parse(closesAt)
    if (closeTime <= openTime)
        return invalid([
            "下書き.closesAt: 開始日時より後の日付を指定してください",
        ])

    const placeholder = placeholderId(current)
    const replacement = {
        ...draft,
        id: id ?? placeholder,
        opensAt,
        closesAt,
    }
    const singleValidation = parseSurveyConfig({ surveys: [replacement] })
    if (!singleValidation.ok)
        return { status: "invalid", issues: singleValidation.issues }
    const candidate = singleValidation.config.surveys[0]!
    if (id !== undefined && !previous) return { status: "not-found" }
    if (previous) {
        const nowTime = registeredAt.getTime()
        const previousClose = Date.parse(previous.closesAt)
        if (nowTime >= previousClose && closeTime > nowTime)
            return refusal(REOPEN_REFUSAL)
        if (
            nowTime >= Date.parse(previous.opensAt) &&
            nowTime < previousClose
        ) {
            const sameQuestions =
                questionsValue(candidate) === questionsValue(previous)
            if (closeTime === previousClose && sameQuestions) {
                // 同じ内容の更新は変更なしとして扱う。
            } else {
                if (closeTime >= previousClose)
                    return refusal(
                        nextJstMidnightAfter(Date.parse(previous.opensAt)) >=
                            previousClose
                            ? EARLIER_DEADLINE_REFUSAL
                            : NOT_EARLIER_REFUSAL,
                    )
                if (!sameQuestions) return refusal(UPDATE_REFUSAL)
            }
        }
    }

    const prospectiveId = id ?? placeholder
    const prospectiveValidation = parseSurveyConfig({
        surveys: [
            ...current.surveys.filter(survey => survey.id !== prospectiveId),
            { ...candidate, id: prospectiveId },
        ],
    })
    if (!prospectiveValidation.ok)
        return { status: "invalid", issues: prospectiveValidation.issues }

    if (id === undefined) {
        const sizedValue = serializeConfig({
            surveys: sortSurveys(prospectiveValidation.config.surveys),
        })
        const sizedBytes = byteLength(sizedValue)
        if (sizedBytes > VARIABLE_LIMIT_BYTES)
            return { status: "too-large", bytes: sizedBytes }
    }

    const finalId = id ?? createId()
    if (!idSchema.safeParse(finalId).success)
        return invalid(["識別子: 発行された形式が正しくない"])
    if (!previous && current.surveys.some(survey => survey.id === finalId))
        return invalid(["識別子: 既に設定に存在する"])
    const validation = parseSurveyConfig({
        surveys: [
            ...current.surveys.filter(survey => survey.id !== finalId),
            { ...candidate, id: finalId },
        ],
    })
    if (!validation.ok) return { status: "invalid", issues: validation.issues }

    const config = { surveys: sortSurveys(validation.config.surveys) }
    const value = serializeConfig(config)
    const bytes = byteLength(value)
    if (bytes > VARIABLE_LIMIT_BYTES) return { status: "too-large", bytes }

    const status =
        (previous !== undefined &&
            Date.parse(previous.closesAt) === closeTime &&
            questionsValue(previous) === questionsValue(candidate)) ||
        serializeConfig(current) === value
            ? "unchanged"
            : previous
              ? "updated"
              : "created"
    if (status === "unchanged")
        return {
            status,
            id: finalId,
            config: current,
            value: serializeConfig(current),
        }
    return { status, id: finalId, config, value }
}

/** 指定した識別子だけを設定から除く。 */
export const removeSurveys = (
    config: SurveyConfig,
    ids: readonly string[],
): SurveyConfig => {
    const removed = new Set(ids)
    return { surveys: config.surveys.filter(survey => !removed.has(survey.id)) }
}
