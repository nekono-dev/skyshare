/**
 * アンケートダイアログの操作と、送信・辞退の経路の確認（ヘッドレスブラウザでの操作後の表示）。
 *
 * 責務と処理概要:
 * - 選択の制限（未選択の間は送信できない・上限・「回答しない」の排他）、閉じ方（背景・Esc では閉じない）、
 *   小さな画面での到達、取り消せない旨の位置を確かめる。
 * - 送信の結果（重複・終了・未認証は静かに閉じて記録を行い、それ以外の失敗は文言を示して選択を保つ）と、
 *   「回答しない」の経路（送信せず・記録せず・同じタブでは再表示も通信もなく、新しいタブ・新しいコンテキストでは出る）を確かめる。
 * - 表示言語の切り替え（別タブの設定の変更で、開いているダイアログが追従し、選択が保たれる）と、英語の表示を確かめる。
 * - セッションとアンケートの API は `page.route` で差し替え、呼び出しの回数・送信本文・端末の記録を検証する。
 * - 「出ない」「閉じない」確認には、同じテスト内で「出る」「閉じる」ことの肯定的な確認（対照）を含める。
 * - 配信用の設定（`/surveys/index.json`）が取得できないときは、理由を示して見送る（`publishedSurveyConfigSkipReason`）。
 * - アンケートの文言は `tests/fixtures/survey/e2e-open.json` から読み、固定の文言は i18n の ja / en の正本から読む。
 */
import fs from "node:fs"
import path from "node:path"
import type { ElementHandle, Page, Route } from "@playwright/test"
import { expect, publishedSurveyConfigSkipReason, test } from "./fixtures"
import { survey as surveyMessagesJa } from "../../src/lib/i18n/messages/ja/survey"
import { survey as surveyMessagesEn } from "../../src/lib/i18n/messages/en/survey"

type FixtureOption = {
    id: string
    label: { ja: string; en: string }
    decline?: boolean
}
type FixtureQuestion = {
    id: string
    kind: "single" | "multiple"
    title: { ja: string; en: string }
    maxSelect?: number
    options: FixtureOption[]
}
type FixtureSurvey = {
    id: string
    title: { ja: string; en: string }
    description: { ja: string; en: string }
    questions: FixtureQuestion[]
}

/** 検証用の設定（開催中・単一選択・上限つきの複数選択・「回答しない」を含む）。文言はここから読む */
const fixture: { surveys: FixtureSurvey[] } = JSON.parse(
    fs.readFileSync(
        path.resolve("tests/fixtures/survey/e2e-open.json"),
        "utf8",
    ),
)
const survey = fixture.surveys[0]
const [single, multiple] = survey.questions
const SURVEY_ID = survey.id
const RECORD_KEY = `skyshare.survey.${SURVEY_ID}`
const DECLINED_KEY = `skyshare.survey.${SURVEY_ID}.declined`
// ログイン状態の未ログインの印（src/lib/account/activeAccountSession.ts の保存キー）
const DID_A = "did:plc:survey-dialog-account-a"

const label = (question: FixtureQuestion, id: string, lang: "ja" | "en") => {
    const option = question.options.find(o => o.id === id)
    if (!option) throw new Error(`選択肢 ${id} が見つからない`)
    return option.label[lang]
}
const declineLabel = (question: FixtureQuestion, lang: "ja" | "en") => {
    const option = question.options.find(o => o.decline)
    if (!option) throw new Error("「回答しない」が見つからない")
    return option.label[lang]
}

const SUBMIT = surveyMessagesJa["survey.submit"]
const CLOSE = surveyMessagesJa["survey.close"]
const IRREVERSIBLE = surveyMessagesJa["survey.irreversible"]
const DECLINE_HINT = surveyMessagesJa["survey.declineHint"]
const SUBMIT_FAILED = surveyMessagesJa["survey.submitFailed"]
const SUBMIT_EN = surveyMessagesEn["survey.submit"]
const CLOSE_EN = surveyMessagesEn["survey.close"]
const IRREVERSIBLE_EN = surveyMessagesEn["survey.irreversible"]
const DECLINE_HINT_EN = surveyMessagesEn["survey.declineHint"]
const SUBMIT_FAILED_EN = surveyMessagesEn["survey.submitFailed"]

