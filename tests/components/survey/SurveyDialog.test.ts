/**
 * SurveyDialog（回答必須のダイアログ）の単体テスト。
 *
 * 方針:
 * - node 環境のため、描画は `renderToStaticMarkup` で HTML 文字列として検証する。
 * - 選択の補正・送信の判定は純粋関数（`applySelectionChange` / `resolveSubmitAction`）で検証する。
 * - Overlay は描画を省いて props だけ記録し、背景・Esc で閉じない（onClose が何もしない）ことを確認する。
 */
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import SurveyDialog, {
    SurveyDialogBody,
    applySelectionChange,
    dispatchSubmitAction,
    resolveSubmitAction,
    type SurveyDialogBodyProps,
} from "@/components/survey/SurveyDialog"
import type { SurveyDraft } from "@/lib/survey/answerDraft"
import type { Survey } from "@/lib/survey/definition"
import { createTranslator } from "@/lib/i18n/translate"

// Overlay は描画せず props だけ記録する（onClose が何もしないことを確認するため）。
const overlay = vi.hoisted(() => ({
    props: undefined as undefined | { open: boolean; onClose: () => void },
}))
vi.mock("@/components/common/Overlay", () => ({
    default: (props: {
        open: boolean
        onClose: () => void
        children: React.ReactNode
    }) => {
        overlay.props = props
        return props.open ? props.children : null
    },
}))

/** 単一（回答しないを含む）と複数（上限 2・回答しないを含む）の 2 問のアンケート */
const survey: Survey = {
    id: "survey-a",
    opensAt: "2026-10-01T00:00:00+09:00",
    closesAt: "2026-12-31T23:59:59+09:00",
    title: { ja: "利用アンケート", en: "Usage survey" },
    description: {
        ja: "数問にお答えください。",
        en: "Please answer a few questions.",
    },
    questions: [
        {
            id: "q-single",
            kind: "single",
            title: { ja: "よく使う機能", en: "Main feature" },
            options: [
                { id: "a", label: { ja: "投稿", en: "Posts" } },
                { id: "b", label: { ja: "検索", en: "Search" } },
                {
                    id: "skip",
                    label: { ja: "回答しない", en: "Prefer not to answer" },
                    decline: true,
                },
            ],
        },
        {
            id: "q-multi",
            kind: "multiple",
            title: { ja: "興味のある話題", en: "Topics" },
            maxSelect: 2,
            options: [
                { id: "x", label: { ja: "技術", en: "Tech" } },
                { id: "y", label: { ja: "写真", en: "Photo" } },
                { id: "z", label: { ja: "音楽", en: "Music" } },
                {
                    id: "none",
                    label: { ja: "回答しない", en: "Prefer not to answer" },
                    decline: true,
                },
            ],
        },
    ],
}

const emptyState: SurveyDraft = { "q-single": [], "q-multi": [] }

/** 本体を描画する。既定は日本語・未完了・送信中でない・失敗なし。 */
const render = (
    overrides: Partial<SurveyDialogBodyProps> & { draft?: SurveyDraft } = {},
) => {
    const { draft = emptyState, ...rest } = overrides
    const locale = rest.locale ?? "ja"
    const props: SurveyDialogBodyProps = {
        survey,
        draft,
        locale,
        t: createTranslator(locale).t,
        titleId: "survey-title",
        busy: false,
        failed: false,
        action: resolveSubmitAction(survey, draft),
        onSelect: vi.fn(),
        onAction: vi.fn(),
        ...rest,
    }
    return renderToStaticMarkup(createElement(SurveyDialogBody, props))
}

/** 指定の文字列を含む開始タグ（`<input ...>`・`<button ...>`）の一覧を返す。 */
const tagsOf = (html: string, tag: "input" | "button") =>
    html.match(new RegExp(`<${tag}[^>]*>`, "g")) ?? []

