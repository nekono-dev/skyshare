/**
 * 統計ファイルの形式、R2 キー、共有の読み取り規則を定義する。
 */

import { z } from "zod"

import { idSchema } from "@/lib/api/contract/surveyPath"
import type { LocalizedText } from "@/lib/survey/definition"

/** 統計ファイル形式の版。 */
export const SCHEMA_VERSION = 1

/** 目録ファイルの R2 キー。 */
export const INDEX_KEY = "index.json"

/** アンケート結果ファイルの R2 キーを返す。 */
export const resultKey = (surveyId: string): string =>
    `surveys/${surveyId}.json`

/** 可視フラグファイルの R2 キーを返す。 */
export const visibilityKey = (surveyId: string): string =>
    `visibility/${surveyId}.json`

/** 百分率。0 以上 100 以下で、小数点以下 1 桁まで。 */
export type Percent = number

export type SurveyResult = {
    schemaVersion: 1
    id: string
    opensAt: string
    closesAt: string
    questions: {
        id: string
        kind: "single" | "multiple"
        title: LocalizedText
        options: { id: string; label: LocalizedText; percent: Percent }[]
    }[]
}

export type SurveyIndex = {
    schemaVersion: 1
    surveys: {
        id: string
        opensAt: string
        closesAt: string
        outcome: "result" | "empty"
    }[]
}

export type SurveyVisibility = { schemaVersion: 1; visible: boolean }

export type ParseOutcome<T> = { ok: true; value: T } | { ok: false }

const dateTimeSchema = z.string().datetime({ offset: true })
const localizedTextSchema = z.strictObject({
    ja: z.string(),
    en: z.string(),
})
const uniqueIds = <T extends { id: string }>(items: T[]): boolean =>
    new Set(items.map(item => item.id)).size === items.length
const uniqueList = <T extends z.ZodType<{ id: string }>>(schema: T) =>
    z.array(schema).refine(uniqueIds)

const optionSchema = z.strictObject({
    id: idSchema,
    label: localizedTextSchema,
    percent: z
        .number()
        .min(0)
        .max(100)
        .refine(value => Number.isInteger(value * 10)),
})
const questionSchema = z.strictObject({
    id: idSchema,
    kind: z.enum(["single", "multiple"]),
    title: localizedTextSchema,
    options: uniqueList(optionSchema),
})
const surveyResultSchema = z.strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: idSchema,
    opensAt: dateTimeSchema,
    closesAt: dateTimeSchema,
    questions: uniqueList(questionSchema),
})
const surveyIndexSchema = z.strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    surveys: uniqueList(
        z.strictObject({
            id: idSchema,
            opensAt: dateTimeSchema,
            closesAt: dateTimeSchema,
            outcome: z.enum(["result", "empty"]),
        }),
    ),
})
const surveyVisibilitySchema = z.strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    visible: z.boolean(),
})

const parse = <T>(schema: z.ZodType<T>, input: unknown): ParseOutcome<T> => {
    const result = schema.safeParse(input)
    return result.success ? { ok: true, value: result.data } : { ok: false }
}

export const parseSurveyResult = (input: unknown): ParseOutcome<SurveyResult> =>
    parse(surveyResultSchema, input)

export const parseSurveyIndex = (input: unknown): ParseOutcome<SurveyIndex> =>
    parse(surveyIndexSchema, input)

export const parseSurveyVisibility = (
    input: unknown,
): ParseOutcome<SurveyVisibility> => parse(surveyVisibilitySchema, input)

/**
 * 結果が目録の記録と同じアンケートのものか判定する。
 *
 * Input: 目録の記録、検証済みの結果
 * Output: 識別子と実施期間がすべて一致するとき true
 * 例: 期間のどちらかが異なる場合は false
 */
export const resultMatchesIndexEntry = (
    entry: SurveyIndex["surveys"][number],
    result: SurveyResult,
): boolean =>
    entry.id === result.id &&
    entry.opensAt === result.opensAt &&
    entry.closesAt === result.closesAt

/**
 * 可視フラグが公表を許可しているか判定する。
 *
 * Input: 検証済みの可視フラグ、または未設定
 * Output: `visible` が true のとき true
 * 例: undefined や visible が false なら false
 */
export const isVisible = (visibility: SurveyVisibility | undefined): boolean =>
    visibility?.visible === true
