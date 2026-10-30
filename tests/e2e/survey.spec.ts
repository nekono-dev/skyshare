/**
 * アンケートの判定と端末の記録の経路（ヘッドレスブラウザでの操作後の表示）の確認。
 *
 * 責務と処理概要:
 * - セッション（`/v2/bsky/session`）とアンケートの 3 つの操作（回答済みの確認・登録・回答の送信）の応答を
 *   `page.route` で差し替え、呼び出しの回数・送信本文・端末の記録（localStorage・sessionStorage）を検証する。
 * - ダイアログが「出ない」ことを確かめるテストには、同じテスト内で「出る」ことの肯定的な確認（対照）を含める。
 *   出ないことだけの確認は、配信用の設定が無効なとき空振りで通ってしまうため。
 * - 配信用の設定（`/surveys/index.json`）が取得できないときは、理由を示して見送る（`publishedSurveyConfigSkipReason`）。
 * - アンケートの文言は `tests/fixtures/survey/e2e-open.json` から読む。アプリ自身の固定文言は、i18n の正本から読む。
 * - 通信の確認は、ページの要求（request）の記録で行う。アンケートの API は `/v2/surveys/` 配下の要求で数える。
 */
import fs from "node:fs"
import path from "node:path"
import type { Page, Route } from "@playwright/test"
import { expect, publishedSurveyConfigSkipReason, test } from "./fixtures"
import { survey as surveyMessages } from "../../src/lib/i18n/messages/ja/survey"

type FixtureOption = { id: string; label: { ja: string }; decline?: boolean }
type FixtureQuestion = {
    id: string
    kind: "single" | "multiple"
    title: { ja: string }
    options: FixtureOption[]
}
type FixtureSurvey = {
    id: string
    title: { ja: string }
    questions: FixtureQuestion[]
}

/** 検証用の設定（開催中・3 種の質問を含む）。文言はここから読む */
const fixture: { surveys: FixtureSurvey[] } = JSON.parse(
    fs.readFileSync(
        path.resolve("tests/fixtures/survey/e2e-open.json"),
        "utf8",
    ),
)
const survey = fixture.surveys[0]
const [single, multiple] = survey.questions
const SURVEY_ID = survey.id
const TITLE = survey.title.ja
const RECORD_KEY = `skyshare.survey.${SURVEY_ID}`
const DECLINED_KEY = `skyshare.survey.${SURVEY_ID}.declined`
// ログイン状態の未ログインの印（src/lib/account/activeAccountSession.ts の保存キー）
const UNAUTHENTICATED_KEY = "skyshare:session-unauthenticated"
const DID_A = "did:plc:survey-account-a"
const DID_B = "did:plc:survey-account-b"

const optionLabel = (question: FixtureQuestion, id: string): string => {
    const option = question.options.find(o => o.id === id)
    if (!option) throw new Error(`選択肢 ${id} が見つからない`)
    return option.label.ja
}
const declineLabel = (question: FixtureQuestion): string => {
    const option = question.options.find(o => o.decline)
    if (!option) throw new Error("「回答しない」が見つからない")
    return option.label.ja
}

const SUBMIT = surveyMessages["survey.submit"]
const CLOSE = surveyMessages["survey.close"]
const SUBMIT_FAILED = surveyMessages["survey.submitFailed"]

/**
 * dev サーバーの初回コンパイルを待つためのウォームアップ（既存の spec と同じ方針）。
 * 初回の読み込みは依存の最適化で中断されることがあるため、判定の確認の前に済ませる。
 */
test.beforeAll(async ({ browser }) => {
    test.setTimeout(90_000)
    // 実行環境のネットワーク変動による一過性の失敗（ERR_NETWORK_CHANGED）は、fixtures の goto と同じく再試行する
    for (let attempt = 1; ; attempt++) {
        const page = await browser.newPage({ ignoreHTTPSErrors: true })
        try {
            await page.goto("https://localhost:4321/settings/?guest", {
                timeout: 60_000,
            })
            return
        } catch (err) {
            if (!String(err).includes("ERR_NETWORK_CHANGED") || attempt >= 3)
                throw err
        } finally {
            await page.close()
        }
    }
})

