import { describe, expect, test } from "vitest"
import { createFakeD1 } from "../../helpers/fakeD1"
import { decryptToken, encryptToken } from "@/lib/schedule/credentialCrypto"
import {
    claimDueSchedules,
    failSchedule,
    insertSchedule,
    CREDENTIAL_IDLE_SECONDS,
    deleteCredential,
    loadCredential,
    purgeIdleCredentials,
    saveCredential,
    touchCredential,
} from "@/lib/schedule/store"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
const DID = "did:plc:aaaa"

describe("credentialCrypto", () => {
    test("schedule-store/AC-5: 暗号文に平文が含まれず、復号すると元に戻る", async () => {
        const enc = await encryptToken(KEY, DID, "refresh-token-plain")
        expect(enc).not.toContain("refresh-token-plain")
        expect(atob(enc)).not.toContain("refresh-token-plain")
        expect(await decryptToken(KEY, DID, enc)).toBe("refresh-token-plain")
    })

    test("schedule-store/AC-5: 保管した行にも平文が含まれない", async () => {
        const db = createFakeD1()
        await saveCredential(
            db,
            KEY,
            { did: DID, service: "https://pds", token: "plain-secret" },
            1,
        )
        const raw = await db
            .prepare("SELECT token_enc FROM schedule_credentials WHERE did = ?")
            .bind(DID)
            .first<{ token_enc: string }>()
        expect(raw!.token_enc).not.toContain("plain-secret")
        expect(await loadCredential(db, KEY, DID)).toEqual({
            service: "https://pds",
            token: "plain-secret",
        })
    })

    test("schedule-store/AC-12: 同じトークンの暗号文は毎回異なる", async () => {
        const a = await encryptToken(KEY, DID, "same")
        const b = await encryptToken(KEY, DID, "same")
        expect(a).not.toBe(b)
    })

    test("別のアカウントの DID では復号できず、不正な鍵は拒否される", async () => {
        const enc = await encryptToken(KEY, DID, "t")
        await expect(decryptToken(KEY, "did:plc:other", enc)).rejects.toThrow()
        await expect(encryptToken("AAAA", DID, "t")).rejects.toThrow()
        await expect(encryptToken("***", DID, "t")).rejects.toThrow()
    })

    test("schedule-store/AC-6: 待機中の予約が残るか最後の使用から30日以内なら削除されず、どちらにも当たらないと削除される", async () => {
        const db = createFakeD1()
        const now = 100 * 24 * 60 * 60
        const idle = CREDENTIAL_IDLE_SECONDS
        await saveCredential(db, KEY, { did: DID, service: "s", token: "t" }, 1)
        await insertSchedule(db, {
            id: "s1",
            did: DID,
            runAt: 1,
            payload: "{}",
            imageKeys: [],
            now: 0,
        })
        // 待機中の予約が残る
        expect(await purgeIdleCredentials(db, now, idle)).toBe(0)
        // 実行中の予約が残る
        await claimDueSchedules(db, 10, 5)
        expect(await purgeIdleCredentials(db, now, idle)).toBe(0)
        await failSchedule(db, "s1", "InvalidRecord", 11)
        // 最後の使用から30日以内
        await touchCredential(db, DID, now - idle + 1)
        expect(await purgeIdleCredentials(db, now, idle)).toBe(0)
        // どちらにも当たらない
        await touchCredential(db, DID, now - idle - 1)
        expect(await purgeIdleCredentials(db, now, idle)).toBe(1)
        expect(await loadCredential(db, KEY, DID)).toBeNull()
    })

    test("schedule-store/AC-16: 所有アカウントの指示で、待機中の予約が残っていても認証情報が削除される", async () => {
        const db = createFakeD1()
        await saveCredential(db, KEY, { did: DID, service: "s", token: "t" }, 1)
        await saveCredential(
            db,
            KEY,
            { did: "did:plc:other", service: "s", token: "t" },
            1,
        )
        await insertSchedule(db, {
            id: "s1",
            did: DID,
            runAt: 1,
            payload: "{}",
            imageKeys: [],
            now: 0,
        })
        await deleteCredential(db, DID)
        expect(await loadCredential(db, KEY, DID)).toBeNull()
        expect(await loadCredential(db, KEY, "did:plc:other")).not.toBeNull()
    })
})
