import { describe, expect, test } from "vitest"
import { createFakeD1 } from "../../helpers/fakeD1"
import { decryptToken, encryptToken } from "@/lib/schedule/credentialCrypto"
import {
    claimDueSchedules,
    failSchedule,
    insertSchedule,
    CREDENTIAL_IDLE_SECONDS,
    deleteCredential,
    getCredentialStatus,
    loadCredential,
    markCredentialReauth,
    purgeIdleCredentials,
    purgeReauthMarkers,
    REAUTH_MARKER_KEEP_SECONDS,
    saveCredential,
    touchCredential,
} from "@/lib/schedule/store"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
const DID = "did:plc:aaaa"

describe("credentialCrypto", () => {
    test("schedule-store/3.1: 暗号文に平文が含まれず、復号すると元に戻る", async () => {
        const enc = await encryptToken(KEY, DID, "refresh-token-plain")
        expect(enc).not.toContain("refresh-token-plain")
        expect(atob(enc)).not.toContain("refresh-token-plain")
        expect(await decryptToken(KEY, DID, enc)).toBe("refresh-token-plain")
    })

    test("schedule-store/3.1: 保管した行にも平文が含まれない", async () => {
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

    test("schedule-store/3.2: 同じトークンの暗号文は毎回異なる", async () => {
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

    test("schedule-store/3.4,3.5: 待機中の予約が残るか最後の使用から30日以内なら残り、どちらにも当たらないと再度の許可が必要な印になり、印は180日を超えると削除される", async () => {
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
        // どちらにも当たらない: 認証情報は消え、再度の許可が必要な印が残る
        await touchCredential(db, DID, now - idle - 1)
        expect(await purgeIdleCredentials(db, now, idle)).toBe(1)
        expect(await loadCredential(db, KEY, DID)).toBeNull()
        const raw = await db
            .prepare("SELECT token_enc FROM schedule_credentials WHERE did = ?")
            .bind(DID)
            .first<{ token_enc: string }>()
        expect(raw?.token_enc).toBe("")
        expect(await getCredentialStatus(db, DID)).toMatchObject({
            registered: true,
            reauthRequired: true,
        })
        // 印に替えた行は、もう一度は数えない
        expect(await purgeIdleCredentials(db, now, idle)).toBe(0)
        // 印は最後の使用から180日以内なら残り、超えると削除される
        const keep = REAUTH_MARKER_KEEP_SECONDS
        expect(await purgeReauthMarkers(db, now - idle - 1 + keep, keep)).toBe(
            0,
        )
        expect(
            await purgeReauthMarkers(db, now - idle - 1 + keep + 2, keep),
        ).toBe(1)
        expect(await getCredentialStatus(db, DID)).toEqual({
            registered: false,
        })
    })

    test("schedule-store/3.4,3.7: 失効を記録すると取り出せず再度の許可が必要と返り、許可を得て保管し直すと印が外れて許可の時刻が更新される", async () => {
        const db = createFakeD1()
        await saveCredential(
            db,
            KEY,
            { did: DID, service: "s", token: "t" },
            100,
            { authorized: true },
        )
        // トークンの回転による保管し直しでは、許可の時刻を保つ
        await saveCredential(
            db,
            KEY,
            { did: DID, service: "s", token: "t2" },
            200,
        )
        expect(await getCredentialStatus(db, DID)).toEqual({
            registered: true,
            reauthRequired: false,
            updatedAt: 200,
            authorizedAt: 100,
            latestRunAt: null,
        })
        await markCredentialReauth(db, DID)
        expect(await loadCredential(db, KEY, DID)).toBeNull()
        expect(await getCredentialStatus(db, DID)).toMatchObject({
            registered: true,
            reauthRequired: true,
            updatedAt: 200,
        })
        await saveCredential(
            db,
            KEY,
            { did: DID, service: "s", token: "t3" },
            300,
            { authorized: true },
        )
        expect(await loadCredential(db, KEY, DID)).toEqual({
            service: "s",
            token: "t3",
        })
        expect(await getCredentialStatus(db, DID)).toMatchObject({
            reauthRequired: false,
            authorizedAt: 300,
        })
    })

    test("schedule-store/3.6: 所有アカウントの指示で、待機中の予約が残っていても認証情報が削除される", async () => {
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