/** 配信用の設定が取得できないときは、理由を示して全体を見送る */
test.beforeEach(async ({ request }) => {
    const reason = await publishedSurveyConfigSkipReason(request)
    test.skip(reason !== undefined, reason ?? "")
})

// ---- 要求の経路 ----

const isPath = (suffix: string) => (url: URL) =>
    url.pathname.replace(/\/$/, "") === suffix
const isSession = isPath("/v2/bsky/session")
const isRespondent = isPath(`/v2/surveys/${SURVEY_ID}/respondent`)
const isAnswers = isPath(`/v2/surveys/${SURVEY_ID}/answers`)
const isConfig = (url: URL) => url.pathname === "/surveys/index.json"

/** ページが出した要求の記録。アンケートの API（/v2/surveys/）と配信用の設定の取得を数える */
type Traffic = { survey: string[]; configFetches: number }

const trafficOf = (page: Page): Traffic => {
    const log: Traffic = { survey: [], configFetches: 0 }
    page.on("request", request => {
        const { pathname } = new URL(request.url())
        if (pathname.startsWith("/v2/surveys/")) {
            log.survey.push(`${request.method()} ${pathname}`)
        }
        if (pathname === "/surveys/index.json") log.configFetches += 1
    })
    return log
}

// ---- アンケート API の応答（テストごとに書き換えられる） ----

type Reply = { status: number; body?: unknown }
type Api = {
    /** 回答済みの確認（GET）の応答 */
    respondent: Reply
    /** 端末の回答済みの登録（PUT）の応答 */
    registerStatus: number
    /** 回答の送信（POST）の応答 */
    answer: Reply
    /** 確認（GET）の回数 */
    gets: number
    /** 登録（PUT）の回数 */
    registers: number
    /** 送信された本文 */
    submitted: unknown[]
}

const newApi = (respondent: Reply): Api => ({
    respondent,
    registerStatus: 204,
    answer: { status: 201 },
    gets: 0,
    registers: 0,
    submitted: [],
})

const fulfill = (route: Route, reply: Reply) =>
    reply.body === undefined
        ? route.fulfill({ status: reply.status })
        : route.fulfill({
              status: reply.status,
              contentType: "application/json",
              body: JSON.stringify(reply.body),
          })

/** アンケートの 3 つの操作を `api` の応答で差し替える（後から呼んだ経路が優先される） */
const mockSurveyApi = async (page: Page, api: Api): Promise<void> => {
    await page.route(isRespondent, route => {
        const method = route.request().method()
        if (method === "GET") {
            api.gets += 1
            return fulfill(route, api.respondent)
        }
        if (method === "PUT") {
            api.registers += 1
            return fulfill(route, { status: api.registerStatus })
        }
        return route.fallback()
    })
    await page.route(isAnswers, route => {
        if (route.request().method() !== "POST") return route.fallback()
        api.submitted.push(route.request().postDataJSON())
        return fulfill(route, api.answer)
    })
}

/** セッションの応答。`did` が null のときは未ログイン（401） */
const mockSession = async (page: Page, did: string | null): Promise<void> => {
    await page.route(isSession, route =>
        did === null
            ? fulfill(route, { status: 401, body: { error: "Unauthorized" } })
            : fulfill(route, {
                  status: 200,
                  body: {
                      accounts: [
                          {
                              did,
                              handle: "survey.test",
                              avatarUrl: "https://avatar.example.test/a.png",
                              isActive: true,
                          },
                      ],
                  },
              }),
    )
    // アイコンの取得は行わない（ページの読み込みを待たせないため）
    await page.route("https://avatar.example.test/**", route => route.abort())
}

// ---- 画面の操作と読み取り ----

const dialog = (page: Page) => page.getByRole("dialog", { name: TITLE })

const choose = async (
    page: Page,
    question: FixtureQuestion,
    label: string,
): Promise<void> => {
    await page
        .getByRole("group", { name: question.title.ja })
        .locator("label", { hasText: label })
        .click()
}