/**
 * dev サーバーの初回コンパイルを待つためのウォームアップ（既存の spec と同じ方針）。
 * ネットワーク変動による一過性の失敗（ERR_NETWORK_CHANGED）は、fixtures の goto と同じく再試行する。
 */
test.beforeAll(async ({ browser }) => {
    test.setTimeout(90_000)
    for (let attempt = 1; ; attempt++) {
        const page = await browser.newPage({ ignoreHTTPSErrors: true })
        try {
            await page.goto("https://localhost:4321/settings/?guest", {
                timeout: 60_000,
            })
            return
        } catch (err) {
            if (!isTransientNavigationError(err) || attempt >= 3) throw err
        } finally {
            await page.close()
        }
    }
})

/**
 * 実行環境による一過性のナビゲーション失敗か（再試行の対象）。
 * - ERR_NETWORK_CHANGED（ネットワーク変動）と、エラーページ（chrome-error）への遷移による中断
 * - 別の遷移（同じ URL への再読み込みを含む。ERR_ABORTED を含む）に割り込まれた中断。開発サーバーが初回の依存の最適化で
 *   ページを再読み込みさせることがあり、初めて開くページ（新しいタブ・コンテキスト）で観測された
 */
const isTransientNavigationError = (err: unknown): boolean =>
    /ERR_NETWORK_CHANGED|ERR_ABORTED|chrome-error|interrupted by another navigation/.test(
        String(err),
    )

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
    respondent: Reply
    registerStatus: number
    answer: Reply
    gets: number
    registers: number
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

