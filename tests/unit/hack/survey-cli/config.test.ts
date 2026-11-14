/**
 * アンケート設定の下書き検証、新規登録、更新の規則を確認する。
 */
import { describe, expect, it, vi } from "vitest"

import { createValidSurveyConfig } from "../../../fixtures/survey/config"
import legacyDraft from "../../../fixtures/survey-operation/legacy-title.json"
import updateDraft from "../../../fixtures/survey-operation/with-id.json"
import newDraft from "../../../fixtures/survey-operation/without-id.json"
import {
    addSurvey,
    byteLength,
    serializeConfig,
    VARIABLE_LIMIT_BYTES,
} from "../../../../hack/survey-cli/config"
import type { SurveyConfig } from "@/lib/survey/definition"

const registeredAt = new Date("2026-11-10T12:30:00.000Z")
const validConfig = (): SurveyConfig =>
    createValidSurveyConfig() as unknown as SurveyConfig

describe("addSurvey", () => {
    it("adds a new draft with generated id and JST midnight deadline", () => {
        const createId = vi.fn(() => "new-survey")

        const result = addSurvey(
            { surveys: [] },
            newDraft,
            registeredAt,
            createId,
        )

        expect(result.status).toBe("created")
        if (result.status !== "created") return
        expect(createId).toHaveBeenCalledOnce()
        expect(result.id).toBe("new-survey")
        expect(result.config.surveys[0]?.opensAt).toBe(
            registeredAt.toISOString(),
        )
        expect(result.config.surveys[0]?.closesAt).toBe(
            "2026-11-30T15:00:00.000Z",
        )
        expect(result.value).not.toContain("description")
        const storedSurvey = result.config
            .surveys[0] as (typeof result.config.surveys)[number] & {
            title?: unknown
        }
        expect(storedSurvey).not.toHaveProperty("title")
        expect(storedSurvey).not.toHaveProperty("description")
    })

    it("updates only the specified survey and preserves its opening time", () => {
        const createId = vi.fn(() => "unused")
        const result = addSurvey(
            validConfig(),
            updateDraft,
            registeredAt,
            createId,
        )

        expect(result.status).toBe("updated")
        if (result.status !== "updated") return
        expect(result.id).toBe("survey-2026-a")
        expect(result.config.surveys[0]?.opensAt).toBe(
            "2026-11-01T00:00:00+09:00",
        )
        expect(createId).not.toHaveBeenCalled()
    })

    it("does not treat an unknown explicit id as a new registration", () => {
        const createId = vi.fn(() => "unused")
        const result = addSurvey(
            validConfig(),
            { ...updateDraft, id: "missing-survey" },
            registeredAt,
            createId,
        )
        expect(result.status).toBe("not-found")
        expect(createId).not.toHaveBeenCalled()
    })

    it.each([
        ["a new draft", newDraft, { surveys: [] }],
        ["an update draft", updateDraft, createValidSurveyConfig()],
    ])(
        "rejects an opensAt in %s without issuing an id",
        (_name, draft, current) => {
            const createId = vi.fn(() => "unused")

            const result = addSurvey(
                current as unknown as SurveyConfig,
                { ...draft, opensAt: "2026-11-15T00:00:00+09:00" },
                registeredAt,
                createId,
            )

            expect(result).toMatchObject({ status: "invalid" })
            expect(createId).not.toHaveBeenCalled()
        },
    )

    it("validates overlap before issuing an id even when an existing id equals the internal placeholder", () => {
        const createId = vi.fn(() => "unused")
        const current = validConfig()
        current.surveys[0]!.id = "pending-survey"
        // 既存の期間（11/01〜12/01）と重なる日時に登録する

        const result = addSurvey(
            current,
            newDraft,
            new Date("2026-11-10T12:30:00Z"),
            createId,
        )

        expect(result).toMatchObject({ status: "invalid" })
        expect(createId).not.toHaveBeenCalled()
    })

    it("estimates capacity with a UUID-length id so an oversized new draft is rejected before an id is issued", () => {
        const uuid = "123e4567-e89b-42d3-a456-426614174000"
        const withPadding = (length: number) => ({
            ...newDraft,
            questions: [
                {
                    ...newDraft.questions[0],
                    title: { ja: "a".repeat(length), en: "title" },
                },
            ],
        })
        // 登録後の設定を直接組み立て、UUID を含めた大きさをテスト側で求める（被験コードの見積もりに頼らない）
        const registered = (length: number): SurveyConfig =>
            ({
                surveys: [
                    {
                        ...withPadding(length),
                        id: uuid,
                        opensAt: registeredAt.toISOString(),
                        closesAt: new Date(
                            `${newDraft.closesAt}T00:00:00+09:00`,
                        ).toISOString(),
                    },
                ],
            }) as unknown as SurveyConfig
        const baseBytes = byteLength(serializeConfig(registered(0)))
        const padding = VARIABLE_LIMIT_BYTES + 1 - baseBytes
        expect(byteLength(serializeConfig(registered(padding)))).toBe(
            VARIABLE_LIMIT_BYTES + 1,
        )
        const createId = vi.fn(() => uuid)

        const result = addSurvey(
            { surveys: [] },
            withPadding(padding),
            registeredAt,
            createId,
        )

        expect(result).toEqual({
            status: "too-large",
            bytes: VARIABLE_LIMIT_BYTES + 1,
        })
        expect(createId).not.toHaveBeenCalled()
    })

    it("rejects removed survey-level fields strictly", () => {
        const createId = vi.fn(() => "unused")
        const result = addSurvey(
            { surveys: [] },
            legacyDraft,
            registeredAt,
            createId,
        )
        expect(result.status).toBe("invalid")
        expect(createId).not.toHaveBeenCalled()
    })

    it.each(["2026-02-30", "2026-2-03", "2026-02-03T00:00:00Z"])(
        "rejects invalid date %s",
        closesAt => {
            const createId = vi.fn(() => "unused")
            const result = addSurvey(
                { surveys: [] },
                { ...newDraft, closesAt },
                registeredAt,
                createId,
            )
            expect(result.status).toBe("invalid")
            expect(createId).not.toHaveBeenCalled()
        },
    )

    it("rejects a new deadline at or before registration time", () => {
        const result = addSurvey(
            { surveys: [] },
            { ...newDraft, closesAt: "2026-11-10" },
            new Date("2026-11-10T15:00:00.000Z"),
            () => "new-survey",
        )
        expect(result.status).toBe("invalid")
    })

    it("returns unchanged without issuing an id", () => {
        const createId = vi.fn(() => "unused")
        const current = validConfig()
        const unchangedDraft = {
            ...updateDraft,
            closesAt: "2026-12-01",
        }
        const result = addSurvey(
            current,
            unchangedDraft,
            registeredAt,
            createId,
        )
        expect(result.status).toBe("unchanged")
        expect(createId).not.toHaveBeenCalled()
    })

    it("rejects an invalid generated id after validating the draft", () => {
        const createId = vi.fn(() => "Not A UUID")
        const result = addSurvey(
            { surveys: [] },
            newDraft,
            registeredAt,
            createId,
        )
        expect(result.status).toBe("invalid")
        expect(createId).toHaveBeenCalledOnce()
    })

    it("refuses a not-earlier deadline with the move-earlier guidance when room exists", () => {
        const createId = vi.fn(() => "unused")
        const result = addSurvey(
            validConfig(),
            { ...updateDraft, closesAt: "2026-12-20" },
            new Date("2026-11-20T00:00:00.000Z"),
            createId,
        )
        expect(result).toMatchObject({
            status: "refused",
            line: "error: refused: 締切は現在の締切より前の日付を指定してください。",
        })
        expect(createId).not.toHaveBeenCalled()
    })

    it("returns the fixed wait line when no earlier midnight exists after the opening", () => {
        const current = validConfig()
        // 開始が 11/30 12:00（日本時間）、締切が 12/01 0:00。開始より後で最も早い 0 時は締切と同時刻
        current.surveys[0]!.opensAt = "2026-11-30T12:00:00+09:00"
        const result = addSurvey(
            current,
            { ...updateDraft, closesAt: "2026-12-05" },
            new Date("2026-11-30T20:00:00+09:00"),
        )
        expect(result).toEqual({
            status: "refused",
            line: "error: refused: 前倒しできません。自然な終了と集計を待ってください。",
        })
    })

    it("treats an opening exactly at JST midnight as having the next midnight as the earliest", () => {
        const current = validConfig()
        // 開始が 11/29 0:00（日本時間）ちょうど。最も早い 0 時は 11/30 0:00 で、締切 12/01 0:00 より前
        current.surveys[0]!.opensAt = "2026-11-29T00:00:00+09:00"
        const result = addSurvey(
            current,
            { ...updateDraft, closesAt: "2026-12-05" },
            new Date("2026-11-29T12:00:00+09:00"),
        )
        expect(result).toMatchObject({
            status: "refused",
            line: "error: refused: 締切は現在の締切より前の日付を指定してください。",
        })
    })

    it("uses the next midnight, not the opening itself, when the opening is exactly JST midnight", () => {
        const current = validConfig()
        // 開始が 11/30 0:00（日本時間）ちょうど。「開始より後」の最も早い 0 時は 12/01 0:00 で、締切と同時刻
        current.surveys[0]!.opensAt = "2026-11-30T00:00:00+09:00"
        const result = addSurvey(
            current,
            { ...updateDraft, closesAt: "2026-12-05" },
            new Date("2026-11-30T12:00:00+09:00"),
        )
        expect(result).toEqual({
            status: "refused",
            line: "error: refused: 前倒しできません。自然な終了と集計を待ってください。",
        })
    })

    it("refuses changing questions of an active survey and allows only the deadline", () => {
        const changed = structuredClone(updateDraft)
        changed.questions[0]!.title.ja = "別の質問"
        const result = addSurvey(
            validConfig(),
            { ...changed, closesAt: "2026-11-25" },
            new Date("2026-11-20T00:00:00.000Z"),
        )
        expect(result).toMatchObject({
            status: "refused",
            line: "error: refused: 開催中は締切の前倒し以外を更新できません。",
        })
    })

    it("reports an identical active update as unchanged", () => {
        const result = addSurvey(
            validConfig(),
            { ...updateDraft, closesAt: "2026-12-01" },
            new Date("2026-11-20T00:00:00.000Z"),
        )
        expect(result.status).toBe("unchanged")
    })

    it("accepts an active update that moves the deadline earlier", () => {
        const result = addSurvey(
            validConfig(),
            { ...updateDraft, closesAt: "2026-11-25" },
            new Date("2026-11-20T00:00:00.000Z"),
        )
        expect(result.status).toBe("updated")
    })

    it("refuses an update that reopens a closed survey", () => {
        const result = addSurvey(
            validConfig(),
            { ...updateDraft, closesAt: "2026-12-15" },
            new Date("2026-12-02T00:00:00.000Z"),
        )
        expect(result.status).toBe("refused")
    })

    it("rejects an update deadline at the original opening time", () => {
        const result = addSurvey(
            validConfig(),
            { ...updateDraft, closesAt: "2026-11-01" },
            registeredAt,
        )
        expect(result.status).toBe("invalid")
    })

    it("reports serialized capacity and uses UTF-8 byte length", () => {
        expect(byteLength("あ")).toBe(3)
        expect(VARIABLE_LIMIT_BYTES).toBe(48 * 1024)
        const result = addSurvey(
            { surveys: [] },
            {
                ...newDraft,
                questions: [
                    {
                        ...newDraft.questions[0],
                        title: { ja: "あ".repeat(50000), en: "long" },
                    },
                ],
            },
            registeredAt,
        )
        expect(result.status).toBe("too-large")
    })

    it("serializes surveys in a stable canonical order", () => {
        const config = validConfig()
        expect(serializeConfig(config)).toContain('"id":"survey-2026-a"')
    })
})