/** 配信用の設定の取得が終わるのを待つ（判定の前段の通信の完了） */
const configLoaded = (page: Page) =>
    page.waitForResponse(response => isConfig(new URL(response.url())))

/**
 * 判定の後に起きうる要求を見送るための固定の猶予（ミリ秒）。
 */
const GRACE_MS = 1500

/**
 * 「出ない」「要求が出ない」を確かめる前に、ページの初期化（ハイドレーション）を待ち、固定の猶予を置く。
 * 判定をしないページ（プライバシー・ゲスト表示・未ログイン）は要求を出さないため、要求の完了を示す決定的な信号が無い。
 * そのため、初期化の完了の後に固定の時間を置いて、遅れて出る要求が無いことを確かめる。
 */
const settle = async (page: Page): Promise<void> => {
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0, {
        timeout: 30_000,
    })
    await page.waitForTimeout(GRACE_MS)
}

/**
 * 指定の要求が猶予の時間の内に出たかを返す（要求が出ないことを確かめるための、有界の待ち）。
 * 要求が出れば解決して true、出なければ時間切れで false になる。
 */
const requestWithin = (
    page: Page,
    match: (url: URL) => boolean,
    ms = GRACE_MS,
): Promise<boolean> =>
    page
        .waitForRequest(request => match(new URL(request.url())), {
            timeout: ms,
        })
        .then(
            () => true,
            () => false,
        )

const readRecord = (page: Page) =>
    page
        .evaluate(key => window.localStorage.getItem(key), RECORD_KEY)
        .then(raw => (raw === null ? null : JSON.parse(raw)))

const readDeclined = (page: Page) =>
    page.evaluate(key => window.sessionStorage.getItem(key), DECLINED_KEY)

/**
 * 端末の記録を書き込む。プライバシーのページは判定しないため、ここでは通信もダイアログも起きない。
 */
const seedRecord = async (page: Page, value: unknown): Promise<void> => {
    await page.goto("/privacy/")
    await page.evaluate(([key, raw]) => window.localStorage.setItem(key, raw), [
        RECORD_KEY,
        JSON.stringify(value),
    ] as const)
}

/** アプリ内のクライアント遷移（Astro のルーターを通すリンクのクリック）で移動する */
const navigateInApp = async (page: Page, href: string): Promise<void> => {
    await page.evaluate(target => {
        const link = document.createElement("a")
        link.href = target
        document.body.append(link)
        link.click()
        link.remove()
    }, href)
    await page.waitForURL(url => url.pathname === href)
}

/**
 * 再読み込み（ERR_NETWORK_CHANGED の一過性の失敗は再試行する。fixtures の goto と同じ方針）。
 */
const reloadWithRetry = async (page: Page): Promise<void> => {
    for (let attempt = 1; ; attempt++) {
        try {
            await page.reload()
            return
        } catch (err) {
            if (!String(err).includes("ERR_NETWORK_CHANGED") || attempt >= 3)
                throw err
        }
    }
}

/** 同じ画面を再読み込みし、判定の前段（配信用の設定の取得）と、その後の猶予まで待つ */
const reloadAndSettle = async (page: Page): Promise<void> => {
    const loaded = configLoaded(page)
    await reloadWithRetry(page)
    await loaded
    await settle(page)
}

/** 新しいタブでの判定に相当する状態にする（タブ単位の sessionStorage を消す） */
const newTabState = (page: Page) =>
    page.evaluate(() => window.sessionStorage.clear())

// ---- 経路の確認 ----

