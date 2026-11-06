// 保持期限（P0・要件 2.1 の「アンケートの匿名性（保持期限）」）: 回答者の一覧は締め切りで、回答は締め切りの 1 か月後に削除される
import { env } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"
import { runSurveyRetention } from "@/lib/survey/retention"
import { createValidSurveyConfig } from "../../fixtures/survey/config"

const DID_HASH = "c".repeat(64)

/** 設定の静的アセットを偽る（固定の設定を返す） */
const assets = {
    fetch: async () =>
        new Response(JSON.stringify(createValidSurveyConfig()), {
            status: 200,
            headers: { "content-type": "application/json" },
        }),
}
const retentionEnv = { DB: env.DB, ASSETS: assets }

const countRespondents = async (): Promise<number> =>
    (
        await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM survey_respondents WHERE survey_id = 'survey-2026-a'",
        ).first<{ n: number }>()
    )?.n ?? -1
const countAnswers = async (): Promise<number> =>
    (
        await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM survey_answers WHERE survey_id = 'survey-2026-a'",
        ).first<{ n: number }>()
    )?.n ?? -1

describe("survey retention (boundaries)", () => {
    beforeAll(async () => {
        await env.DB.prepare(
            "INSERT INTO survey_respondents (survey_id, did_hash) VALUES ('survey-2026-a', ?)",
        )
            .bind(DID_HASH)
            .run()
        await env.DB.prepare(
            "INSERT INTO survey_answers (survey_id, id, answers, answered_on) VALUES ('survey-2026-a', 'ans-1', '{}', '2026-11-02')",
        ).run()
    })

    it("keeps everything one millisecond before the closing time", async () => {
        await runSurveyRetention(
            retentionEnv,
            new Date("2026-11-30T23:59:59.999+09:00"),
        )
        expect(await countRespondents()).toBe(1)
        expect(await countAnswers()).toBe(1)
    })

    it("purges the respondent list at the closing time but keeps the answers", async () => {
        await runSurveyRetention(
            retentionEnv,
            new Date("2026-12-01T00:00:00+09:00"),
        )
        expect(await countRespondents()).toBe(0)
        expect(await countAnswers()).toBe(1)
    })

    it("purges the answers one month after the closing time", async () => {
        await runSurveyRetention(
            retentionEnv,
            new Date("2027-01-01T00:00:00+09:00"),
        )
        expect(await countAnswers()).toBe(0)
    })
})
