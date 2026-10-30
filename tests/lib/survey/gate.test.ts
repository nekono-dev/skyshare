/** 常駐する入口（SurveyGate）の判定の順序・画面の状態・送信と辞退の振る舞いを、React なしで確認する。 */
import { describe, expect, it, vi } from "vitest"
import {
    applyDecline,
    applySubmitResult,
    createDialogHandlers,
    enterPage,
    gateReducer,
    handleDecline,
    handleSubmit,
    initialGateState,
    planGateEntry,
    resolveSubmitOutcome,
    runGateCheck,
    type GateAction,
    type GateDeps,
    type GateRuntime,
    type GateState,
    type SubmitAnswers,
} from "@/lib/survey/gate"
import type { Survey } from "@/lib/survey/definition"

const survey: Survey = {
    id: "survey-2026",
    opensAt: "2026-10-01T00:00:00+09:00",
    closesAt: "2026-12-31T23:59:59+09:00",
    title: { ja: "利用アンケート", en: "Usage survey" },
    questions: [],
}
const did = "did:plc:alice"

/** ダイアログを出している状態の例 */
const shown: GateState = {
    pending: { survey, did },
    open: true,
    busy: false,
    failed: false,
    judgedKey: "/",
}

/**
 * 判定の依存を、呼び出し順を記録する代役で作る。
 * Input: 各依存の戻り値。Output: 依存と呼び出し順の記録。
 * 例: createDeps({ did: null }) の getDid は null を返し、calls に "getDid" が残る。
 */
const createDeps = (
    overrides: Partial<{
        survey: Survey | undefined
        declined: boolean
        did: string | null
        outcome: "none" | "ask"
    }> = {},
) => {
    const calls: string[] = []
    const deps: GateDeps = {
        loadSurvey: vi.fn(async () => {
            calls.push("loadSurvey")
            return "survey" in overrides ? overrides.survey : survey
        }),
        isDeclined: vi.fn(() => {
            calls.push("isDeclined")
            return overrides.declined ?? false
        }),
        getDid: vi.fn(async () => {
            calls.push("getDid")
            return "did" in overrides ? overrides.did! : did
        }),
        decide: vi.fn(async () => {
            calls.push("decide")
            return overrides.outcome ?? "ask"
        }),
    }
    return { deps, calls }
}

/**
 * 画面の効果を記録する代役を作る。`dispatch` された動作の列（actions）と、呼び出しの順（calls）を残す。
 * Input: `current` は判定の結果が最新かどうか（既定は最新）。
 * Output: 効果と記録。例: dispatch({type:"reset"}) の後、actions は [{type:"reset"}]。
 */
const createRuntime = (options: { current?: boolean } = {}) => {
    const calls: string[] = []
    const actions: GateAction[] = []
    let generation = 0
    const rt: GateRuntime = {
        dispatch: vi.fn((action: GateAction) => {
            actions.push(action)
            calls.push(`dispatch:${action.type}`)
        }),
        remember: vi.fn((surveyId: string, memberDid: string) => {
            calls.push(`remember:${surveyId}:${memberDid}`)
        }),
        markDeclinedInTab: vi.fn((surveyId: string) => {
            calls.push(`markDeclinedInTab:${surveyId}`)
        }),
        beginJudgement: vi.fn(() => {
            calls.push("beginJudgement")
            generation += 1
            return generation
        }),
        isCurrent: vi.fn(() => options.current ?? true),
    }
    return { rt, calls, actions }
}

