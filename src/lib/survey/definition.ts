/**
 * アンケート設定の形式（スキーマ・型）と検証。
 *
 * 責務と処理概要:
 * - アンケート・質問・選択肢・文言の構造を 1 つのスキーマ（`SurveyConfigSchema`）として定義し、
 *   サーバー・画面・生成処理が同じものを使えるようにする。
 * - 外部入力を `parseSurveyConfig` で検証し、型付きの設定か、不正の報告を返す。
 *   報告は「位置: 理由」だけで組み立て、入力の値（キー名を含む）を載せない。
 * - 質問・選択肢・文言はソースコードに持たない（設定の元から与えられる）。
 * - `@atproto/*`・D1・セッションに依存しない純粋なモジュール。
 */

import { z } from "zod"

import type { Locale } from "@/lib/i18n/locale"

/** 全対応言語の文言。言語を足すと、スキーマ側が型エラーで追随を求める */
export type LocalizedText = Record<Locale, string>

export type SurveyOption = {
    id: string
    label: LocalizedText
    /** 選ぶと回答を完了として扱わない（「回答しない」） */
    decline?: boolean
}

export type SurveyQuestion =
    | {
          id: string
          kind: "single"
          title: LocalizedText
          options: SurveyOption[]
      }
    | {
          id: string
          kind: "multiple"
          title: LocalizedText
          options: SurveyOption[]
          /** 選べる数の上限。1 以上かつ decline を除く選択肢の数以下 */
          maxSelect?: number
      }

export type Survey = {
    id: string
    opensAt: string // UTC からのオフセット付き ISO 8601
    closesAt: string // 同上。この時刻を含まない
    title: LocalizedText
    description?: LocalizedText
    questions: SurveyQuestion[]
}

export type SurveyConfig = { surveys: Survey[] }

export type ParseResult =
    { ok: true; config: SurveyConfig } | { ok: false; issues: string[] } // 各要素は「位置: 理由」。入力の値を含めない

/** 識別子の最大文字数 */
const ID_MAX_LENGTH = 40

/** 識別子: 英小文字・数字・ハイフン（先頭・末尾・連続のハイフンは不可） */
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** 識別子（アンケート・質問・選択肢）の検証。API の契約も同じ形式で検証するため公開する */
export const idSchema = z.string().max(ID_MAX_LENGTH).regex(ID_PATTERN)

/**
 * 配列の要素の `id` が重複する位置に、固定の理由で不正を追加する。
 *
 * Input:
 * - `items`: `id` を持つ要素の配列
 * - `ctx`: superRefine の文脈
 * - `reason`: 固定の理由文（入力の値を含めない）
 *
 * Output:
 * - なし（重複した 2 番目以降の要素の `[index, "id"]` に不正を追加する）
 *
 * 例:
 * - `[{id:"a"},{id:"a"}]` → `[1, "id"]` に不正を追加
 */
const addDuplicateIdIssues = (
    items: { id: string }[],
    ctx: z.RefinementCtx,
    reason: string,
): void => {
    const seen = new Set<string>()
    items.forEach((item, index) => {
        if (seen.has(item.id)) {
            ctx.addIssue({
                code: "custom",
                path: [index, "id"],
                message: reason,
            })
        }
        seen.add(item.id)
    })
}

/** 空白だけの文言を拒否するための固定の理由 */
const BLANK_TEXT_REASON = "文言が空白だけ"

/** 1 言語分の文言。空文字・空白だけ（全角空白を含む）は不正。値は加工しない */
const textSchema = z
    .string()
    .refine(text => text.trim().length > 0, { message: BLANK_TEXT_REASON })

/**
 * 文言。対応言語（`LOCALES`）すべてのキーを必須とする strict なオブジェクト。
 * 欠けた言語・未対応の言語キーは不正。言語を足すと `satisfies` が型エラーで追随を求める。
 */
const localizedTextSchema = z.strictObject({
    ja: textSchema,
    en: textSchema,
} satisfies Record<Locale, z.ZodType<string>>)

const optionSchema = z.strictObject({
    id: idSchema,
    label: localizedTextSchema,
    decline: z.boolean().optional(),
})

/**
 * 選択肢の配列の規則（2 つ以上、識別子の一意、「回答しない」は 1 つまで）。
 */
const optionsSchema = z
    .array(optionSchema)
    .min(2)
    .superRefine((options, ctx) => {
        addDuplicateIdIssues(options, ctx, "選択肢の識別子が重複している")
        if (options.filter(option => option.decline === true).length > 1) {
            ctx.addIssue({
                code: "custom",
                message: "「回答しない」の選択肢が 2 つ以上ある",
            })
        }
    })

const singleQuestionSchema = z.strictObject({
    id: idSchema,
    kind: z.literal("single"),
    title: localizedTextSchema,
    options: optionsSchema,
})

const multipleQuestionSchema = z
    .strictObject({
        id: idSchema,
        kind: z.literal("multiple"),
        title: localizedTextSchema,
        options: optionsSchema,
        maxSelect: z.number().int().min(1).optional(),
    })
    .superRefine((question, ctx) => {
        if (question.maxSelect === undefined) return
        const selectable = question.options.filter(
            option => option.decline !== true,
        ).length
        if (question.maxSelect > selectable) {
            ctx.addIssue({
                code: "custom",
                path: ["maxSelect"],
                message: "上限が「回答しない」を除く選択肢の数を超えている",
            })
        }
    })

const questionSchema = z.discriminatedUnion("kind", [
    singleQuestionSchema,
    multipleQuestionSchema,
])

