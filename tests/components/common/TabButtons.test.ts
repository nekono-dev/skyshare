import { describe, expect, test } from "vitest"
import { nextTabKey, type TabItem } from "@/components/common/TabButtons"

const items: TabItem<"a" | "b" | "c">[] = [
    { key: "a", label: "A" },
    { key: "b", label: "B", disabled: true },
    { key: "c", label: "C" },
]

describe("nextTabKey", () => {
    test("tab-buttons/AC-3: 2つ目が無効のとき、1つ目で右を押すと3つ目、3つ目で右を押すと1つ目に戻る", () => {
        expect(nextTabKey(items, "a", "ArrowRight")).toBe("c")
        expect(nextTabKey(items, "c", "ArrowRight")).toBe("a")
        expect(nextTabKey(items, "a", "ArrowLeft")).toBe("c")
        expect(nextTabKey(items, "c", "ArrowLeft")).toBe("a")
    })

    test("tab-buttons/AC-4: Home で先頭の、End で末尾の無効でないタブが選ばれる", () => {
        expect(nextTabKey(items, "c", "Home")).toBe("a")
        expect(nextTabKey(items, "a", "End")).toBe("c")
        const tailDisabled: TabItem<"x" | "y">[] = [
            { key: "x", label: "X" },
            { key: "y", label: "Y", disabled: true },
        ]
        expect(nextTabKey(tailDisabled, "x", "End")).toBe("x")
    })

    test("すべてのタブが無効なら選択を変えない", () => {
        const none: TabItem<"x" | "y">[] = [
            { key: "x", label: "X", disabled: true },
            { key: "y", label: "Y", disabled: true },
        ]
        expect(nextTabKey(none, "x", "ArrowRight")).toBe("x")
        expect(nextTabKey(none, "x", "Home")).toBe("x")
    })
})
