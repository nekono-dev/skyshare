/**
 * ログインとアカウント切り替え（LoginForm、AccountSwitcher、AccountSwitchPanel）のヘッドレスブラウザによる確認。
 *
 * 責務と処理概要:
 * - セッションAPIの応答を差し替え、アカウントの一覧・切り替え・ログアウト・再ログインの導線・
 *   ログインの成功を検証する。
 * - OAuth のログインは、開始と完了のAPIと認可の画面（bsky.social）を差し替え、開始の依頼・遷移・
 *   戻りでの完了と結果の表示を検証する。
 */
import { expect, test, type Page } from "@playwright/test"
import { openPasswordLogin } from "./fixtures"

const ACCOUNTS = [
    {
        did: "did:plc:active",
        handle: "active.bsky.social",
        displayName: "アクティブ",
        isActive: true,
    },
    {
        did: "did:plc:other",
        handle: "other.bsky.social",
        displayName: "ほかのアカウント",
        isActive: false,
    },
]

const SESSION_URL = /\/v2\/bsky\/session\/?$/
const SESSION_DID_URL = /\/v2\/bsky\/session\/[^/]+\/?$/

/** セッションAPIを差し替える。呼び出された操作とボディを記録して返す */
const mockSessionApi = async (
    page: Page,
    options: { putStatus?: number; accounts?: unknown[] } = {},
) => {
    const calls: { method: string; body?: unknown; url: string }[] = []
    await page.route(SESSION_URL, route => {
        const request = route.request()
        const method = request.method()
        if (method === "GET") {
            return route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    accounts: options.accounts ?? ACCOUNTS,
                }),
            })
        }
        calls.push({
            method,
            url: request.url(),
            body: request.postDataJSON() ?? undefined,
        })
        if (method === "PUT") {
            return route.fulfill({ status: options.putStatus ?? 200 })
        }
        return route.fulfill({ status: 200 })
    })
    await page.route(SESSION_DID_URL, route => {
        calls.push({
            method: route.request().method(),
            url: route.request().url(),
        })
        return route.fulfill({ status: 200 })
    })
    return calls
}

test("[login-accounts/AC-1] アカウントの一覧で、アクティブなアカウントに使用中の表示が付く", async ({
    page,
}) => {
    await mockSessionApi(page)
    await page.goto("/accounts/")
    await expect(page.getByText("ほかのアカウント")).toBeVisible()
    await expect(page.getByText("使用中")).toHaveCount(1)
})

test("[login-accounts/AC-2] 使用中でないアカウントを選ぶと、そのアカウントへの切り替えが依頼される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockSessionApi(page)
    await page.goto("/accounts/")
    const card = page.getByText("ほかのアカウント")
    await expect(async () => {
        await card.click()
        expect(calls.some(c => c.method === "PUT")).toBe(true)
    }).toPass({ timeout: 20_000 })
    expect(calls.find(c => c.method === "PUT")?.body).toEqual({
        did: "did:plc:other",
    })
})

test("[login-accounts/AC-3] 切り替えがセッション切れで拒否されると、要再ログインの表示と再ログインの案内が出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockSessionApi(page, { putStatus: 401 })
    await page.goto("/accounts/")
    const card = page.getByText("ほかのアカウント")
    await expect(async () => {
        await card.click()
        expect(calls.some(c => c.method === "PUT")).toBe(true)
    }).toPass({ timeout: 20_000 })
    await expect(page.getByText("要再ログイン")).toBeVisible()
    await expect(
        page.getByRole("heading", { name: "@other.bsky.social に再ログイン" }),
    ).toBeVisible()
    await openPasswordLogin(page)
    await expect(page.locator("#username")).toHaveValue("other.bsky.social")
})

test("[login-accounts/AC-4] ログアウトを押すと、そのアカウントのログアウトが依頼される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockSessionApi(page)
    await page.goto("/accounts/")
    const card = page
        .locator("div")
        .filter({ hasText: "ほかのアカウント" })
        .filter({ has: page.getByRole("button", { name: "ログアウト" }) })
        .last()
    await expect(async () => {
        await card.getByRole("button", { name: "ログアウト" }).click()
        expect(calls.some(c => c.method === "DELETE")).toBe(true)
    }).toPass({ timeout: 20_000 })
    expect(
        decodeURIComponent(calls.find(c => c.method === "DELETE")?.url ?? ""),
    ).toContain("did:plc:other")
})