/** UTC からのオフセット付き ISO 8601 の日時（Z または ±hh:mm。オフセットなしは不正） */
const dateTimeSchema = z.string().datetime({ offset: true })

/**
 * 日時文字列を時刻値（ミリ秒）に変換する。
 *
 * Input:
 * - `value`: 日時文字列
 *
 * Output:
 * - 時刻値。解釈できなければ `null`
 *
 * 例:
 * - `"2026-11-01T00:00:00+09:00"` → `1792854000000`（`"2026-10-31T15:00:00Z"` と同値）
 */
const toTime = (value: string): number | null => {
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? null : time
}

const surveySchema = z
    .strictObject({
        id: idSchema,
        opensAt: dateTimeSchema,
        closesAt: dateTimeSchema,
        title: localizedTextSchema,
        description: localizedTextSchema.optional(),
        questions: z
            .array(questionSchema)
            .min(1)
            .superRefine((questions, ctx) => {
                addDuplicateIdIssues(
                    questions,
                    ctx,
                    "質問の識別子が重複している",
                )
            }),
    })
    .superRefine((survey, ctx) => {
        const opens = toTime(survey.opensAt)
        const closes = toTime(survey.closesAt)
        if (opens !== null && closes !== null && closes <= opens) {
            ctx.addIssue({
                code: "custom",
                path: ["closesAt"],
                message: "終了日時が開始日時より後になっていない",
            })
        }
    })

/**
 * 複数アンケートの期間が重なる位置に、固定の理由で不正を追加する。
 * 終了と次の開始が同時刻の隣接は重複としない。比較は時刻値で行う。
 *
 * Input:
 * - `surveys`: アンケートの配列
 * - `ctx`: superRefine の文脈
 *
 * Output:
 * - なし（開始順に見て、それまでの最大の終了より前に始まるものの `[index, "opensAt"]` に不正を追加する）
 *
 * 例:
 * - A: 11/1-12/1、B: 12/1-1/1 → 追加なし。B の開始が 11/30 なら B の `opensAt` に追加
 */
const addOverlapIssues = (
    surveys: { opensAt: string; closesAt: string }[],
    ctx: z.RefinementCtx,
): void => {
    const periods: { index: number; opens: number; closes: number }[] = []
    surveys.forEach((survey, index) => {
        const opens = toTime(survey.opensAt)
        const closes = toTime(survey.closesAt)
        if (opens === null || closes === null || closes <= opens) return
        periods.push({ index, opens, closes })
    })
    periods.sort((a, b) => a.opens - b.opens || a.index - b.index)
    let latestClose = -Infinity
    for (const period of periods) {
        if (period.opens < latestClose) {
            ctx.addIssue({
                code: "custom",
                path: [period.index, "opensAt"],
                message: "他のアンケートと期間が重なっている",
            })
        }
        latestClose = Math.max(latestClose, period.closes)
    }
}

/**
 * アンケート設定のスキーマ。サーバー・画面・生成処理が同じものを使う。
 */
export const SurveyConfigSchema: z.ZodType<SurveyConfig> = z.strictObject({
    surveys: z.array(surveySchema).superRefine((surveys, ctx) => {
        addDuplicateIdIssues(surveys, ctx, "アンケートの識別子が重複している")
        addOverlapIssues(surveys, ctx)
    }),
})

/**
 * Zod の不正の種別を、入力の値を含まない固定の理由に変換する。
 *
 * Input:
 * - `issue`: Zod の不正
 *
 * Output:
 * - 固定の理由文。自前の検証（custom）は設定した固定文をそのまま返す
 */
const reasonOf = (issue: z.core.$ZodIssue): string => {
    switch (issue.code) {
        case "custom":
            return issue.message ?? "条件を満たしていない"
        case "unrecognized_keys":
            return "定義されていない項目がある"
        case "invalid_type":
            return "型が正しくない、または必須の項目が無い"
        case "invalid_format":
            return "形式が正しくない"
        case "too_small":
            return "値または要素数が下限に満たない"
        case "too_big":
            return "値または長さが上限を超えている"
        case "invalid_union":
        case "invalid_value":
            return "許可されていない値"
        default:
            return "条件を満たしていない"
    }
}

/**
 * 外部入力をアンケート設定として検証する。
 *
 * Input:
 * - `input`: 任意の値（JSON.parse の結果など）
 *
 * Output:
 * - 成功なら型付きの設定。失敗なら「位置: 理由」の配列（入力の値を含まない）
 *
 * 例:
 * - 入力: `{}` → 出力: `{ ok: false, issues: ["surveys: 型が正しくない、または必須の項目が無い"] }`
 */
export const parseSurveyConfig = (input: unknown): ParseResult => {
    const result = SurveyConfigSchema.safeParse(input)
    if (result.success) return { ok: true, config: result.data }
    const issues = result.error.issues.map(issue => {
        const path = issue.path.length === 0 ? "(root)" : issue.path.join(".")
        return `${path}: ${reasonOf(issue)}`
    })
    return { ok: false, issues: [...new Set(issues)] }
}

/**
 * 表示言語に応じた文言を返す。フォールバックは持たない（全言語が必須のため）。
 *
 * Input:
 * - `text`: 全言語の文言
 * - `locale`: 表示言語
 *
 * Output:
 * - 指定した言語の文言
 *
 * 例:
 * - 入力: `({ja:"こんにちは", en:"Hello"}, "en")` → 出力: `"Hello"`
 */
export const localize = (text: LocalizedText, locale: Locale): string => {
    return text[locale]
}