describe("resolveSubmitAction（送信の判定）", () => {
    it("[3.6] 未選択の質問があると未完了になり、回答は作らない", () => {
        expect(resolveSubmitAction(survey, emptyState)).toEqual({
            kind: "incomplete",
        })
    })

    it("[4.1] すべての質問に選択があれば送信の回答を作る（単一は文字列、複数は配列）", () => {
        expect(
            resolveSubmitAction(survey, {
                "q-single": ["a"],
                "q-multi": ["x"],
            }),
        ).toEqual({
            kind: "submit",
            answers: { "q-single": "a", "q-multi": ["x"] },
        })
    })

    it("[4.8] 複数の回答は選択肢の並び順で、送信の本文に did や時刻を含めない", () => {
        const action = resolveSubmitAction(survey, {
            "q-single": ["b"],
            "q-multi": ["z", "x"],
        })
        expect(action).toEqual({
            kind: "submit",
            answers: { "q-single": "b", "q-multi": ["x", "z"] },
        })
    })

    it("[5.3] 回答しないを含むと、他が未完了でも閉じる操作になる", () => {
        expect(
            resolveSubmitAction(survey, {
                "q-single": ["skip"],
                "q-multi": [],
            }),
        ).toEqual({ kind: "decline" })
    })

    it("[5.3] 複数の質問の回答しないも閉じる操作になる", () => {
        expect(
            resolveSubmitAction(survey, {
                "q-single": ["a"],
                "q-multi": ["none"],
            }),
        ).toEqual({ kind: "decline" })
    })
})

