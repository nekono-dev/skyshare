/**
 * アンケート API の結果を画面で扱う状態に正規化する。
 *
 * - 通信例外は外へ出さず `failed` とする。確認の 200 本文は `{ answered: boolean }` だけを受け入れる。
 * - 送信本文は `{ answers }` だけとし、利用者の識別子や時刻を含めない。
 */
import { z } from "zod"
import {
    getSurveyRespondent,
    postSurveyAnswers,
    putSurveyRespondent,
} from "@/client/openapi/client"

/** 回答済みの確認の結果 */
export type AnsweredCheck = "answered" | "unanswered" | "gone" | "failed"
/** 回答済みの登録の結果 */
export type RegisterResult = "registered" | "gone" | "failed"
/** 回答の送信の結果 */
export type SubmitResult =
    "saved" | "duplicate" | "gone" | "unauthenticated" | "failed"

export type SurveyApi = {
    checkAnswered: (surveyId: string) => Promise<AnsweredCheck>
    registerAnswered: (surveyId: string) => Promise<RegisterResult>
    submitAnswers: (
        surveyId: string,
        answers: Record<string, string | string[]>,
    ) => Promise<SubmitResult>
}

/** 確認の 200 本文。外部からの入力なので、形を厳密に検証する */
const respondentSchema = z.strictObject({ answered: z.boolean() })

const checkAnswered = async (surveyId: string): Promise<AnsweredCheck> => {
    try {
        const res = await getSurveyRespondent(surveyId)
        if (res.status === 200) {
            const parsed = respondentSchema.safeParse(res.data)
            if (!parsed.success) return "failed"
            return parsed.data.answered ? "answered" : "unanswered"
        }
        return res.status === 404 ? "gone" : "failed"
    } catch {
        return "failed"
    }
}

const registerAnswered = async (surveyId: string): Promise<RegisterResult> => {
    try {
        const res = await putSurveyRespondent(surveyId)
        if (res.status === 204) return "registered"
        return res.status === 404 ? "gone" : "failed"
    } catch {
        return "failed"
    }
}

const submitAnswers = async (
    surveyId: string,
    answers: Record<string, string | string[]>,
): Promise<SubmitResult> => {
    try {
        const res = await postSurveyAnswers(surveyId, { answers })
        switch (res.status) {
            case 201:
                return "saved"
            case 409:
                return "duplicate"
            case 404:
                return "gone"
            case 401:
                return "unauthenticated"
            default:
                return "failed"
        }
    } catch {
        return "failed"
    }
}

/** アンケートAPIの呼び出し口。例外は投げず、分類だけを返す */
export const surveyApi: SurveyApi = {
    checkAnswered,
    registerAnswered,
    submitAnswers,
}