describe("runGateCheck", () => {
    it("ゲスト表示のページは見送り、どの依存も呼ばない（判定済みにしない）", async () => {
        const { deps, calls } = createDeps()
        const result = await runGateCheck({
            pathname: "/entries/",
            search: "?guest=1",
            deps,
        })
        expect(result).toEqual({ kind: "skipped" })
        expect(calls).toEqual([])
    })

    it("プライバシーポリシーのページは見送り、どの依存も呼ばない", async () => {
        const { deps, calls } = createDeps()
        const result = await runGateCheck({
            pathname: "/privacy/",
            search: "",
            deps,
        })
        expect(result).toEqual({ kind: "skipped" })
        expect(calls).toEqual([])
    })

    it("判定の順序は、アカウント・設定の取得と開催中の判定・辞退・起動時の判定の順", async () => {
        const { deps, calls } = createDeps()
        await runGateCheck({ pathname: "/", search: "", deps })
        expect(calls).toEqual(["getDid", "loadSurvey", "isDeclined", "decide"])
    })

    it("未ログイン（アカウント無し）なら、設定の取得も起動時の判定も行わない", async () => {
        const { deps, calls } = createDeps({ did: null })
        const result = await runGateCheck({ pathname: "/", search: "", deps })
        expect(result).toEqual({ kind: "none" })
        expect(deps.loadSurvey).toHaveBeenCalledTimes(0)
        expect(deps.isDeclined).toHaveBeenCalledTimes(0)
        expect(deps.decide).toHaveBeenCalledTimes(0)
        expect(calls).toEqual(["getDid"])
    })

    it("開催中のアンケートが無いときは何もせず、起動時の判定を行わない", async () => {
        const { deps, calls } = createDeps({ survey: undefined })
        const result = await runGateCheck({ pathname: "/", search: "", deps })
        expect(result).toEqual({ kind: "none" })
        expect(calls).toEqual(["getDid", "loadSurvey"])
    })

    it("このタブで辞退済みなら、起動時の判定（通信）を行わない", async () => {
        // 辞退の印はアンケートの識別子で引くため、設定の取得の後に確認する
        const { deps, calls } = createDeps({ declined: true })
        const result = await runGateCheck({ pathname: "/", search: "", deps })
        expect(result).toEqual({ kind: "none" })
        expect(deps.isDeclined).toHaveBeenCalledWith(survey.id)
        expect(deps.decide).toHaveBeenCalledTimes(0)
        expect(calls).toEqual(["getDid", "loadSurvey", "isDeclined"])
    })

    it("起動時の判定が ask なら、アンケートとアカウントを返す", async () => {
        const { deps } = createDeps({ outcome: "ask" })
        const result = await runGateCheck({ pathname: "/", search: "", deps })
        expect(result).toEqual({ kind: "ask", survey, did })
        expect(deps.decide).toHaveBeenCalledWith(survey.id, did)
    })

    it("起動時の判定が none なら何も表示しない", async () => {
        const { deps } = createDeps({ outcome: "none" })
        const result = await runGateCheck({ pathname: "/", search: "", deps })
        expect(result).toEqual({ kind: "none" })
    })

    it("依存が例外を投げても、利用者の操作を妨げずに何もしない", async () => {
        const { deps } = createDeps()
        deps.getDid = vi.fn(async () => {
            throw new Error("network")
        })
        const result = await runGateCheck({ pathname: "/", search: "", deps })
        expect(result).toEqual({ kind: "none" })
        expect(deps.decide).not.toHaveBeenCalled()
    })
})

describe("resolveSubmitOutcome", () => {
    it("保存・重複は回答済みとして記録して閉じる", () => {
        expect(resolveSubmitOutcome("saved")).toEqual({
            kind: "close",
            remember: true,
        })
        expect(resolveSubmitOutcome("duplicate")).toEqual({
            kind: "close",
            remember: true,
        })
    })

    it("終了・未認証は記録せず閉じる", () => {
        expect(resolveSubmitOutcome("gone")).toEqual({
            kind: "close",
            remember: false,
        })
        expect(resolveSubmitOutcome("unauthenticated")).toEqual({
            kind: "close",
            remember: false,
        })
    })

    it("それ以外の失敗は失敗を示して開き続ける", () => {
        expect(resolveSubmitOutcome("failed")).toEqual({ kind: "failed" })
    })
})

