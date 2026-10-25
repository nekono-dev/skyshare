/**
 * 旧形式の投稿の表示ページ（`/posts/{dbIndex}/{slug}`、`/posts/{slug}`）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - 識別子の形式が不正なときに、旧バックエンドへ問い合わせず404を返すことを検証する。
 * - dbIndex を省略した旧形式のURLも、同じ検証を通って404を返すことを検証する。
 */
import { expect, test } from "@playwright/test"

test("[legacy-page/AC-14] dbIndex が数字でも legacy でもないURLは、404を返す", async ({
    page,
}) => {
    const res = await page.goto("/posts/abc/someone@3abc")
    expect(res?.status()).toBe(404)
})

test("[legacy-page/AC-15] 識別子に区切りが無いURLは、404を返す", async ({
    page,
}) => {
    const res = await page.goto("/posts/legacy/no-separator")
    expect(res?.status()).toBe(404)
})

test("[legacy-page/AC-16] dbIndex を省略した識別子が不正なURLも、404を返す", async ({
    page,
}) => {
    const res = await page.goto("/posts/no-separator")
    expect(res?.status()).toBe(404)
})
