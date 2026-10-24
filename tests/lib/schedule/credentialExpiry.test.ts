import { describe, expect, test } from "vitest"
import {
    AUTHORIZATION_LIFETIME_SECONDS,
    estimateCredentialExpiry,
} from "@/lib/schedule/credentialExpiry"
import { CREDENTIAL_IDLE_SECONDS } from "@/lib/schedule/store"

const DAY = 86400

describe("許可の有効期限の目安", () => {
    test("schedule-api/AC-23: 最後の使用か最も遅い待機中の実行時刻から30日と、許可から2年の早い方になる", () => {
        // 予約がなければ、最後の使用から30日
        expect(
            estimateCredentialExpiry({
                authorizedAt: 0,
                updatedAt: 10 * DAY,
                latestRunAt: null,
            }),
        ).toBe(10 * DAY + CREDENTIAL_IDLE_SECONDS)
        // 待機中の予約があれば、その実行で使われるため実行時刻から数える
        expect(
            estimateCredentialExpiry({
                authorizedAt: 0,
                updatedAt: 10 * DAY,
                latestRunAt: 20 * DAY,
            }),
        ).toBe(20 * DAY + CREDENTIAL_IDLE_SECONDS)
        // 許可から2年が先に来るなら、そちら
        const authorizedAt = 0
        const nearEnd = AUTHORIZATION_LIFETIME_SECONDS - 5 * DAY
        expect(
            estimateCredentialExpiry({
                authorizedAt,
                updatedAt: nearEnd,
                latestRunAt: null,
            }),
        ).toBe(authorizedAt + AUTHORIZATION_LIFETIME_SECONDS)
        // 2年は 365.25 日で数える（atproto の参照実装と同じ）
        expect(AUTHORIZATION_LIFETIME_SECONDS).toBe(Math.floor(730.5 * DAY))
    })
})