describe("planGateEntry", () => {
    it("除外ページは、表示中のダイアログを閉じ、判定済みを消す（通信も判定もしない）", () => {
        const plan = planGateEntry({
            pathname: "/privacy/",
            search: "",
            judgedKey: "/entries/",
        })
        expect(plan).toEqual({
            kind: "reset",
            judgedKey: null,
            closeDialog: true,
        })
    })

    it("ゲスト表示の除外ページも、同じく閉じて判定済みを消す", () => {
        const plan = planGateEntry({
            pathname: "/",
            search: "?guest=1",
            judgedKey: "/",
        })
        expect(plan).toEqual({
            kind: "reset",
            judgedKey: null,
            closeDialog: true,
        })
    })

    it("同じ画面で判定済みなら何もしない", () => {
        const plan = planGateEntry({
            pathname: "/entries/",
            search: "",
            judgedKey: "/entries/",
        })
        expect(plan).toEqual({ kind: "same" })
    })

    it("新しい画面なら、その画面の鍵で判定する", () => {
        const plan = planGateEntry({
            pathname: "/entries/",
            search: "?page=2",
            judgedKey: "/",
        })
        expect(plan).toEqual({ kind: "judge", key: "/entries/?page=2" })
    })
})

describe("gateReducer", () => {
    it("初期状態は、ダイアログも送信中も失敗も判定済みも無い", () => {
        expect(initialGateState).toEqual({
            pending: null,
            open: false,
            busy: false,
            failed: false,
            judgedKey: null,
        })
    })

    it("reset は表示・送信中・失敗・判定済みをすべて消す", () => {
        const state: GateState = {
            pending: { survey, did },
            open: true,
            busy: true,
            failed: true,
            judgedKey: "/entries/",
        }
        expect(gateReducer(state, { type: "reset" })).toEqual(initialGateState)
    })

    it("close は表示を閉じ、判定済みは残す", () => {
        const state: GateState = { ...shown, busy: true, failed: true }
        expect(gateReducer(state, { type: "close" })).toEqual({
            pending: { survey, did },
            open: false,
            busy: false,
            failed: false,
            judgedKey: "/",
        })
    })

    it("submitFailed は表示を残し、失敗を示して送信中を解く", () => {
        const state: GateState = { ...shown, busy: true }
        expect(gateReducer(state, { type: "submitFailed" })).toEqual({
            pending: { survey, did },
            open: true,
            busy: false,
            failed: true,
            judgedKey: "/",
        })
    })

    it("submitStart は失敗の表示を消して送信中にし、表示は残す", () => {
        const state: GateState = { ...shown, failed: true }
        expect(gateReducer(state, { type: "submitStart" })).toEqual({
            pending: { survey, did },
            open: true,
            busy: true,
            failed: false,
            judgedKey: "/",
        })
    })

    it("ask は表示と判定済みの鍵を設定し、送信中と失敗を消す", () => {
        const state: GateState = {
            ...initialGateState,
            busy: true,
            failed: true,
        }
        expect(
            gateReducer(state, {
                type: "ask",
                survey,
                did,
                key: "/entries/",
            }),
        ).toEqual({
            pending: { survey, did },
            open: false,
            busy: false,
            failed: false,
            judgedKey: "/entries/",
        })
    })

    it("judged は判定済みの鍵だけを変える", () => {
        const state: GateState = { ...shown, judgedKey: null, failed: true }
        expect(gateReducer(state, { type: "judged", key: "/" })).toEqual({
            pending: { survey, did },
            open: true,
            busy: false,
            failed: true,
            judgedKey: "/",
        })
    })
})