test.describe("起動時の判定と端末の記録", () => {
    test("[survey-form/8.1 survey-form/1.2 survey-form/2.3 survey-form/2.5 survey-form/4.1 survey-form/4.3] 未回答で起動するとダイアログが出て、回答して送信すると閉じて記録され、再読み込みでも出ない", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        const log = trafficOf(page)
        await mockSession(page, DID_A)
        await mockSurveyApi(page, api)

        const config = configLoaded(page)
        await page.goto("/settings/")
        await config

        // 肯定的な確認: ダイアログが出て、判定は一度だけ行われる
        await expect(dialog(page)).toBeVisible()
        await settle(page)
        expect(api.gets).toBe(1)
        expect(await readRecord(page)).toBeNull()

        const submit = dialog(page).getByRole("button", { name: SUBMIT })
        await expect(submit).toBeDisabled()
        await choose(page, single, optionLabel(single, "daily"))
        await choose(page, multiple, optionLabel(multiple, "share"))
        await choose(page, multiple, optionLabel(multiple, "compose"))
        await expect(submit).toBeEnabled()
        await submit.click()

        await expect(dialog(page)).toBeHidden()
        expect(api.submitted).toEqual([
            {
                answers: {
                    frequency: "daily",
                    features: ["share", "compose"],
                },
            },
        ])
        expect(await readRecord(page)).toEqual({
            answered: true,
            dids: [DID_A],
        })

        // 再読み込み: 記録があるため、回答済みの確認も再表示もない
        await reloadAndSettle(page)
        await expect(dialog(page)).toBeHidden()
        expect(api.gets).toBe(1)
        expect(api.submitted).toHaveLength(1)
        expect(log.survey).toEqual([
            `GET /v2/surveys/${SURVEY_ID}/respondent/`,
            `POST /v2/surveys/${SURVEY_ID}/answers/`,
        ])
    })

    test("[survey-form/1.7] 同じ画面を開いている間は、同じアンケートの判定を繰り返さない", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        const log = trafficOf(page)
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)

        await page.goto("/settings/")
        await expect(dialog(page)).toBeVisible()
        expect(api.gets).toBe(1)

        // 同じ画面でページの初期化の通知（astro:page-load）が起きても、判定は行われない。
        // 判定が行われれば設定の取得が出るため、その要求が猶予の間に出ないことを確かめる
        const again = requestWithin(
            page,
            url => url.pathname === "/surveys/index.json",
        )
        await page.evaluate(() =>
            document.dispatchEvent(new Event("astro:page-load")),
        )
        expect(await again).toBe(false)
        await expect(dialog(page)).toBeVisible()
        expect(api.gets).toBe(1)
        expect(log.survey).toEqual([`GET /v2/surveys/${SURVEY_ID}/respondent/`])
    })

    test("[survey-form/2.1] 端末の記録にアカウントがあれば、ダイアログも回答の確認も無い。記録に無いアカウントでは確認が行われ、ダイアログが出る（対照）", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        const log = trafficOf(page)
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)
        await seedRecord(page, { answered: false, dids: [DID_A] })

        const config = configLoaded(page)
        await page.goto("/settings/")
        await config
        // 設定の取得の後、記録による判定は通信を伴わない。遅れて出る確認の要求が無いことを固定の猶予で確かめる
        await settle(page)
        await expect(dialog(page)).toBeHidden()
        expect(log.survey).toEqual([])

        // 対照: 同じ端末の記録に無いアカウントでは、確認が行われてダイアログが出る
        await mockSession(page, DID_B)
        await reloadAndSettle(page)
        await expect(dialog(page)).toBeVisible()
        expect(log.survey).toEqual([`GET /v2/surveys/${SURVEY_ID}/respondent/`])
        expect(await readRecord(page)).toEqual({
            answered: false,
            dids: [DID_A],
        })
    })

    test("[survey-form/2.2] 端末が回答済みで新しいアカウントのときは、回答済みとして登録し、記録にアカウントを加える（確認はしない）", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        const log = trafficOf(page)
        await mockSurveyApi(page, api)
        await mockSession(page, DID_B)
        await seedRecord(page, { answered: true, dids: [DID_A] })

        await page.goto("/settings/")
        // 判定が動いたことの確認: 登録の要求が 1 回出て、記録にアカウントが加わる（記録は応答の後に書かれるため待つ）
        await expect.poll(() => api.registers).toBe(1)
        await expect
            .poll(() => readRecord(page))
            .toEqual({
                answered: true,
                dids: [DID_A, DID_B],
            })
        await settle(page)
        await expect(dialog(page)).toBeHidden()
        expect(api.gets).toBe(0)
        expect(api.submitted).toEqual([])
        expect(log.survey).toEqual([`PUT /v2/surveys/${SURVEY_ID}/respondent/`])

        // 対照: 記録を消すと、同じアカウントでも確認が行われ、未回答ならダイアログが出る
        await page.evaluate(
            key => window.localStorage.removeItem(key),
            RECORD_KEY,
        )
        await reloadAndSettle(page)
        await expect(dialog(page)).toBeVisible()
        expect(api.gets).toBe(1)
    })

    test("[survey-form/2.4] 回答済みの確認が回答済みと返したときは、ダイアログを出さず、端末を回答済みとして記録する", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: true } })
        const log = trafficOf(page)
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)

        await page.goto("/settings/")
        await expect.poll(() => api.gets).toBe(1)
        // 記録は確認の応答の後に書かれるため、書かれるのを待つ
        await expect
            .poll(() => readRecord(page))
            .toEqual({
                answered: true,
                dids: [DID_A],
            })
        await settle(page)
        await expect(dialog(page)).toBeHidden()
        expect(api.registers).toBe(0)
        expect(api.submitted).toEqual([])
        expect(log.survey).toEqual([`GET /v2/surveys/${SURVEY_ID}/respondent/`])

        // 対照: 記録を消し、確認が未回答と返せば、同じアカウントでダイアログが出る
        await page.evaluate(
            key => window.localStorage.removeItem(key),
            RECORD_KEY,
        )
        api.respondent = { status: 200, body: { answered: false } }
        await reloadAndSettle(page)
        await expect(dialog(page)).toBeVisible()
        expect(api.gets).toBe(2)
    })

    test("[survey-form/2.6] 回答済みの確認が終了（404）と返したときは、ダイアログも記録もなく、次の起動で再度判定する（対照あり）", async ({
        page,
    }) => {
        const api = newApi({ status: 404, body: { error: "Not Found" } })
        const log = trafficOf(page)
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)

        await page.goto("/settings/")
        await expect.poll(() => api.gets).toBe(1)
        await settle(page)
        await expect(dialog(page)).toBeHidden()
        expect(await readRecord(page)).toBeNull()

        // 対照: 次の起動で未回答と返せば、ダイアログが出る
        api.respondent = { status: 200, body: { answered: false } }
        await reloadAndSettle(page)
        await expect(dialog(page)).toBeVisible()
        expect(api.gets).toBe(2)
        expect(log.survey).toEqual([
            `GET /v2/surveys/${SURVEY_ID}/respondent/`,
            `GET /v2/surveys/${SURVEY_ID}/respondent/`,
        ])
    })

    test("[survey-form/2.7] 回答済みの確認が失敗したときは、ダイアログも記録もなく続行し、次の起動で再度判定する（対照あり）", async ({
        page,
    }) => {
        const api = newApi({ status: 500, body: { error: "Unknown Error" } })
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)

        await page.goto("/settings/")
        await expect.poll(() => api.gets).toBe(1)
        await settle(page)
        await expect(dialog(page)).toBeHidden()
        expect(await readRecord(page)).toBeNull()

        // 対照: 次の起動で未回答と返せば、ダイアログが出る
        api.respondent = { status: 200, body: { answered: false } }
        await reloadAndSettle(page)
        await expect(dialog(page)).toBeVisible()
        expect(api.gets).toBe(2)
    })

    test("[survey-form/5.4 survey-form/5.5 survey-form/5.7 survey-form/8.1] 「回答しない」で閉じると、送信も記録もせず、同じタブでは再表示も通信もない（新しいタブの対照あり）", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        const log = trafficOf(page)
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)

        await page.goto("/settings/")
        await expect(dialog(page)).toBeVisible()
        await choose(page, single, declineLabel(single))
        const close = dialog(page).getByRole("button", { name: CLOSE })
        await expect(close).toBeEnabled()
        await close.click()

        await expect(dialog(page)).toBeHidden()
        expect(api.submitted).toEqual([])
        expect(api.registers).toBe(0)
        expect(await readRecord(page)).toBeNull()
        expect(await readDeclined(page)).toBe("1")

        // 同じタブで再読み込み: 再表示せず、アンケートの確認の通信もない
        await reloadAndSettle(page)
        await expect(dialog(page)).toBeHidden()
        expect(api.gets).toBe(1)
        expect(log.survey).toEqual([`GET /v2/surveys/${SURVEY_ID}/respondent/`])

        // 対照: 新しいタブ（タブの印を消した状態）では、判定し直してダイアログが出る
        await newTabState(page)
        await reloadAndSettle(page)
        await expect(dialog(page)).toBeVisible()
        expect(api.gets).toBe(2)
    })

    test("[survey-form/4.4] 送信が重複（409）と返したときは、回答済みとして記録して閉じ、エラーを示さない", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        api.answer = { status: 409, body: { error: "Conflict" } }
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)

        await page.goto("/settings/")
        await expect(dialog(page)).toBeVisible()
        await choose(page, single, optionLabel(single, "sometimes"))
        await choose(page, multiple, optionLabel(multiple, "schedule"))
        await dialog(page).getByRole("button", { name: SUBMIT }).click()

        await expect(dialog(page)).toBeHidden()
        expect(api.submitted).toHaveLength(1)
        expect(await readRecord(page)).toEqual({
            answered: true,
            dids: [DID_A],
        })
        await expect(page.getByRole("alert")).toHaveCount(0)
    })

    for (const reply of [
        { status: 404, error: "Not Found", name: "終了（404）" },
        { status: 401, error: "Unauthorized", name: "未認証（401）" },
    ]) {
        test(`[survey-form/4.5 survey-form/4.6] 送信が${reply.name}と返したときは、記録せず、エラーを示さずに閉じる`, async ({
            page,
        }) => {
            const api = newApi({ status: 200, body: { answered: false } })
            api.answer = { status: reply.status, body: { error: reply.error } }
            await mockSurveyApi(page, api)
            await mockSession(page, DID_A)

            await page.goto("/settings/")
            await expect(dialog(page)).toBeVisible()
            await choose(page, single, optionLabel(single, "daily"))
            await choose(page, multiple, optionLabel(multiple, "share"))
            await dialog(page).getByRole("button", { name: SUBMIT }).click()

            await expect(dialog(page)).toBeHidden()
            expect(api.submitted).toHaveLength(1)
            expect(await readRecord(page)).toBeNull()
            await expect(page.getByRole("alert")).toHaveCount(0)
        })
    }

    test("[survey-form/4.7] 送信が失敗（500）したときは、失敗を示して選択を保ったまま開き続け、再送信で記録して閉じる", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        api.answer = { status: 500, body: { error: "Unknown Error" } }
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)

        await page.goto("/settings/")
        await expect(dialog(page)).toBeVisible()
        await choose(page, single, optionLabel(single, "daily"))
        await choose(page, multiple, optionLabel(multiple, "share"))
        await dialog(page).getByRole("button", { name: SUBMIT }).click()

        // 失敗: 開いたままで、失敗の文言が出て、選択が残り、再び押せる
        await expect(dialog(page).getByRole("alert")).toHaveText(SUBMIT_FAILED)
        await expect(
            dialog(page).getByRole("radio", {
                name: optionLabel(single, "daily"),
            }),
        ).toBeChecked()
        await expect(
            dialog(page).getByRole("button", { name: SUBMIT }),
        ).toBeEnabled()
        expect(await readRecord(page)).toBeNull()

        // 再送信: 保存されて閉じ、記録される
        api.answer = { status: 201 }
        await dialog(page).getByRole("button", { name: SUBMIT }).click()
        await expect(dialog(page)).toBeHidden()
        expect(api.submitted).toHaveLength(2)
        expect(api.submitted[1]).toEqual(api.submitted[0])
        expect(await readRecord(page)).toEqual({
            answered: true,
            dids: [DID_A],
        })
    })

    test("[survey-form/1.4 survey-form/1.5 survey-form/8.2] ダイアログの表示中にプライバシーポリシーへクライアント遷移すると、ダイアログが閉じ、アンケートの通信は増えない", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        const log = trafficOf(page)
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)

        await page.goto("/settings/")
        await expect(dialog(page)).toBeVisible()
        await settle(page)
        const before = [...log.survey]
        const configBefore = log.configFetches
        // クライアント遷移（再読み込みではない）であることを、ページの状態（窓のマーカー）が残ることで確かめる
        await page.evaluate(() => {
            ;(window as unknown as Record<string, unknown>).surveyMarker =
                "kept"
        })

        await navigateInApp(page, "/privacy/")

        await expect(dialog(page)).toBeHidden()
        await settle(page)
        expect(
            await page.evaluate(
                () =>
                    (window as unknown as Record<string, unknown>).surveyMarker,
            ),
        ).toBe("kept")
        expect(log.survey).toEqual(before)
        expect(log.configFetches).toBe(configBefore)
        expect(api.gets).toBe(1)
    })

    test("[survey-form/1.4 survey-form/1.5 survey-form/8.2] プライバシーポリシーのページでは判定も通信もせず、そこから他のページへクライアント遷移すると判定される（対照あり）", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        const log = trafficOf(page)
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)

        await page.goto("/privacy/")
        // プライバシーのページは判定しないため要求は出ない。決定的な信号が無いので、初期化の後の固定の猶予で確かめる
        await settle(page)
        await expect(dialog(page)).toBeHidden()
        expect(log.survey).toEqual([])
        expect(log.configFetches).toBe(0)

        // 対照: 他のページへクライアント遷移すると、そのページで判定してダイアログが出る。
        // 窓のマーカーが残ることで、再読み込みでない（クライアント遷移）ことを確かめる
        await page.evaluate(() => {
            ;(window as unknown as Record<string, unknown>).surveyMarker =
                "kept"
        })
        await navigateInApp(page, "/settings/")
        await expect(dialog(page)).toBeVisible()
        expect(
            await page.evaluate(
                () =>
                    (window as unknown as Record<string, unknown>).surveyMarker,
            ),
        ).toBe("kept")
        expect(api.gets).toBe(1)
        expect(log.survey).toEqual([`GET /v2/surveys/${SURVEY_ID}/respondent/`])
    })

    test("[survey-form/1.3 survey-form/8.2] ゲスト表示のページでは、ログイン中でもダイアログも通信もない（対照あり）", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        const log = trafficOf(page)
        await mockSurveyApi(page, api)
        await mockSession(page, DID_A)

        await page.goto("/settings/?guest")
        // ゲスト表示は判定しないため要求は出ない。決定的な信号が無いので、初期化の後の固定の猶予で確かめる
        await settle(page)
        await expect(dialog(page)).toBeHidden()
        expect(log.survey).toEqual([])
        expect(log.configFetches).toBe(0)

        // 対照: ゲスト表示の印が無いページでは、判定されてダイアログが出る
        await page.goto("/settings/")
        await expect(dialog(page)).toBeVisible()
        expect(api.gets).toBe(1)
    })

    test("[survey-form/1.3] ログインしていないときは、判定しても設定もアンケートの API も取得しない（対照あり）", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        const log = trafficOf(page)
        await mockSurveyApi(page, api)
        await mockSession(page, null)

        // 未ログインの判定はセッションの応答（401）で決まり、設定は取得しない。その応答を待ってから確かめる
        const session = page.waitForResponse(response =>
            isSession(new URL(response.url())),
        )
        await page.goto("/settings/")
        await session
        await settle(page)
        await expect(dialog(page)).toBeHidden()
        expect(log.survey).toEqual([])
        expect(log.configFetches).toBe(0)

        // 対照: ログインすると（未ログインの印を消して）判定され、ダイアログが出る
        await mockSession(page, DID_A)
        await page.evaluate(
            key => window.sessionStorage.removeItem(key),
            UNAUTHENTICATED_KEY,
        )
        await reloadAndSettle(page)
        await expect(dialog(page)).toBeVisible()
        expect(api.gets).toBe(1)
    })
})