/** セッションの応答（ログイン中のアカウント） */
const mockSession = async (page: Page, did: string): Promise<void> => {
    await page.route(isPath("/v2/entries"), route =>
        fulfill(route, { status: 200, body: { threads: [] } }),
    )
    await page.route(isSession, route =>
        fulfill(route, {
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

/** 1 つのページに、セッションとアンケートの API の差し替えをまとめて行う */
const mockPage = async (page: Page, api: Api): Promise<void> => {
    await mockSurveyApi(page, api)
    await mockSession(page, DID_A)
}

// ---- 画面の操作と読み取り ----

const dialog = (page: Page) =>
    page.getByRole("dialog", { name: survey.title.ja })
const dialogEn = (page: Page) =>
    page.getByRole("dialog", { name: survey.title.en })
const submitButton = (page: Page) =>
    dialog(page).getByRole("button", { name: SUBMIT })

/** 選択肢を 1 つ選ぶ（ラベルのクリック） */
const choose = async (
    page: Page,
    question: FixtureQuestion,
    text: string,
    lang: "ja" | "en" = "ja",
): Promise<void> => {
    const groupName = lang === "ja" ? question.title.ja : question.title.en
    const scope = lang === "ja" ? dialog(page) : dialogEn(page)
    await scope
        .getByRole("group", { name: groupName })
        .locator("label", { hasText: text })
        .click()
}

/** 配信用の設定の取得が終わるのを待つ（判定の前段の通信の完了） */
const configLoaded = (page: Page) =>
    page.waitForResponse(response => isConfig(new URL(response.url())))

/** 判定の後に起きうる要求を見送るための固定の猶予（ミリ秒） */
const GRACE_MS = 1500

/**
 * 「出ない」「通信が無い」を確かめる前に、ページの初期化（ハイドレーション）を待ち、固定の猶予を置く。
 * 判定をしないページの要求には完了を示す決定的な信号が無いため、固定の時間で確かめる。
 */
const settle = async (page: Page): Promise<void> => {
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0, {
        timeout: 30_000,
    })
    await page.waitForTimeout(GRACE_MS)
}

const readRecord = (page: Page) =>
    page
        .evaluate(key => window.localStorage.getItem(key), RECORD_KEY)
        .then(raw => (raw === null ? null : JSON.parse(raw)))

const readDeclined = (page: Page) =>
    page.evaluate(key => window.sessionStorage.getItem(key), DECLINED_KEY)

/** 再読み込み（ERR_NETWORK_CHANGED の一過性の失敗は再試行する） */
const reloadWithRetry = async (page: Page): Promise<void> => {
    for (let attempt = 1; ; attempt++) {
        try {
            await page.reload()
            return
        } catch (err) {
            if (!isTransientNavigationError(err) || attempt >= 3) throw err
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

/** 移動する（一過性のナビゲーション失敗は、やり直す。やり直しても失敗するものは投げる） */
const gotoRetry = async (page: Page, url: string): Promise<void> => {
    for (let attempt = 1; ; attempt++) {
        try {
            await page.goto(url)
            return
        } catch (err) {
            if (!isTransientNavigationError(err) || attempt >= 3) throw err
        }
    }
}

/** 設定画面を開いてダイアログが出るまで待つ（肯定的な確認） */
const openDialog = async (page: Page, timeout = 10_000): Promise<void> => {
    // 一過性の失敗（エラーページへの遷移を含む）は、移動をやり直す。やり直しても出なければ失敗にする
    for (let attempt = 1; ; attempt++) {
        await gotoRetry(page, "/")
        const entry = page.getByRole("button", {
            name: surveyMessagesJa["survey.entry"],
        })
        const ready = await entry.waitFor({ state: "visible", timeout }).then(
            () => true,
            () => false,
        )
        if (ready) await entry.click()
        const shown = await dialog(page)
            .waitFor({ state: "visible", timeout })
            .then(
                () => true,
                () => false,
            )
        if (shown) return
        if (attempt >= 3 || !page.url().startsWith("chrome-error")) break
    }
    await expect(dialog(page)).toBeVisible({ timeout })
}

/**
 * ダイアログ内の質問の並びのスクロール領域を取る（最後の質問の祖先で、縦にスクロールするもの）。
 * 見つからなければ null。
 */
const scrollRegion = async (
    page: Page,
): Promise<ElementHandle<HTMLElement> | null> => {
    const handle = await page.evaluateHandle(() => {
        const dialogEl = document.querySelector('[role="dialog"]')
        const last = dialogEl
            ? [...dialogEl.querySelectorAll("fieldset")].at(-1)
            : undefined
        let el: HTMLElement | null = last?.parentElement ?? null
        while (el && el !== dialogEl) {
            const overflow = getComputedStyle(el).overflowY
            if (overflow === "auto" || overflow === "scroll") return el
            el = el.parentElement
        }
        return null
    })
    return handle.asElement()
}

/** 全ての質問に答える（単一は毎日、複数は投稿の共有と投稿の作成） */
const answerAll = async (page: Page): Promise<void> => {
    await choose(page, single, label(single, "daily", "ja"))
    await choose(page, multiple, label(multiple, "share", "ja"))
    await choose(page, multiple, label(multiple, "compose", "ja"))
}

// ---- 経路の確認 ----

test.describe("ダイアログの操作", () => {
    test("[survey-form/3.6 survey-form/3.7 survey-form/3.4] 未選択の間は送信できず、キーボードと操作で全て選ぶと送信できる", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        await mockPage(page, api)
        await openDialog(page)

        // 未選択の間は送信できない（肯定的な確認: ダイアログは出ている）
        await expect(submitButton(page)).toBeDisabled()

        // キーボードだけで単一選択を選ぶ（ラジオにフォーカスして空白キー）
        await dialog(page)
            .getByRole("radio", { name: label(single, "daily", "ja") })
            .focus()
        await page.keyboard.press("Space")
        await expect(
            dialog(page).getByRole("radio", {
                name: label(single, "daily", "ja"),
            }),
        ).toBeChecked()
        // 複数選択の質問が未選択の間は、まだ送信できない
        await expect(submitButton(page)).toBeDisabled()

        await choose(page, multiple, label(multiple, "share", "ja"))
        await choose(page, multiple, label(multiple, "compose", "ja"))
        await expect(submitButton(page)).toBeEnabled()

        // キーボードで送信ボタンを押す
        await submitButton(page).focus()
        await page.keyboard.press("Enter")
        await expect(dialog(page)).toBeHidden()
        expect(api.submitted).toEqual([
            {
                answers: {
                    frequency: "daily",
                    features: ["share", "compose"],
                },
            },
        ])
    })

    test("[survey-form/3.5] 背景のクリックと Esc キーではダイアログが閉じず、送信の操作でだけ閉じる（対照あり）", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        await mockPage(page, api)
        await openDialog(page)

        // 背景（ダイアログの外側）をクリックしても閉じない
        await page.mouse.click(4, 4)
        await expect(dialog(page)).toBeVisible()

        // Esc キーでも閉じない
        await page.keyboard.press("Escape")
        await expect(dialog(page)).toBeVisible()
        expect(api.submitted).toEqual([])

        // 対照: 閉じずに残っているダイアログは操作でき、送信で閉じる
        await answerAll(page)
        await submitButton(page).click()
        await expect(dialog(page)).toBeHidden()
        expect(api.submitted).toHaveLength(1)
    })

    test("[survey-form/3.4] 単一選択は 1 つだけ選べ、複数選択は上限（2）を超えて選べない（外すと選べる）", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        await mockPage(page, api)
        await openDialog(page)

        // 単一選択: 別の選択肢を選ぶと、前の選択は外れる
        await choose(page, single, label(single, "daily", "ja"))
        await choose(page, single, label(single, "sometimes", "ja"))
        await expect(
            dialog(page).getByRole("radio", {
                name: label(single, "sometimes", "ja"),
            }),
        ).toBeChecked()
        await expect(
            dialog(page).getByRole("radio", {
                name: label(single, "daily", "ja"),
            }),
        ).not.toBeChecked()

        // 複数選択: 上限（2）に達すると、残りの選択肢は選べない（対照: 選べている間は操作できる）
        await choose(page, multiple, label(multiple, "share", "ja"))
        await choose(page, multiple, label(multiple, "compose", "ja"))
        const schedule = dialog(page).getByRole("checkbox", {
            name: label(multiple, "schedule", "ja"),
        })
        await expect(schedule).toBeDisabled()
        await expect(schedule).not.toBeChecked()

        // 一つ外すと、残りの選択肢が選べるようになる
        await choose(page, multiple, label(multiple, "share", "ja"))
        await expect(schedule).toBeEnabled()
        await choose(page, multiple, label(multiple, "schedule", "ja"))
        await expect(schedule).toBeChecked()
        await expect(
            dialog(page).getByRole("checkbox", {
                name: label(multiple, "compose", "ja"),
            }),
        ).toBeChecked()
        expect(api.submitted).toEqual([])
    })

    test("[survey-form/3.8] 小さな画面では、最後の質問と送信の操作までスクロールして到達でき、送信できる", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        await mockPage(page, api)
        await page.setViewportSize({ width: 390, height: 600 })
        await openDialog(page)

        // 最後の質問は初期の表示では画面の外（対照: スクロールが必要な大きさである）
        const last = dialog(page).getByRole("group", {
            name: multiple.title.ja,
        })
        await expect(last).toBeAttached()
        await expect(last).not.toBeInViewport()

        // (a) 初期: 質問の並びのスクロール領域（ダイアログ内側）は、内容が領域に収まらない
        const region = await scrollRegion(page)
        expect(region).not.toBeNull()
        const regionEl = region!
        expect(
            await regionEl.evaluate(el => el.scrollHeight > el.clientHeight),
        ).toBe(true)
        expect(await regionEl.evaluate(el => el.scrollTop)).toBe(0)

        // (b) 領域を指定の操作でスクロールすると、領域の中身が動き、最後の質問と送信の操作が画面内に入る
        await regionEl.hover()
        await page.mouse.wheel(0, 1000)
        await expect
            .poll(() => regionEl.evaluate(el => el.scrollTop))
            .toBeGreaterThan(0)
        await expect(last).toBeInViewport()
        await expect(submitButton(page)).toBeInViewport()

        // (c) ダイアログのカードは画面の高さ（600）以内に収まる
        const card = await dialog(page).boundingBox()
        expect(card).not.toBeNull()
        expect(card!.height).toBeLessThanOrEqual(600)

        // 最後の質問までスクロールすると、到達して選べる（既存の確認）
        await last.scrollIntoViewIfNeeded()
        await expect(last).toBeInViewport()
        await choose(page, single, label(single, "daily", "ja"))
        await choose(page, multiple, label(multiple, "share", "ja"))
        await choose(page, multiple, label(multiple, "compose", "ja"))

        // 送信の操作までスクロールして、押せて閉じる
        await submitButton(page).scrollIntoViewIfNeeded()
        await expect(submitButton(page)).toBeInViewport()
        await submitButton(page).click()
        await expect(dialog(page)).toBeHidden()
        expect(api.submitted).toHaveLength(1)
    })

    test("[survey-form/3.9] 取り消せない旨は、送信の操作の前に読める位置に、画面内で表示される", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        await mockPage(page, api)
        await openDialog(page)

        const notice = dialog(page).getByText(IRREVERSIBLE, { exact: true })
        await expect(notice).toBeVisible()
        await expect(notice).toBeInViewport()
        await expect(submitButton(page)).toBeVisible()

        // 送信の操作より前（上）の位置にある
        const noticeBox = await notice.boundingBox()
        const submitBox = await submitButton(page).boundingBox()
        expect(noticeBox).not.toBeNull()
        expect(submitBox).not.toBeNull()
        expect(noticeBox!.y).toBeLessThan(submitBox!.y)
    })
})

test.describe("送信の結果", () => {
    for (const reply of [
        { status: 409, name: "重複（409）", recorded: true },
        { status: 404, name: "終了（404）", recorded: false },
        { status: 401, name: "未認証（401）", recorded: false },
    ]) {
        test(`[survey-form/4.4 survey-form/4.5 survey-form/4.6] 送信が${reply.name}と返したときは、静かに閉じ、${reply.recorded ? "回答済みとして記録する" : "記録しない"}`, async ({
            page,
        }) => {
            const api = newApi({ status: 200, body: { answered: false } })
            await mockPage(page, api)
            await openDialog(page)
            await answerAll(page)

            // 対照: 失敗（500）では文言が出る（文言の経路が働いていることの肯定的な確認）
            api.answer = { status: 500, body: { error: "Unknown Error" } }
            await submitButton(page).click()
            await expect(dialog(page).getByRole("alert")).toHaveText(
                SUBMIT_FAILED,
            )

            // 本番の結果: 静かに閉じる（文言は出ない）
            api.answer = { status: reply.status, body: { error: "Error" } }
            await submitButton(page).click()
            await expect(dialog(page)).toBeHidden()
            expect(api.submitted).toHaveLength(2)
            expect(api.submitted[1]).toEqual(api.submitted[0])
            await expect(page.getByRole("alert")).toHaveCount(0)
            if (reply.recorded) {
                await expect
                    .poll(() => readRecord(page))
                    .toEqual({
                        answered: true,
                        dids: [DID_A],
                    })
            } else {
                expect(await readRecord(page)).toBeNull()
            }
        })
    }

    for (const reply of [
        { status: 500, name: "500" },
        { status: 503, name: "503" },
    ]) {
        test(`[survey-form/4.7] 送信が失敗（${reply.name}）したときは、文言を示して選択を保ったまま開き続け、再送信で記録して閉じる`, async ({
            page,
        }) => {
            const api = newApi({ status: 200, body: { answered: false } })
            api.answer = { status: reply.status, body: { error: "Error" } }
            await mockPage(page, api)
            await openDialog(page)
            await answerAll(page)
            await submitButton(page).click()

            // 失敗: 開いたままで、文言が出て、選択が残り、再び送信できる
            await expect(dialog(page).getByRole("alert")).toHaveText(
                SUBMIT_FAILED,
            )
            await expect(
                dialog(page).getByRole("radio", {
                    name: label(single, "daily", "ja"),
                }),
            ).toBeChecked()
            await expect(
                dialog(page).getByRole("checkbox", {
                    name: label(multiple, "share", "ja"),
                }),
            ).toBeChecked()
            await expect(submitButton(page)).toBeEnabled()
            expect(await readRecord(page)).toBeNull()

            // 再送信: 保存されて閉じ、記録される
            api.answer = { status: 201 }
            await submitButton(page).click()
            await expect(dialog(page)).toBeHidden()
            expect(api.submitted).toHaveLength(2)
            expect(api.submitted[1]).toEqual(api.submitted[0])
            await expect
                .poll(() => readRecord(page))
                .toEqual({
                    answered: true,
                    dids: [DID_A],
                })
        })
    }
})

test.describe("「回答しない」", () => {
    test("[survey-form/5.1 survey-form/5.3] 「回答しない」を選ぶと操作が「閉じる」になり、説明が出て、他の回答を選び直すと送信に戻る", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        await mockPage(page, api)
        await openDialog(page)

        await choose(page, single, declineLabel(single, "ja"))
        // 肯定的な確認: 操作は「閉じる」になり、説明が出る。「送信する」は無い
        await expect(
            dialog(page).getByRole("button", { name: CLOSE }),
        ).toBeEnabled()
        await expect(dialog(page).getByText(DECLINE_HINT)).toBeVisible()
        await expect(submitButton(page)).toHaveCount(0)

        // 別の選択肢に戻すと、「送信する」に戻る（未選択の質問があるため押せない）
        await choose(page, single, label(single, "daily", "ja"))
        await expect(submitButton(page)).toBeDisabled()
        await expect(
            dialog(page).getByRole("button", { name: CLOSE }),
        ).toHaveCount(0)
        expect(api.submitted).toEqual([])
    })

    test("[survey-form/5.2] 複数選択で「回答しない」を選ぶと他の選択肢は同時に選ばれず、他を選ぶと「回答しない」は外れる", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        await mockPage(page, api)
        await openDialog(page)

        await choose(page, multiple, label(multiple, "share", "ja"))
        await choose(page, multiple, declineLabel(multiple, "ja"))
        const checkbox = (text: string) =>
            dialog(page).getByRole("checkbox", { name: text })
        // 肯定的な確認: 「回答しない」だけが選ばれ、「投稿の共有」は外れる
        await expect(checkbox(declineLabel(multiple, "ja"))).toBeChecked()
        await expect(checkbox(label(multiple, "share", "ja"))).not.toBeChecked()

        // 他の選択肢を選ぶと、「回答しない」は外れる
        await choose(page, multiple, label(multiple, "compose", "ja"))
        await expect(checkbox(label(multiple, "compose", "ja"))).toBeChecked()
        await expect(checkbox(declineLabel(multiple, "ja"))).not.toBeChecked()
        expect(api.submitted).toEqual([])
    })

    test("[survey-form/5.4 survey-form/8.1] 「回答しない」で閉じても入口が残り、再読み込み後も開ける", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        const log = trafficOf(page)
        await mockPage(page, api)
        await openDialog(page)

        // 「回答しない」を選んで閉じる（肯定的な確認: 閉じる操作がある）
        await choose(page, single, declineLabel(single, "ja"))
        await dialog(page).getByRole("button", { name: CLOSE }).click()
        await expect(dialog(page)).toBeHidden()
        expect(api.submitted).toEqual([])
        expect(api.registers).toBe(0)
        expect(await readRecord(page)).toBeNull()
        expect(await readDeclined(page)).toBe("1")
        await expect(
            page.getByRole("button", {
                name: surveyMessagesJa["survey.entry"],
            }),
        ).toBeVisible()

        // 同じタブの再読み込み後も未回答の入口は残る。
        const configBefore = log.configFetches
        await reloadAndSettle(page)
        expect(log.configFetches).toBeGreaterThan(configBefore)
        await expect(dialog(page)).toBeHidden()
        expect(api.gets).toBe(2)
        expect(log.survey).toEqual([
            `GET /v2/surveys/${SURVEY_ID}/respondent/`,
            `GET /v2/surveys/${SURVEY_ID}/respondent/`,
        ])
        expect(await readRecord(page)).toBeNull()

        // 対照（同じタブ内）: タブの印を消した状態（新しいタブ相当）では、再び判定されて出る
        await newTabState(page)
        await reloadAndSettle(page)
        await page
            .getByRole("button", { name: surveyMessagesJa["survey.entry"] })
            .click()
        await expect(dialog(page)).toBeVisible()
        expect(api.gets).toBe(3)
    })
})

