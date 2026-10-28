import { createElement, isValidElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"
import Checkbox from "@/components/common/Checkbox"
import RadioButton from "@/components/common/RadioButton"
import ChoiceQuestion, {
    isChoiceLocked,
    nextSelection,
    type ChoiceQuestionChoice,
} from "@/components/common/ChoiceQuestion"

// フック外で部品関数を直接呼ぶため、useId だけ固定値にする(他は本物を維持)。
const idState = vi.hoisted(() => ({ n: 0 }))
vi.mock("react", async importActual => ({
    ...(await importActual<typeof import("react")>()),
    useId: () => `gid${++idState.n}`,
}))

const choices: ChoiceQuestionChoice[] = [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
    { id: "d", label: "D" },
]

describe("nextSelection(単一選択)", () => {
    test("[choice-question/2.2] 未選択から選ぶと、選んだ識別子だけの一覧になる", () => {
        expect(nextSelection("single", choices, [], "b", true)).toEqual(["b"])
    })

    test("[choice-question/2.2] 別の選択肢が選択中のとき、入れ替えて選んだ識別子だけの一覧になる", () => {
        expect(nextSelection("single", choices, ["a"], "c", true)).toEqual([
            "c",
        ])
    })

    test("[choice-question/2.3] 選択中の選択肢を選び直したときは通知なし(undefined)", () => {
        expect(
            nextSelection("single", choices, ["a"], "a", true),
        ).toBeUndefined()
    })

    test("[choice-question/6.3] 選択肢にない識別子が選択状態にあっても例外を出さず、入れ替えられる", () => {
        expect(nextSelection("single", choices, ["zzz"], "a", true)).toEqual([
            "a",
        ])
    })
})

describe("nextSelection(複数選択)", () => {
    test("[choice-question/3.2] 選択を追加した一覧になる", () => {
        expect(nextSelection("multiple", choices, ["a"], "c", true)).toEqual([
            "a",
            "c",
        ])
    })

    test("[choice-question/3.3] 選択を外した一覧になる", () => {
        expect(
            nextSelection("multiple", choices, ["a", "c"], "a", false),
        ).toEqual(["c"])
        expect(nextSelection("multiple", choices, ["a"], "a", false)).toEqual(
            [],
        )
    })

    test("[choice-question/3.4] 選ばれた順ではなく選択肢の並び順になる", () => {
        expect(
            nextSelection("multiple", choices, ["d", "c"], "a", true),
        ).toEqual(["a", "c", "d"])
    })

    test("[choice-question/6.3] 選択肢にない識別子は例外を出さず一覧に含めない", () => {
        expect(
            nextSelection("multiple", choices, ["zzz", "b"], "a", true),
        ).toEqual(["a", "b"])
        expect(nextSelection("multiple", choices, ["zzz"], "b", false)).toEqual(
            [],
        )
    })

    test("[choice-question/3.2] 選択中の選択肢を選択状態として再通知しても重複しない", () => {
        expect(nextSelection("multiple", choices, ["a"], "a", true)).toEqual([
            "a",
        ])
    })
})

describe("isChoiceLocked", () => {
    test("[choice-question/4.1] 上限未満では未選択の選択肢も選べない状態としない", () => {
        expect(isChoiceLocked("multiple", choices, ["a"], "b", 2)).toBe(false)
    })

    test("[choice-question/4.3] 選択を外して上限を下回ると、未選択の選択肢が再び選べる状態に戻る", () => {
        expect(isChoiceLocked("multiple", choices, ["a", "b"], "c", 2)).toBe(
            true,
        )
        expect(isChoiceLocked("multiple", choices, ["a"], "c", 2)).toBe(false)
    })

    test("[choice-question/4.1] 上限ちょうどのとき、未選択の選択肢だけが選べない", () => {
        expect(isChoiceLocked("multiple", choices, ["a", "b"], "c", 2)).toBe(
            true,
        )
    })

    test("[choice-question/4.2] 上限ちょうどでも選択中の選択肢は選べない状態にしない", () => {
        expect(isChoiceLocked("multiple", choices, ["a", "b"], "a", 2)).toBe(
            false,
        )
    })

    test("[choice-question/4.5] 上限を超えていても補正せず、未選択を選べない状態とする", () => {
        expect(
            isChoiceLocked("multiple", choices, ["a", "b", "c"], "d", 2),
        ).toBe(true)
        expect(
            isChoiceLocked("multiple", choices, ["a", "b", "c"], "c", 2),
        ).toBe(false)
    })

    test("[choice-question/4.4] 上限が未指定なら選べない状態としない", () => {
        expect(
            isChoiceLocked(
                "multiple",
                choices,
                ["a", "b", "c"],
                "d",
                undefined,
            ),
        ).toBe(false)
    })

    test("[choice-question/2.6] 単一選択では上限を無視する", () => {
        expect(isChoiceLocked("single", choices, ["a"], "b", 1)).toBe(false)
    })

    test("[choice-question/6.3] 選択肢にない識別子は選択中の数に数えない", () => {
        expect(isChoiceLocked("multiple", choices, ["zzz", "a"], "b", 2)).toBe(
            false,
        )
    })
})

/** 描画結果の HTML を作る。 */
const render = (
    props: Partial<Parameters<typeof ChoiceQuestion>[0]> = {},
): string =>
    renderToStaticMarkup(
        createElement(ChoiceQuestion, {
            kind: "single",
            legend: "好きな色は",
            choices,
            selectedIds: [],
            onChange: () => {},
            ...props,
        }),
    )

/** input 要素のタグ文字列を列挙する。 */
const inputs = (html: string): string[] => html.match(/<input[^>]*>/g) ?? []

describe("ChoiceQuestion の描画", () => {
    test("[choice-question/2.1] 単一選択はラジオで描画する", () => {
        const list = inputs(render({ kind: "single" }))
        expect(list).toHaveLength(4)
        expect(list.every(tag => tag.includes('type="radio"'))).toBe(true)
    })

    test("[choice-question/3.1] 複数選択はチェックボックスで描画する", () => {
        const list = inputs(render({ kind: "multiple" }))
        expect(list).toHaveLength(4)
        expect(list.every(tag => tag.includes('type="checkbox"'))).toBe(true)
    })

    test("[choice-question/7.1] 質問文を legend にした fieldset のグループになる", () => {
        const html = render({ legend: "好きな色は" })
        expect(html).toMatch(
            /^<fieldset[^>]*>\s*<legend[^>]*>好きな色は<\/legend>/,
        )
    })

    test("[choice-question/1.1] 選択肢を渡された順に表示する", () => {
        const html = render({ kind: "multiple" })
        const positions = ["A", "B", "C", "D"].map(t => html.indexOf(`>${t}<`))
        expect(positions.every(p => p >= 0)).toBe(true)
        expect([...positions].sort((x, y) => x - y)).toEqual(positions)
    })

    test("[choice-question/2.4] 単一選択は渡された選択肢だけ checked になる", () => {
        const list = inputs(render({ kind: "single", selectedIds: ["b"] }))
        expect(list.map(tag => tag.includes('checked=""'))).toEqual([
            false,
            true,
            false,
            false,
        ])
    })

    test("[choice-question/2.5] 単一選択で選択状態が空なら、どれも checked にならない", () => {
        const list = inputs(render({ kind: "single", selectedIds: [] }))
        expect(list.some(tag => tag.includes('checked=""'))).toBe(false)
    })

    test("[choice-question/3.5] 複数選択は渡された一覧の選択肢だけ checked になる", () => {
        const list = inputs(
            render({ kind: "multiple", selectedIds: ["a", "c", "zzz"] }),
        )
        expect(list.map(tag => tag.includes('checked=""'))).toEqual([
            true,
            false,
            true,
            false,
        ])
    })

    test("[choice-question/5.1] [choice-question/5.2] disabled で全入力が無効になり、選択状態は残る", () => {
        const list = inputs(
            render({ kind: "multiple", selectedIds: ["a"], disabled: true }),
        )
        expect(list.every(tag => tag.includes('disabled=""'))).toBe(true)
        expect(list[0]).toContain('checked=""')
    })

    test("[choice-question/4.1] [choice-question/4.2] 上限に達すると未選択だけが無効になる", () => {
        const list = inputs(
            render({ kind: "multiple", selectedIds: ["a", "b"], maxSelect: 2 }),
        )
        expect(list.map(tag => tag.includes('disabled=""'))).toEqual([
            false,
            false,
            true,
            true,
        ])
    })

    test("[choice-question/4.4] 上限がなければ無効にならない", () => {
        const list = inputs(
            render({ kind: "multiple", selectedIds: ["a", "b", "c"] }),
        )
        expect(list.some(tag => tag.includes('disabled=""'))).toBe(false)
    })

    test("[choice-question/2.6] 単一選択では上限を無視する", () => {
        const list = inputs(
            render({ kind: "single", selectedIds: ["a"], maxSelect: 1 }),
        )
        expect(list.some(tag => tag.includes('disabled=""'))).toBe(false)
    })

    test("[choice-question/1.5] 選択肢が空なら質問文だけを表示する", () => {
        const html = render({ choices: [] })
        expect(inputs(html)).toHaveLength(0)
        expect(html).toContain("好きな色は")
    })

    test("[choice-question/7.5] 2 つの質問のラジオのグループ名が異なる", () => {
        const html = renderToStaticMarkup(
            createElement("div", null, [
                createElement(ChoiceQuestion, {
                    key: "1",
                    kind: "single",
                    legend: "Q1",
                    choices,
                    selectedIds: [],
                    onChange: () => {},
                }),
                createElement(ChoiceQuestion, {
                    key: "2",
                    kind: "single",
                    legend: "Q2",
                    choices,
                    selectedIds: [],
                    onChange: () => {},
                }),
            ]),
        )
        const names = new Set((html.match(/name="[^"]*"/g) ?? []).map(n => n))
        expect(names.size).toBe(2)
        // 同じ質問の中の選択肢は同じグループ名を共有する
        expect((html.match(/name="/g) ?? []).length).toBe(8)
    })

    test("[choice-question/1.2] [choice-question/1.3] 表示文を渡されたまま表示し、「回答しない」も特別扱いしない", () => {
        const html = render({
            kind: "single",
            choices: [
                { id: "x", label: "回答しない" },
                { id: "y", label: "<b>タグ</b>" },
            ],
        })
        expect(html).toContain(">回答しない<")
        expect(html).toContain("&lt;b&gt;タグ&lt;/b&gt;")
        expect(inputs(html)).toHaveLength(2)
    })

    test("[choice-question/8.3] className を fieldset へ連結する", () => {
        const html = render({ className: "outer-layout" })
        expect(html).toMatch(/^<fieldset[^>]*class="[^"]*outer-layout/)
    })
})

/** 返った要素の木から、指定した部品の要素を並び順に集める。 */
const collect = (node: unknown, type: unknown): ReactElement<any>[] => {
    if (Array.isArray(node)) return node.flatMap(n => collect(n, type))
    if (!isValidElement(node)) return []
    const el = node as ReactElement<{ children?: unknown }>
    const own = el.type === type ? [el as ReactElement<any>] : []
    return [...own, ...collect(el.props.children, type)]
}

describe("ChoiceQuestion の通知(要素の木を直接検査)", () => {
    const call = (props: Partial<Parameters<typeof ChoiceQuestion>[0]>) => {
        const calls: string[][] = []
        const tree = ChoiceQuestion({
            kind: "multiple",
            legend: "Q",
            choices,
            selectedIds: [],
            onChange: ids => calls.push(ids),
            ...props,
        })
        return { calls, tree }
    }

    test("[choice-question/3.2] [choice-question/3.4] 複数選択の操作で、選択肢の並び順の一覧が通知される", () => {
        const { calls, tree } = call({ selectedIds: ["c"] })
        const boxes = collect(tree, Checkbox)
        boxes[0].props.onCheckedChange(true)
        expect(calls).toEqual([["a", "c"]])
    })

    test("[choice-question/3.3] 複数選択で外すと、その識別子を除いた一覧が通知される", () => {
        const { calls, tree } = call({ selectedIds: ["a", "c"] })
        collect(tree, Checkbox)[0].props.onCheckedChange(false)
        expect(calls).toEqual([["c"]])
    })

    test("[choice-question/5.3] 全体が disabled のとき、操作しても通知されない", () => {
        const multi = call({ disabled: true, selectedIds: ["a"] })
        collect(multi.tree, Checkbox)[1].props.onCheckedChange(true)
        const single = call({ kind: "single", disabled: true })
        collect(single.tree, RadioButton)[1].props.onSelect()
        expect(multi.calls).toEqual([])
        expect(single.calls).toEqual([])
    })

    test("[choice-question/4.1] 上限で選べない選択肢は、操作しても通知されない", () => {
        const { calls, tree } = call({ selectedIds: ["a", "b"], maxSelect: 2 })
        const boxes = collect(tree, Checkbox)
        expect(boxes[2].props.disabled).toBe(true)
        boxes[2].props.onCheckedChange(true)
        expect(calls).toEqual([])
    })

    test("[choice-question/2.2] 単一選択で別の選択肢を選ぶと、その識別子だけが通知される", () => {
        const { calls, tree } = call({ kind: "single", selectedIds: ["a"] })
        collect(tree, RadioButton)[2].props.onSelect()
        expect(calls).toEqual([["c"]])
    })

    test("[choice-question/2.3] 単一選択で選択中の再選択は通知されない", () => {
        const { calls, tree } = call({ kind: "single", selectedIds: ["a"] })
        collect(tree, RadioButton)[0].props.onSelect()
        expect(calls).toEqual([])
    })

    test("[choice-question/8.1] 複数選択の Checkbox にカード状の variant が渡る", () => {
        const { tree } = call({})
        const boxes = collect(tree, Checkbox)
        expect(boxes).toHaveLength(4)
        expect(boxes.every(b => b.props.variant === "card")).toBe(true)
    })

    test("[choice-question/7.5] 単一選択の全選択肢に同じ name が渡る", () => {
        const { tree } = call({ kind: "single" })
        const names = collect(tree, RadioButton).map(r => r.props.name)
        expect(new Set(names).size).toBe(1)
        expect(names[0]).toMatch(/^gid/)
    })
})