test("[login-accounts/AC-5] 未ログインでアカウントのページを開くと、ログインのページへ遷移する", async ({
    page,
}) => {
    await page.route(SESSION_URL, route =>
        route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ error: "Unauthorized" }),
        }),
    )
    await page.goto("/accounts/")
    await page.waitForURL(/\/login\/?/, { timeout: 30_000 })
})

test("[login-accounts/AC-6] ハンドルとパスワードを送信してログインに成功すると、成功の表示が出る", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const calls = await mockSessionApi(page)
    await page.goto("/login/")
    await openPasswordLogin(page)
    await expect(async () => {
        await page.locator("#username").fill("me.bsky.social")
        await page.locator("#password").fill("app-password")
        await page
            .getByRole("button", { name: "ログイン", exact: true })
            .click()
        expect(calls.some(c => c.method === "POST")).toBe(true)
    }).toPass({ timeout: 20_000 })
    expect(calls.find(c => c.method === "POST")?.body).toMatchObject({
        identifier: "me.bsky.social",
        password: "app-password",
    })
    await expect(
        page.getByText("ログイン成功。リダイレクトします…"),
    ).toBeVisible()
})

test("[login-accounts/AC-7] 旧アプリのパスは、ログインのページへ転送される", async ({
    page,
}) => {
    await page.goto("/app/")
    await page.waitForURL(/\/login\/?/, { timeout: 30_000 })
})

test("[login-accounts/AC-8] ログインのページに、旧UIとゲスト表示へのリンクを含む案内が表示される", async ({
    page,
}) => {
    await page.goto("/login/")
    await expect(
        page.getByRole("link", { name: "Skyshare v1.6.3" }),
    ).toHaveAttribute("href", "/legacy/")
    await expect(page.locator('a[href="/?guest=1"]')).toBeVisible()
})

const AUTHORIZATION_URL = /\/v2\/bsky\/session\/authorization\/?$/
const COMPLETION_URL = /\/v2\/bsky\/session\/authorization\/completion\/?$/
const AUTHORIZE_PAGE =
    "https://bsky.social/oauth/authorize?request_uri=urn%3Atest"

/**
 * OAuth のログインの開始と完了のAPIと、認可の画面を差し替える。
 * セッションAPIの差し替え（`SESSION_DID_URL` は開始のパスにも一致する）より後に登録して優先させる。
 */
const mockOAuthApi = async (
    page: Page,
    options: {
        completion?: { status?: number; result?: string }
        /** 完了の応答をこの Promise が解決するまで待たせる（完了までの表示を確かめるとき） */
        holdCompletion?: Promise<void>
    } = {},
) => {
    const calls: { kind: "start" | "complete"; body?: unknown }[] = []
    await page.route("https://bsky.social/**", route =>
        route.fulfill({ contentType: "text/html", body: "<p>authorize</p>" }),
    )
    await page.route(AUTHORIZATION_URL, route => {
        calls.push({ kind: "start", body: route.request().postDataJSON() })
        return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ url: AUTHORIZE_PAGE }),
        })
    })
    await page.route(COMPLETION_URL, async route => {
        calls.push({ kind: "complete", body: route.request().postDataJSON() })
        await options.holdCompletion
        const status = options.completion?.status ?? 200
        return route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(
                status === 200
                    ? { result: options.completion?.result ?? "ok" }
                    : { error: "Conflict" },
            ),
        })
    })
    return calls
}

test("[login-accounts/AC-9] ログインのページを開くと OAuth のボタンだけが表示され、従来形式でのログインを開くとハンドルとパスワードの入力欄が表示される", async ({
    page,
}) => {
    await page.goto("/login/")
    await expect(
        page.getByRole("button", { name: "Bluesky でログイン" }),
    ).toBeVisible()
    const toggle = page.getByRole("button", { name: "従来形式でのログイン" })
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    // 閉じている間はユーザー名の入力欄が無い
    await expect(page.locator("#username")).toHaveCount(0)
    await openPasswordLogin(page)
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator("#password")).toBeVisible()
})

test("[login-accounts/AC-10] OAuth のボタンを押すとログインの開始が依頼され、返った住所へ遷移する", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockSessionApi(page)
    const calls = await mockOAuthApi(page)
    await page.goto("/login/")
    await expect(async () => {
        await page.getByRole("button", { name: "Bluesky でログイン" }).click()
        expect(calls.some(c => c.kind === "start")).toBe(true)
    }).toPass({ timeout: 20_000 })
    expect(calls.find(c => c.kind === "start")?.body).toEqual({
        returnTo: "/login/",
    })
    await page.waitForURL(AUTHORIZE_PAGE, { timeout: 30_000 })
})

