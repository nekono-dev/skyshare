// アンケートの回答者の鍵付きハッシュ（P0・要件 2.1 の「アンケートの匿名性」）: 既知の値、アンケートごとの違い、失敗の種類
import { describe, expect, it } from "vitest"
import { respondentHash } from "@/lib/survey/respondentHash"
import { TEST_DID, TEST_KEY_BASE64 } from "../../../fixtures/identities"

const INVALID_KEY_MESSAGE = "invalid respondent hash key"

describe("respondentHash", () => {
    it("returns the known HMAC-SHA256 digest of surveyId + did", async () => {
        // 期待値は Node の crypto で独立に計算した値（鍵は 0〜31 のバイト列）
        expect(
            await respondentHash(TEST_KEY_BASE64, "survey-2026-11", TEST_DID),
        ).toBe(
            "b1bf57075669e7a43e8bdd77f25edb37389f4f3eecb12aed55976602d9a402e8",
        )
    })

    it("returns a 64 character lowercase hex digest", async () => {
        expect(
            await respondentHash(TEST_KEY_BASE64, "survey-2026-11", TEST_DID),
        ).toMatch(/^[0-9a-f]{64}$/)
    })

    it("returns a different digest for a different survey, so answers cannot be linked across surveys", async () => {
        const a = await respondentHash(
            TEST_KEY_BASE64,
            "survey-2026-11",
            TEST_DID,
        )
        const b = await respondentHash(
            TEST_KEY_BASE64,
            "survey-2026-12",
            TEST_DID,
        )
        expect(a).not.toBe(b)
    })

    it("throws the fixed message for a key that is not Base64", async () => {
        await expect(
            respondentHash("!!!not-base64!!!", "survey-2026-11", TEST_DID),
        ).rejects.toThrow(new Error(INVALID_KEY_MESSAGE))
    })

    it("throws the fixed message for a key that is not 32 bytes", async () => {
        const short = btoa(
            String.fromCharCode(...Array.from({ length: 16 }, (_, i) => i)),
        )
        await expect(
            respondentHash(short, "survey-2026-11", TEST_DID),
        ).rejects.toThrow(new Error(INVALID_KEY_MESSAGE))
    })
})
