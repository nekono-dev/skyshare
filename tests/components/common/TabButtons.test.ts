import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"
import TabButtons, {
    nextTabKey,
    panelId,
    tabId,
    type TabItem,
} from "@/components/common/TabButtons"

const items: TabItem<"a" | "b" | "c">[] = [
    { key: "a", label: "A" },
    { key: "b", label: "B", disabled: true },
    { key: "c", label: "C" },
]

describe("nextTabKey", () => {
    test("tab-buttons/2.1: 2つ目が無効のとき、1つ目で右を押すと3つ目、3つ目で右を押すと1つ目に戻る", () => {
        expect(nextTabKey(items, "a", "ArrowRight")).toBe("c")
        expect(nextTabKey(items, "c", "ArrowRight")).toBe("a")
        expect(nextTabKey(items, "a", "ArrowLeft")).toBe("c")
        expect(nextTabKey(items, "c", "ArrowLeft")).toBe("a")
    })

    test("tab-buttons/2.2: Home で先頭の、End で末尾の無効でないタブが選ばれる", () => {
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

describe("TabButtons の描画", () => {
    const render = (value: "a" | "b" | "c") =>
        renderToStaticMarkup(
            createElement(TabButtons<"a" | "b" | "c">, {
                idPrefix: "t",
                ariaLabel: "切り替え",
                items,
                value,
                onChange: () => {},
            }),
        )

    test("tab-buttons/1.2: 無効なタブは押せない状態で描画される", () => {
        const html = render("a")
        expect(html).toMatch(/id="t-tab-b"[^>]*disabled=""/)
        expect(html).not.toMatch(/id="t-tab-a"[^>]*disabled=""/)
    })

    test("tab-buttons/3.1: タブリストの役割を持ち、各タブが対応するタブパネルを参照し、選択中だけが選択状態になる", () => {
        const html = render("c")
        expect(html).toContain('role="tablist"')
        expect(html).toContain('aria-label="切り替え"')
        expect(html.match(/role="tab"/g)).toHaveLength(3)
        expect(html).toContain(
            `id="${tabId("t", "c")}" aria-controls="${panelId("t", "c")}" aria-selected="true"`,
        )
        expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    })

    test("tab-buttons/2.3: 選択中のタブだけがフォーカスの順序に含まれる", () => {
        const html = render("a")
        expect(html.match(/tabindex="0"/gi)).toHaveLength(1)
        expect(html.match(/tabindex="-1"/gi)).toHaveLength(2)
        expect(html).toMatch(/id="t-tab-a"[^>]*tabindex="0"/i)
    })
})
