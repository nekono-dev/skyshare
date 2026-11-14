/**
 * 予約の待機枠の上限と、認証情報の有効期限の表示文言を確かめる。
 */
import { describe, expect, it } from "vitest"
import { createTranslator } from "@/lib/i18n/translate"
import {
    MAX_PENDING_PER_ACCOUNT,
    getScheduleLimits,
} from "@/lib/schedule/scheduleLimits"

describe("予約の待機枠", () => {
    it("アカウントごとの待機中の予約は 3 枠までで、画面に返す上限も同じ", () => {
        expect(MAX_PENDING_PER_ACCOUNT).toBe(3)
        expect(getScheduleLimits().maxPending).toBe(3)
    })
})

describe("認証情報の有効期限の表示", () => {
    it("日本語: 「認証情報の有効期限: 日付」だけで、補足の括弧を付けない", () => {
        const { t } = createTranslator("ja")

        expect(t("schedule.picker.expiresAt", { date: "2026/12/14" })).toBe(
            "認証情報の有効期限: 2026/12/14",
        )
    })

    it("英語: 同じ形で、補足を付けない", () => {
        const { t } = createTranslator("en")

        expect(t("schedule.picker.expiresAt", { date: "2026/12/14" })).toBe(
            "Credential expiry: 2026/12/14",
        )
    })
})
