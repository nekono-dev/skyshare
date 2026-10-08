import { describe, expect, it } from "vitest"

import { errorMessageKeyFromStatus } from "@/lib/i18n/errorMessage"

describe("errorMessageKeyFromStatus", () => {
    it("[api-error-message/AC-2] 汎用: ステータス別のキーを返す", () => {
        expect(errorMessageKeyFromStatus(400)).toBe("error.badRequest")
        expect(errorMessageKeyFromStatus(401)).toBe("error.unauthorized")
        expect(errorMessageKeyFromStatus(403)).toBe("error.forbidden")
        expect(errorMessageKeyFromStatus(404)).toBe("error.notFound")
        expect(errorMessageKeyFromStatus(409)).toBe("error.conflict")
        expect(errorMessageKeyFromStatus(429)).toBe("error.rateLimited")
    })
    it("[api-error-message/AC-5] 未知のステータスは generic", () => {
        expect(errorMessageKeyFromStatus(500)).toBe("error.generic")
        expect(errorMessageKeyFromStatus(418)).toBe("error.generic")
    })
    it("[api-error-message/AC-3] login: 409 はアカウント数上限、429 はレート制限、その他はログイン失敗", () => {
        expect(errorMessageKeyFromStatus(409, "login")).toBe(
            "error.accountLimitReached",
        )
        expect(errorMessageKeyFromStatus(429, "login")).toBe(
            "error.rateLimited",
        )
        expect(errorMessageKeyFromStatus(401, "login")).toBe(
            "error.loginFailed",
        )
        expect(errorMessageKeyFromStatus(500, "login")).toBe(
            "error.loginFailed",
        )
    })
})
