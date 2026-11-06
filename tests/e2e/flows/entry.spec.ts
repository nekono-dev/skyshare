// Entry の流れ（要件 10.1・10.2・10.3）: 画像を添えた投稿から Entry が作られ（POST /v2/entry/ が Entry を返す）、
// Entry のページで投稿の本文と画像の枠が表示される。Entry の取得は偽の Bluesky の PDS と AppView を通る
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"
import { fakeRequestPaths, loginWithAppPassword } from "./support"

const IMAGE = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../fixtures/images/sample.png",
)
const TEXT = "E2E の Entry です"

test.describe("entry flow", () => {
    test("creates an entry from a post with an image and shows it on the entry page", async ({
        page,
    }) => {
        await loginWithAppPassword(page)
        const before = (await fakeRequestPaths()).length
        await page.goto("/post/")
        await page.waitForLoadState("networkidle")

        await page
            .locator('input[type="file"][accept="image/*"]')
            .first()
            .setInputFiles(IMAGE)
        const body = page.locator('[contenteditable="true"]').first()
        await expect(body).toBeVisible()
        await body.click()
        await page.keyboard.type(TEXT)

        const created = page.waitForResponse(
            res =>
                res.url().endsWith("/v2/entry/") &&
                res.request().method() === "POST",
        )
        const submit = page.getByTestId("composer-submit")
        await expect(submit).toBeEnabled({ timeout: 15_000 })
        await submit.click()
        const res = await created
        expect(res.status()).toBe(200)
        // Entry の作成は、偽の Bluesky の PDS へ画像と書き込み（applyWrites）を送る
        expect((await fakeRequestPaths()).slice(before)).toEqual(
            expect.arrayContaining([
                "POST /xrpc/com.atproto.repo.uploadBlob",
                "POST /xrpc/com.atproto.repo.applyWrites",
            ]),
        )

        // 作られた Entry の AT URI（at://<DID>/<コレクション>/<rkey>）から、Entry のページを開く
        const { skyshareEntry } = (await res.json()) as {
            skyshareEntry?: { atUri: string }
        }
        const [, , did, , rkey] = (skyshareEntry?.atUri ?? "").split("/")
        expect(rkey, "Entry が作られていること").toBeTruthy()

        await page.goto(`/entries/${did}@${rkey}/`)
        await expect(page.getByText(TEXT).first()).toBeVisible()
        await expect(page.getByTestId("entry-visual")).toBeVisible()
    })
})
