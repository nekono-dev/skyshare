import { describe, expect, test } from "vitest"
import { errorResponses } from "@/lib/api/schema/common"
import { paths } from "@/lib/api/schema/index"
import * as Get from "@/lib/api/schema/v2/surveys/_surveyId/respondent/get"
import * as Put from "@/lib/api/schema/v2/surveys/_surveyId/respondent/put"
import * as Post from "@/lib/api/schema/v2/surveys/_surveyId/answers/post"

type Op = {
    requestBody?: { content: Record<string, { schema: unknown }> }
    requestParams?: { path?: unknown }
    responses: Record<string, unknown>
}

describe("アンケート API のスキーマ", () => {
    test("[survey-api/1.4] 識別子の形式に合うパスだけが通る", () => {
        expect(
            Get.PathParamsSchema.safeParse({ surveyId: "a-1" }).success,
        ).toBe(true)
        for (const bad of ["", "A", "a--b", "-a", "a_b", "a".repeat(41)]) {
            expect(
                Get.PathParamsSchema.safeParse({ surveyId: bad }).success,
            ).toBe(false)
        }
        expect(
            Get.PathParamsSchema.safeParse({ surveyId: "a", did: "x" }).success,
        ).toBe(false)
    })

    test("[survey-api/3.1][survey-api/3.4] 確認の応答は answered の真偽だけ", () => {
        expect(
            Get.ResponseBody200Schema.safeParse({ answered: true }).success,
        ).toBe(true)
        expect(
            Get.ResponseBody200Schema.safeParse({ answered: "x" }).success,
        ).toBe(false)
        expect(
            Get.ResponseBody200Schema.safeParse({ answered: true, at: "t" })
                .success,
        ).toBe(false)
    })

    test("[survey-api/4.3] 登録は本文を持たず 204 を返す", () => {
        const put = (paths["/v2/surveys/{surveyId}/respondent/"] as { put: Op })
            .put
        expect(put.requestBody).toBeUndefined()
        expect(Object.keys(put.responses)).toContain("204")
        expect(put.requestParams!.path).toBe(Put.PathParamsSchema)
    })

    test("[survey-api/5.1] 妥当な回答の本文が通る", () => {
        expect(
            Post.RequestBodySchema.safeParse({
                answers: { q1: "a", q2: ["x", "y"], q3: [] },
            }).success,
        ).toBe(true)
    })

    test("[survey-api/5.8] 定義にない項目・回答者の識別子・時刻を含む本文は拒否される", () => {
        const base = { answers: { q1: "a" } }
        expect(
            Post.RequestBodySchema.safeParse({ ...base, did: "did:plc:x" })
                .success,
        ).toBe(false)
        expect(
            Post.RequestBodySchema.safeParse({ ...base, answeredAt: "t" })
                .success,
        ).toBe(false)
        expect(Post.RequestBodySchema.safeParse({}).success).toBe(false)
    })

    test("[survey-api/1.4] 不正な識別子・型の本文は拒否される", () => {
        for (const answers of [
            { Q1: "a" },
            { q1: "A" },
            { q1: 1 },
            { q1: ["a", 1] },
            { q1: ["A"] },
        ]) {
            expect(Post.RequestBodySchema.safeParse({ answers }).success).toBe(
                false,
            )
        }
    })

    test("[survey-api/5.1] 質問と選択肢の件数に上限がある", () => {
        const many = Object.fromEntries(
            Array.from({ length: Post.MAX_ANSWER_QUESTIONS + 1 }, (_, i) => [
                `q${i}`,
                "a",
            ]),
        )
        expect(
            Post.RequestBodySchema.safeParse({ answers: many }).success,
        ).toBe(false)
        const ok = Object.fromEntries(
            Array.from({ length: Post.MAX_ANSWER_QUESTIONS }, (_, i) => [
                `q${i}`,
                "a",
            ]),
        )
        expect(Post.RequestBodySchema.safeParse({ answers: ok }).success).toBe(
            true,
        )
        const choices = (n: number) =>
            Array.from({ length: n }, (_, i) => `c${i}`)
        expect(
            Post.RequestBodySchema.safeParse({
                answers: { q: choices(Post.MAX_ANSWER_CHOICES) },
            }).success,
        ).toBe(true)
        expect(
            Post.RequestBodySchema.safeParse({
                answers: { q: choices(Post.MAX_ANSWER_CHOICES + 1) },
            }).success,
        ).toBe(false)
    })

    test("[survey-api/1.2] 3 つの操作が一覧に登録され、入力に回答者の値を持たない", () => {
        const respondent = paths["/v2/surveys/{surveyId}/respondent/"] as {
            get: Op
            put: Op
        }
        const answers = paths["/v2/surveys/{surveyId}/answers/"] as { post: Op }
        expect(respondent.get.requestParams!.path).toBe(Get.PathParamsSchema)
        expect(
            answers.post.requestBody!.content["application/json"]!.schema,
        ).toBe(Post.RequestBodySchema)
        expect(Object.keys(answers.post.responses).sort()).toEqual([
            "201",
            "400",
            "401",
            "404",
            "409",
            "422",
            "500",
            "503",
        ])
    })

    test("[survey-api/5.7] 共通のエラー応答の説明表に 422 がある", () => {
        expect(errorResponses(["422"])["422"]).toMatchObject({
            description: "Unprocessable Content",
        })
    })
})