test.describe("表示言語", () => {
    test.describe("英語で開く", () => {
        test.use({ locale: "en-US" })

        test("[survey-form/3.2 survey-form/6.1 survey-form/6.2 survey-form/8.3] 英語の表示言語では、固定の文言と設定の英語の文言が出る", async ({
            page,
        }) => {
            const api = newApi({ status: 200, body: { answered: false } })
            await mockPage(page, api)
            await gotoRetry(page, "/")
            await page
                .getByRole("button", { name: surveyMessagesEn["survey.entry"] })
                .click()
            await expect(dialogEn(page)).toBeVisible()

            // 設定の英語の文言（タイトル・質問・選択肢）
            await expect(
                dialogEn(page).getByRole("heading", { name: survey.title.en }),
            ).toHaveText(survey.title.en)
            await expect(
                dialogEn(page).getByRole("group", { name: single.title.en }),
            ).toBeVisible()
            await expect(
                dialogEn(page).getByRole("radio", {
                    name: label(single, "daily", "en"),
                }),
            ).toBeVisible()
            // 固定の文言（英語）と、日本語の固定の文言が出ないこと
            await expect(
                dialogEn(page).getByText(IRREVERSIBLE_EN),
            ).toBeVisible()
            await expect(dialogEn(page).getByText(IRREVERSIBLE)).toHaveCount(0)
            await expect(
                dialogEn(page).getByRole("button", { name: SUBMIT_EN }),
            ).toBeDisabled()
            await expect(
                dialogEn(page).getByRole("button", { name: SUBMIT }),
            ).toHaveCount(0)
            expect(api.gets).toBe(1)

            // 英語の「回答しない」: 操作が英語の「閉じる」になり、英語の説明が出る（送信の操作は無い）
            await choose(page, single, declineLabel(single, "en"), "en")
            await expect(
                dialogEn(page).getByRole("button", { name: CLOSE_EN }),
            ).toBeEnabled()
            await expect(
                dialogEn(page).getByText(DECLINE_HINT_EN),
            ).toBeVisible()
            await expect(
                dialogEn(page).getByRole("button", { name: SUBMIT_EN }),
            ).toHaveCount(0)

            // 英語の選択肢で答えて、英語の送信の操作で送信できる
            await choose(page, single, label(single, "daily", "en"), "en")
            await choose(page, multiple, label(multiple, "share", "en"), "en")
            await choose(page, multiple, label(multiple, "compose", "en"), "en")
            await expect(
                dialogEn(page).getByRole("button", { name: SUBMIT_EN }),
            ).toBeEnabled()

            // 英語の失敗の文言（送信が 500 のとき）。選択は残り、再送信できる
            api.answer = { status: 500, body: { error: "Unknown Error" } }
            await dialogEn(page)
                .getByRole("button", { name: SUBMIT_EN })
                .click()
            await expect(dialogEn(page).getByRole("alert")).toHaveText(
                SUBMIT_FAILED_EN,
            )
            api.answer = { status: 201 }
            await dialogEn(page)
                .getByRole("button", { name: SUBMIT_EN })
                .click()
            await expect(dialogEn(page)).toBeHidden()
            expect(api.submitted).toHaveLength(2)
            expect(api.submitted[1]).toEqual({
                answers: {
                    frequency: "daily",
                    features: ["share", "compose"],
                },
            })
        })
    })

    test("[survey-form/3.3 survey-form/6.2] 開いているダイアログで表示言語を切り替えると、選択が保たれたまま英語に切り替わる", async ({
        page,
    }) => {
        const api = newApi({ status: 200, body: { answered: false } })
        await mockPage(page, api)
        await openDialog(page)
        await answerAll(page)
        await expect(submitButton(page)).toBeEnabled()

        // 別のタブ（同じコンテキスト）で表示言語を英語にする。開いているダイアログは追従する
        const context = page.context()
        const settingsTab = await context.newPage()
        await mockSession(settingsTab, DID_A)
        await gotoRetry(settingsTab, "/settings/?guest")
        // 別のページは fixtures の goto を通らないため、初期化（ハイドレーション）の完了を待ってから操作する
        await expect(settingsTab.locator("astro-island[ssr]")).toHaveCount(0, {
            timeout: 30_000,
        })
        await settingsTab.getByRole("combobox", { name: "表示言語" }).click()
        await settingsTab.getByRole("option", { name: "English" }).click()

        // 肯定的な確認: ダイアログが英語になり、選択が残っている
        await expect(dialogEn(page)).toBeVisible()
        await expect(
            dialogEn(page).getByRole("radio", {
                name: label(single, "daily", "en"),
            }),
        ).toBeChecked()
        await expect(
            dialogEn(page).getByRole("checkbox", {
                name: label(multiple, "share", "en"),
            }),
        ).toBeChecked()
        await expect(
            dialogEn(page).getByRole("checkbox", {
                name: label(multiple, "compose", "en"),
            }),
        ).toBeChecked()
        await expect(
            dialogEn(page).getByRole("button", { name: SUBMIT_EN }),
        ).toBeEnabled()
        expect(api.submitted).toEqual([])

        // 英語の状態で送信できる
        await dialogEn(page).getByRole("button", { name: SUBMIT_EN }).click()
        await expect(dialogEn(page)).toBeHidden()
        expect(api.submitted).toHaveLength(1)
        await settingsTab.close()
    })
})