describe("enterPage", () => {
    it("除外ページは、判定の世代を進めてダイアログをリセットする。判定の依存は呼ばない", async () => {
        const { rt, actions } = createRuntime()
        const { deps } = createDeps()
        await enterPage(
            { pathname: "/privacy/", search: "", judgedKey: "/entries/" },
            rt,
            deps,
        )
        expect(actions).toEqual([{ type: "reset" }])
        expect(rt.beginJudgement).toHaveBeenCalledTimes(1)
        expect(deps.loadSurvey).not.toHaveBeenCalled()
        expect(deps.getDid).not.toHaveBeenCalled()
        expect(deps.isDeclined).not.toHaveBeenCalled()
        expect(deps.decide).not.toHaveBeenCalled()
    })

    it("ゲスト表示の除外ページも、同じくリセットして依存を呼ばない", async () => {
        const { rt, actions } = createRuntime()
        const { deps } = createDeps()
        await enterPage(
            { pathname: "/", search: "?guest=1", judgedKey: "/" },
            rt,
            deps,
        )
        expect(actions).toEqual([{ type: "reset" }])
        expect(deps.getDid).not.toHaveBeenCalled()
    })

    it("同じ画面で判定済みなら何もしない", async () => {
        const { rt } = createRuntime()
        const { deps } = createDeps()
        await enterPage(
            { pathname: "/entries/", search: "", judgedKey: "/entries/" },
            rt,
            deps,
        )
        expect(rt.dispatch).not.toHaveBeenCalled()
        expect(rt.beginJudgement).not.toHaveBeenCalled()
        expect(deps.getDid).not.toHaveBeenCalled()
    })

    it("新しい画面は、先に判定済みにしてから判定し、聞くならダイアログを設定する", async () => {
        const { rt, actions } = createRuntime()
        const { deps } = createDeps({ outcome: "ask" })
        await enterPage(
            { pathname: "/entries/", search: "?page=2", judgedKey: "/" },
            rt,
            deps,
        )
        expect(actions).toEqual([
            { type: "judged", key: "/entries/?page=2" },
            { type: "ask", survey, did, key: "/entries/?page=2" },
        ])
    })

    it("判定の結果が none なら、判定済みだけを残してダイアログは出さない", async () => {
        const { rt, actions } = createRuntime()
        const { deps } = createDeps({ outcome: "none" })
        await enterPage(
            { pathname: "/entries/", search: "", judgedKey: "/" },
            rt,
            deps,
        )
        expect(actions).toEqual([{ type: "judged", key: "/entries/" }])
    })

    it("判定の途中で画面が変わっていたら（最新でなければ）ダイアログを出さない", async () => {
        const { rt, actions } = createRuntime({ current: false })
        const { deps } = createDeps({ outcome: "ask" })
        await enterPage(
            { pathname: "/entries/", search: "", judgedKey: "/" },
            rt,
            deps,
        )
        expect(actions).toEqual([{ type: "judged", key: "/entries/" }])
    })
})

describe("applySubmitResult", () => {
    const target = { surveyId: survey.id, did }

    it("保存・重複は回答済みとして記録してから閉じる", () => {
        for (const result of ["saved", "duplicate"] as const) {
            const { rt, calls } = createRuntime()
            applySubmitResult(result, target, rt)
            expect(calls).toEqual([
                `remember:${survey.id}:${did}`,
                "dispatch:hide",
            ])
        }
    })

    it("終了・未認証は記録せず閉じる（remember は呼ばない）", () => {
        for (const result of ["gone", "unauthenticated"] as const) {
            const { rt, calls } = createRuntime()
            applySubmitResult(result, target, rt)
            expect(calls).toEqual(["dispatch:hide"])
            expect(rt.remember).not.toHaveBeenCalled()
        }
    })

    it("それ以外の失敗は失敗を示し、閉じずに開き続ける", () => {
        const { rt, calls } = createRuntime()
        applySubmitResult("failed", target, rt)
        expect(calls).toEqual(["dispatch:submitFailed"])
        expect(rt.remember).not.toHaveBeenCalled()
    })
})

describe("applyDecline", () => {
    it("辞退は、このタブの辞退の印を残してから閉じる。回答の記録は行わない", () => {
        const { rt, calls } = createRuntime()
        applyDecline(survey.id, rt)
        expect(calls).toEqual([
            `markDeclinedInTab:${survey.id}`,
            "dispatch:close",
        ])
        expect(rt.remember).not.toHaveBeenCalled()
    })
})

