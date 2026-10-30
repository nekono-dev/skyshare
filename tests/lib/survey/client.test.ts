/** 生成クライアントを差し替え、HTTP分類・外部入力検証・匿名の送信本文を確認する。 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { surveyApi } from "@/lib/survey/client"

const generated = vi.hoisted(() => ({
    getSurveyRespondent: vi.fn(),
    putSurveyRespondent: vi.fn(),
    postSurveyAnswers: vi.fn(),
}))
vi.mock("@/client/openapi/client", () => generated)

const surveyId = "survey-2026"
const answers = { single: "a", multiple: ["b", "c"] }

beforeEach(() => vi.resetAllMocks())

describe("SurveyApiClient", () => {
    it.each([
        [true, "answered"],
        [false, "unanswered"],
    ])("[2.3] 200 answered=%sを%sへ分類する", async (answered, expected) => {
        generated.getSurveyRespondent.mockResolvedValue({
            status: 200,
            data: { answered },
        })
        await expect(surveyApi.checkAnswered(surveyId)).resolves.toBe(expected)
        expect(generated.getSurveyRespondent).toHaveBeenCalledExactlyOnceWith(
            surveyId,
        )
    })

    it.each([400, 401, 404, 409, 422, 500, 503, 204, 201, 302, 418])(
        "[2.6, 2.7] 確認の状態コード%sを分類する",
        async status => {
            generated.getSurveyRespondent.mockResolvedValue({
                status,
                data: { answered: true },
            })
            await expect(surveyApi.checkAnswered(surveyId)).resolves.toBe(
                status === 404 ? "gone" : "failed",
            )
        },
    )

    it.each([
        undefined,
        null,
        {},
        true,
        { answered: "false" },
        { answered: 1 },
        { answered: null },
        { answered: true, extra: "unexpected" },
    ])("[2.7] 確認の不正な200本文%jは失敗にする", async data => {
        generated.getSurveyRespondent.mockResolvedValue({ status: 200, data })
        await expect(surveyApi.checkAnswered(surveyId)).resolves.toBe("failed")
    })

    it.each([204, 400, 401, 404, 409, 422, 500, 503, 200, 201, 302, 418])(
        "[2.2, 2.6, 2.7] 登録の状態コード%sを分類する",
        async status => {
            generated.putSurveyRespondent.mockResolvedValue({ status })
            await expect(surveyApi.registerAnswered(surveyId)).resolves.toBe(
                status === 204
                    ? "registered"
                    : status === 404
                      ? "gone"
                      : "failed",
            )
            expect(
                generated.putSurveyRespondent,
            ).toHaveBeenCalledExactlyOnceWith(surveyId)
        },
    )

    it.each([
        [201, "saved"],
        [409, "duplicate"],
        [404, "gone"],
        [401, "unauthenticated"],
        [400, "failed"],
        [422, "failed"],
        [500, "failed"],
        [503, "failed"],
        [200, "failed"],
        [204, "failed"],
        [302, "failed"],
        [418, "failed"],
    ])(
        "[4.1, 4.4–4.7] 送信の状態コード%sを%sへ分類する",
        async (status, expected) => {
            generated.postSurveyAnswers.mockResolvedValue({ status })
            await expect(
                surveyApi.submitAnswers(surveyId, answers),
            ).resolves.toBe(expected)
        },
    )

    it("[4.8] 送信本文はanswersだけで、利用者の識別子や時刻を加えない", async () => {
        generated.postSurveyAnswers.mockResolvedValue({ status: 201 })
        await surveyApi.submitAnswers(surveyId, answers)
        expect(generated.postSurveyAnswers).toHaveBeenCalledExactlyOnceWith(
            surveyId,
            { answers },
        )
    })

    it.each([new Error("offline"), "offline", undefined])(
        "[2.7, 4.7] 通信例外%jを全操作で失敗にする",
        async error => {
            generated.getSurveyRespondent.mockRejectedValue(error)
            generated.putSurveyRespondent.mockRejectedValue(error)
            generated.postSurveyAnswers.mockRejectedValue(error)
            await expect(surveyApi.checkAnswered(surveyId)).resolves.toBe(
                "failed",
            )
            await expect(surveyApi.registerAnswered(surveyId)).resolves.toBe(
                "failed",
            )
            await expect(
                surveyApi.submitAnswers(surveyId, answers),
            ).resolves.toBe("failed")
        },
    )
})
