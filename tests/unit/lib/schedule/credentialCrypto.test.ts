/**
 * Verifies encryption and decryption of scheduled-post credentials.
 */
import { describe, expect, it } from "vitest"
import { decryptToken, encryptToken } from "@/lib/schedule/credentialCrypto"
import { TEST_DID, TEST_KEY_BASE64 } from "../../../fixtures/identities"

/** 別の鍵（テスト用。すべてのバイトが 0xff の 32 バイト） */
const OTHER_KEY_BASE64 = btoa(
    String.fromCharCode(...Array.from({ length: 32 }, () => 0xff)),
)
const OTHER_DID = "did:plc:testfixturebob00000000000000"
const TOKEN = "refresh-token-fixture"

describe("credentialCrypto", () => {
    it("decrypts what it encrypted with the same key and DID", async () => {
        const encrypted = await encryptToken(TEST_KEY_BASE64, TEST_DID, TOKEN)
        expect(await decryptToken(TEST_KEY_BASE64, TEST_DID, encrypted)).toBe(
            TOKEN,
        )
    })

    it("produces a different ciphertext for the same token each time (unique IV)", async () => {
        const a = await encryptToken(TEST_KEY_BASE64, TEST_DID, TOKEN)
        const b = await encryptToken(TEST_KEY_BASE64, TEST_DID, TOKEN)
        expect(a).not.toBe(b)
    })

    it("fails to decrypt with a different key (authentication failure)", async () => {
        const encrypted = await encryptToken(TEST_KEY_BASE64, TEST_DID, TOKEN)
        await expect(
            decryptToken(OTHER_KEY_BASE64, TEST_DID, encrypted),
        ).rejects.toMatchObject({ name: "OperationError" })
    })

    it("fails to decrypt for a different DID, so a row cannot be swapped to another account", async () => {
        const encrypted = await encryptToken(TEST_KEY_BASE64, TEST_DID, TOKEN)
        await expect(
            decryptToken(TEST_KEY_BASE64, OTHER_DID, encrypted),
        ).rejects.toMatchObject({ name: "OperationError" })
    })

    it("fails to decrypt a tampered ciphertext", async () => {
        const encrypted = await encryptToken(TEST_KEY_BASE64, TEST_DID, TOKEN)
        const bytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
        bytes[bytes.length - 1] ^= 0x01
        const tampered = btoa(String.fromCharCode(...bytes))
        await expect(
            decryptToken(TEST_KEY_BASE64, TEST_DID, tampered),
        ).rejects.toMatchObject({ name: "OperationError" })
    })

    it("throws the fixed message for a key that is not Base64", async () => {
        await expect(
            encryptToken("!!!not-base64!!!", TEST_DID, TOKEN),
        ).rejects.toThrow(new Error("encryption key is not valid Base64"))
    })

    it("throws the fixed message for a key that is not 32 bytes", async () => {
        const short = btoa(
            String.fromCharCode(...Array.from({ length: 16 }, (_, i) => i)),
        )
        await expect(encryptToken(short, TEST_DID, TOKEN)).rejects.toThrow(
            new Error("encryption key must be 32 bytes"),
        )
    })
})