test("[login-accounts/AC-11] 戻りの項目を持つ住所でページを開くと、完了が依頼されて住所から項目が消え、成功ならトップへ遷移する", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockSessionApi(page)
    const calls = await mockOAuthApi(page)
    await page.goto(
        "/login/#oauthReturn=session&code=C1&state=S1&iss=https%3A%2F%2Fbsky.social",
    )
    await expect
        .poll(() => calls.find(c => c.kind === "complete")?.body, {
            timeout: 30_000,
        })
        .toEqual({ code: "C1", state: "S1", iss: "https://bsky.social" })
    await page.waitForURL(url => url.pathname === "/", { timeout: 30_000 })
    expect(calls.filter(c => c.kind === "complete")).toHaveLength(1)
})

test("[login-accounts/AC-12] 完了が失敗の分類を返すと、理由の文言が表示される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockSessionApi(page)
    await mockOAuthApi(page, { completion: { result: "AccountUnverified" } })
    await page.goto("/login/#oauthReturn=session&code=C1&state=S1")
    await expect(
        page.getByText(
            "このアカウントは Bluesky でのログインに対応していません。アプリパスワードでログインしてください。",
        ),
    ).toBeVisible({ timeout: 30_000 })
    // 再読み込みで同じ項目を送らないよう、住所から項目が消えている
    expect(new URL(page.url()).hash).toBe("")
    expect(new URL(page.url()).pathname).toBe("/login/")
})

test("[login-accounts/AC-13] 再ログインの案内で OAuth のボタンを押すと、対象のハンドルを指定した開始が依頼される", async ({
    page,
}) => {
    test.setTimeout(90_000)
    const sessionCalls = await mockSessionApi(page, { putStatus: 401 })
    const calls = await mockOAuthApi(page)
    await page.goto("/accounts/")
    const card = page.getByText("ほかのアカウント")
    await expect(async () => {
        await card.click()
        expect(sessionCalls.some(c => c.method === "PUT")).toBe(true)
    }).toPass({ timeout: 20_000 })
    await expect(
        page.getByRole("heading", { name: "@other.bsky.social に再ログイン" }),
    ).toBeVisible()
    await expect(async () => {
        await page.getByRole("button", { name: "Bluesky でログイン" }).click()
        expect(calls.some(c => c.kind === "start")).toBe(true)
    }).toPass({ timeout: 20_000 })
    expect(calls.find(c => c.kind === "start")?.body).toEqual({
        returnTo: "/accounts/",
        loginHint: "other.bsky.social",
    })
})

test("[login-accounts/AC-14] 戻りの住所で開くと、完了の応答の前からログイン中の表示が出てフォームが押せず、失敗の後は押せるようになる", async ({
    page,
}) => {
    test.setTimeout(90_000)
    await mockSessionApi(page)
    let release = () => {}
    const holdCompletion = new Promise<void>(resolve => {
        release = resolve
    })
    const calls = await mockOAuthApi(page, {
        completion: { result: "AccountUnverified" },
        holdCompletion,
    })
    await page.goto("/login/#oauthReturn=session&code=C1&state=S1")
    const form = page.locator("#login-form")
    // 完了の応答を待っている間
    await expect(page.getByText("ログイン中…").first()).toBeVisible()
    await expect(form).toHaveCSS("pointer-events", "none")
    await expect
        .poll(() => calls.some(c => c.kind === "complete"), { timeout: 30_000 })
        .toBe(true)
    // CSS を越えて押しても（キーボードの送信と同じく）、ログインを始めない
    await page
        .getByRole("button", { name: "Bluesky でログイン" })
        .dispatchEvent("click")
    expect(calls.some(c => c.kind === "start")).toBe(false)

    release()
    await expect(
        page.getByText(
            "このアカウントは Bluesky でのログインに対応していません。アプリパスワードでログインしてください。",
        ),
    ).toBeVisible({ timeout: 30_000 })
    await expect(form).toHaveCSS("pointer-events", "auto")
    // 部品の外の「ログイン中…」は CSS で隠れ、部品の表示は結果に替わる
    await expect(page.getByText("ログイン中…")).toBeHidden()
})
