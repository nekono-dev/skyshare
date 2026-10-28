import { describe, expect, test } from "vitest"
import {
    isChoiceLocked,
    nextSelection,
    type ChoiceQuestionChoice,
} from "@/components/common/ChoiceQuestion"

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