describe("dispatchSubmitAction（送信の操作の通知）", () => {
    it("[5.4] 辞退は onDecline を 1 回だけ呼び、onSubmit は呼ばない", () => {
        const onSubmit = vi.fn()
        const onDecline = vi.fn()
        dispatchSubmitAction({ kind: "decline" }, false, {
            onSubmit,
            onDecline,
        })
        expect(onDecline).toHaveBeenCalledTimes(1)
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it("[4.1] 送信は toAnswers の結果を渡して onSubmit を 1 回だけ呼び、onDecline は呼ばない", () => {
        const onSubmit = vi.fn()
        const onDecline = vi.fn()
        const action = resolveSubmitAction(survey, {
            "q-single": ["b"],
            "q-multi": ["z", "x"],
        })
        dispatchSubmitAction(action, false, { onSubmit, onDecline })
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit).toHaveBeenCalledWith({
            "q-single": "b",
            "q-multi": ["x", "z"],
        })
        expect(onDecline).not.toHaveBeenCalled()
    })

    it("[3.6] 未完了の間は onSubmit も onDecline も呼ばない", () => {
        const onSubmit = vi.fn()
        const onDecline = vi.fn()
        dispatchSubmitAction(resolveSubmitAction(survey, emptyState), false, {
            onSubmit,
            onDecline,
        })
        expect(onSubmit).not.toHaveBeenCalled()
        expect(onDecline).not.toHaveBeenCalled()
    })

    it("[4.2] 送信中は、完了していても辞退していても何も呼ばない", () => {
        const onSubmit = vi.fn()
        const onDecline = vi.fn()
        const complete = resolveSubmitAction(survey, {
            "q-single": ["a"],
            "q-multi": ["x"],
        })
        const declined = resolveSubmitAction(survey, {
            "q-single": ["skip"],
            "q-multi": [],
        })
        dispatchSubmitAction(complete, true, { onSubmit, onDecline })
        dispatchSubmitAction(declined, true, { onSubmit, onDecline })
        expect(onSubmit).not.toHaveBeenCalled()
        expect(onDecline).not.toHaveBeenCalled()
    })
})

describe("applySelectionChange（選択の補正）", () => {
    it("[3.4] 単一の選択は部品の値をそのまま採り、他の質問は変えない", () => {
        expect(
            applySelectionChange(survey, emptyState, "q-single", ["b"]),
        ).toEqual({ "q-single": ["b"], "q-multi": [] })
    })

    it("[5.2] 複数で回答しないを新たに選ぶと、その 1 件だけにする", () => {
        expect(
            applySelectionChange(
                survey,
                { "q-single": [], "q-multi": ["x"] },
                "q-multi",
                ["x", "none"],
            ),
        ).toEqual({ "q-single": [], "q-multi": ["none"] })
    })

    it("[5.2] 回答しないを保ったまま他を選ぶと、回答しないを外す", () => {
        expect(
            applySelectionChange(
                survey,
                { "q-single": [], "q-multi": ["none"] },
                "q-multi",
                ["none", "y"],
            ),
        ).toEqual({ "q-single": [], "q-multi": ["y"] })
    })

    it("選択肢にない質問 ID は状態を変えない", () => {
        expect(
            applySelectionChange(survey, emptyState, "unknown", ["a"]),
        ).toEqual(emptyState)
    })
})

describe("SurveyDialog（選択状態を持つ本体）", () => {
    it("[3.1][3.6] 初期描画は空の選択で、表示言語の文言と未完了の送信の操作を示す", () => {
        const html = renderToStaticMarkup(
            createElement(SurveyDialog, {
                survey,
                busy: false,
                failed: false,
                onSubmit: vi.fn(),
                onDecline: vi.fn(),
            }),
        )
        expect(html).toContain('role="dialog"')
        expect(html).toContain("利用アンケート</h2>")
        expect(html).toContain("すべての質問に答えると送信できます。")
        expect(html.match(/checked=""/g)).toBeNull()
        const submitTag = tagsOf(html, "button").at(-1) ?? ""
        expect(submitTag).toContain("disabled")
    })
})

describe("SurveyDialogBody（描画）", () => {
    it("[3.7] role=dialog・aria-modal で、タイトルを aria-labelledby の名前に持つ", () => {
        const html = render()
        expect(html).toContain('role="dialog"')
        expect(html).toContain('aria-modal="true"')
        expect(html).toContain('aria-labelledby="survey-title"')
        expect(html).toContain('<h2 id="survey-title"')
        expect(html).toContain("利用アンケート</h2>")
    })

    it("[3.1] タイトル・説明・すべての質問と選択肢を表示する", () => {
        const html = render()
        expect(html).toContain("数問にお答えください。")
        expect(html).toContain("よく使う機能")
        expect(html).toContain("興味のある話題")
        expect(html).toContain("投稿")
        expect(html).toContain("音楽")
    })

    it("[3.2][6.2] 表示言語が英語なら、設定の英語の文言と固定文言の英語を使う", () => {
        const html = render({ locale: "en" })
        expect(html).toContain("Usage survey</h2>")
        expect(html).toContain("Main feature")
        expect(html).toContain("Posts")
        expect(html).toContain("Submit")
        expect(html).toContain(
            "Your answers are saved anonymously. Once submitted, they cannot be withdrawn or changed.",
        )
    })

    it("[3.9] 取り消せない旨は送信の操作より前に示す", () => {
        const html = render()
        const notice = html.indexOf("取り消し・訂正はできません")
        const submit = html.indexOf("送信する</button>")
        expect(notice).toBeGreaterThan(-1)
        expect(submit).toBeGreaterThan(notice)
    })

    it("[3.6] 未完了の間は送信の操作を押せず、完了の案内を示す", () => {
        const html = render()
        expect(html).toContain("すべての質問に答えると送信できます。")
        expect(html).toContain("送信する</button>")
        const submitTag = tagsOf(html, "button").at(-1) ?? ""
        expect(submitTag).toContain("disabled")
    })

    it("[3.6] 完了していれば送信の操作を押せる", () => {
        const html = render({
            draft: { "q-single": ["a"], "q-multi": ["x"] },
        })
        const submitTag = tagsOf(html, "button").at(-1) ?? ""
        expect(submitTag).not.toContain("disabled")
        expect(html).toContain("送信する</button>")
    })

    it("[5.3][5.4] 回答しないを含む間は送信の操作が「閉じる」になり、押せる", () => {
        const html = render({
            draft: { "q-single": ["skip"], "q-multi": [] },
        })
        expect(html).toContain("閉じる</button>")
        expect(html).not.toContain("送信する</button>")
        expect(html).toContain("後からボタンで開き直せます。")
        const closeTag = tagsOf(html, "button").at(-1) ?? ""
        expect(closeTag).not.toContain("disabled")
    })

    it("[4.2] 送信中は質問と操作をすべて押せない", () => {
        const html = render({
            busy: true,
            draft: { "q-single": ["a"], "q-multi": ["x"] },
        })
        const inputs = tagsOf(html, "input")
        expect(inputs.length).toBeGreaterThan(0)
        for (const input of inputs) expect(input).toContain("disabled")
        const submitTag = tagsOf(html, "button").at(-1) ?? ""
        expect(submitTag).toContain("disabled")
    })

    it("[4.7] 送信に失敗したら失敗の文言を示し、選択は保たれたまま", () => {
        const html = render({
            failed: true,
            draft: { "q-single": ["a"], "q-multi": ["x"] },
        })
        expect(html).toContain('role="alert"')
        expect(html).toContain(
            "回答を送信できませんでした。もう一度送信してください。",
        )
        // 選択中の入力は単一の「投稿」と複数の「技術」の 2 件で、失敗の後も選択が残る
        expect(html.match(/checked=""/g)?.length).toBe(2)
        expect(html).toContain("投稿")
    })

    it("失敗していなければ失敗の文言を示さない", () => {
        expect(render()).not.toContain("回答を送信できませんでした")
    })

    it("[3.4] 複数選択は上限に達すると未選択の選択肢を押せなくする", () => {
        const html = render({
            draft: { "q-single": [], "q-multi": ["x", "y"] },
        })
        const multiInputs = tagsOf(html, "input").filter(tag =>
            tag.includes("checkbox"),
        )
        // 順に x, y, z, none。z と none は未選択なので押せない
        expect(multiInputs.map(tag => tag.includes("disabled"))).toEqual([
            false,
            false,
            true,
            true,
        ])
    })

    it("[3.4][5.2] 他の質問で回答しないを選んでも、上限に達した複数の質問は上限を保つ（未選択は押せない）", () => {
        // 単一の質問で「回答しない」を選び、複数の質問は上限 2 に達している
        const html = render({
            draft: { "q-single": ["skip"], "q-multi": ["x", "y"] },
        })
        const multiInputs = tagsOf(html, "input").filter(tag =>
            tag.includes("checkbox"),
        )
        // 順に x, y, z, none。上限はこの質問の規則で決まるため z は押せない
        expect(multiInputs.map(tag => tag.includes("disabled"))).toEqual([
            false,
            false,
            true,
            true,
        ])
    })

    it("[5.1] この質問で回答しないを含む間は上限を外し、未選択も押せる", () => {
        // changeSelection は同じ質問で辞退と他を併存させないが、この描画の規則だけを確認するため併存の状態を渡す
        const html = render({
            draft: { "q-single": [], "q-multi": ["x", "y", "none"] },
        })
        const multiInputs = tagsOf(html, "input").filter(tag =>
            tag.includes("checkbox"),
        )
        expect(multiInputs.map(tag => tag.includes("disabled"))).toEqual([
            false,
            false,
            false,
            false,
        ])
    })

    it("[3.4] 回答しないを選んでいなければ、上限に達した複数の質問で未選択を押せない（対照）", () => {
        const html = render({
            draft: { "q-single": ["a"], "q-multi": ["x", "y"] },
        })
        const multiInputs = tagsOf(html, "input").filter(tag =>
            tag.includes("checkbox"),
        )
        expect(multiInputs.map(tag => tag.includes("disabled"))).toEqual([
            false,
            false,
            true,
            true,
        ])
    })

    it("[5.1] 単一の「回答しない」も他の選択肢と同様に選べる（押せない状態にしない）", () => {
        const html = render()
        const radios = tagsOf(html, "input").filter(tag =>
            tag.includes("radio"),
        )
        expect(radios.length).toBe(3)
        expect(radios.some(tag => tag.includes("disabled"))).toBe(false)
    })

    it("背景・Esc で閉じないよう、Overlay の onClose は何も呼ばない", () => {
        const onAction = vi.fn()
        render({ onAction })
        expect(overlay.props?.open).toBe(true)
        overlay.props?.onClose()
        expect(onAction).not.toHaveBeenCalled()
    })
})
