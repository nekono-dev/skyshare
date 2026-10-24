/**
 * 旧形式の投稿の削除ボタンの、削除の失敗の文言の選び方の単体テスト。
 */
import { describe, expect, it } from "vitest"
import { deleteFailureKey } from "@/components/entry/LegacyPageDeleteButton"
import { createTranslator } from "@/lib/i18n/translate"

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    })

describe("LegacyPageDeleteButton の失敗の文言", () => {
    it("[legacy-page/AC-18] 削除が識別子つきの403で拒否されると、アプリパスワードでのログインを求める文言になる", async () => {
        const key = await deleteFailureKey(
            json(403, { error: "OAuthSessionUnsupported" }),
        )
        expect(key).toBe("entry.legacy.oauthUnsupported")
        expect(createTranslator("ja").t(key)).toContain("アプリパスワード")
        expect(createTranslator("en").t(key)).toContain("app password")
    })

    it("それ以外の失敗は、削除失敗の文言になる", async () => {
        expect(await deleteFailureKey(json(403, { error: "Forbidden" }))).toBe(
            "entry.legacy.deleteFailed",
        )
        expect(await deleteFailureKey(json(500, {}))).toBe(
            "entry.legacy.deleteFailed",
        )
        expect(
            await deleteFailureKey(new Response("not json", { status: 403 })),
        ).toBe("entry.legacy.deleteFailed")
    })
})