describe("handleDecline", () => {
    it("表示中のアンケートを辞退として閉じ、結果は表示の消去と判定済みの保持になる", () => {
        const { rt, calls, actions } = createRuntime()
        handleDecline(shown, rt)
        expect(calls).toEqual([
            `markDeclinedInTab:${survey.id}`,
            "dispatch:close",
        ])
        expect(rt.remember).not.toHaveBeenCalled()
        expect(actions.reduce(gateReducer, shown)).toEqual({
            pending: { survey, did },
            open: false,
            busy: false,
            failed: false,
            judgedKey: "/",
        })
    })

    it("表示中が無ければ何もしない", () => {
        const { rt, calls } = createRuntime()
        handleDecline(initialGateState, rt)
        expect(calls).toEqual([])
    })
})

describe("handleSubmit", () => {
    const answers = { q1: "a" }

    it("表示中が無い、または送信中なら送信しない", async () => {
        const submit = vi.fn<SubmitAnswers>(async () => "saved")
        const { rt, calls } = createRuntime()
        await handleSubmit(initialGateState, answers, rt, submit)
        await handleSubmit({ ...shown, busy: true }, answers, rt, submit)
        expect(submit).not.toHaveBeenCalled()
        expect(calls).toEqual([])
    })

    it("送信中にしてから送り、保存なら記録して閉じる", async () => {
        const submit = vi.fn<SubmitAnswers>(async () => "saved")
        const { rt, calls } = createRuntime()
        await handleSubmit(shown, answers, rt, submit)
        expect(submit).toHaveBeenCalledWith(survey.id, answers)
        expect(calls).toEqual([
            "dispatch:submitStart",
            `remember:${survey.id}:${did}`,
            "dispatch:hide",
        ])
    })

    it("それ以外の失敗なら、送信中を解いて失敗を示し、閉じない", async () => {
        const submit = vi.fn<SubmitAnswers>(async () => "failed")
        const { rt, calls, actions } = createRuntime()
        await handleSubmit(shown, answers, rt, submit)
        expect(calls).toEqual(["dispatch:submitStart", "dispatch:submitFailed"])
        expect(actions.reduce(gateReducer, shown)).toEqual({
            pending: { survey, did },
            open: true,
            busy: false,
            failed: true,
            judgedKey: "/",
        })
    })
})

describe("createDialogHandlers", () => {
    it("辞退は、辞退の印を残して閉じるだけ。回答の記録も送信もしない", () => {
        const { rt, calls } = createRuntime()
        const submit = vi.fn<SubmitAnswers>(async () => "saved")
        const handlers = createDialogHandlers(() => shown, rt, submit)
        handlers.onDecline()
        expect(calls).toEqual([
            `markDeclinedInTab:${survey.id}`,
            "dispatch:close",
        ])
        expect(rt.remember).not.toHaveBeenCalled()
        expect(submit).not.toHaveBeenCalled()
    })

    it("表示中が無い辞退は何もしない", () => {
        const { rt, calls } = createRuntime()
        const handlers = createDialogHandlers(
            () => initialGateState,
            rt,
            vi.fn<SubmitAnswers>(async () => "saved"),
        )
        handlers.onDecline()
        expect(calls).toEqual([])
    })

    it("送信は表示中のアンケートへ送り、保存なら記録して閉じる", async () => {
        const { rt, calls } = createRuntime()
        const submit = vi.fn<SubmitAnswers>(async () => "saved")
        const handlers = createDialogHandlers(() => shown, rt, submit)
        await handlers.onSubmit({ q1: "a" })
        expect(submit).toHaveBeenCalledWith(survey.id, { q1: "a" })
        expect(calls).toEqual([
            "dispatch:submitStart",
            `remember:${survey.id}:${did}`,
            "dispatch:hide",
        ])
    })
})
