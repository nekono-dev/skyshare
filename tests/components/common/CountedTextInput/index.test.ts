import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import CountedTextInput, {
    type CounterSpec,
} from "@/components/common/CountedTextInput"

const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
        createElement(CountedTextInput, {
            value: "",
            onChange: () => {},
            ...props,
        } as any),
    )

const bluesky: CounterSpec = {
    key: "bsky",
    label: "Bluesky",
    count: text => text.length,
    maxAssumed: 300,
    warnAt: 280,
    errorAt: 300,
}

describe("CountedTextInput", () => {
    it("[counted-text-input/3.1] 複数行を指定するとテキストエリア、指定しないと1行の入力欄になる", () => {
        expect(render({ multiline: true })).toContain("<textarea")
        const single = render({})
        expect(single).toContain("<input")
        expect(single).not.toContain("<textarea")
    })

    it("[counted-text-input/3.2] カウンタは「件数/上限:ラベル」の形式で表示される", () => {
        const html = render({ value: "abc", counters: [bluesky] })
        expect(html).toContain("3/300:Bluesky")
    })

    it("[counted-text-input/3.3] 上限を超えると、カウンタが誤りの状態になる", () => {
        const html = render({ value: "a".repeat(301), counters: [bluesky] })
        expect(html).toContain("counters-error")
        expect(html).not.toContain("counters-warn")
    })

    it("[counted-text-input/3.4] 警告の閾値を超え上限以内のとき、カウンタが警告の状態になる", () => {
        const html = render({ value: "a".repeat(290), counters: [bluesky] })
        expect(html).toContain("counters-warn")
        expect(html).not.toContain("counters-error")
    })

    it("[counted-text-input/3.5] 複数のカウンタがあるとき、最も深刻な状態で全体の表示が決まる", () => {
        const x: CounterSpec = {
            key: "x",
            label: "X",
            count: text => text.length,
            maxAssumed: 140,
            errorAt: 140,
        }
        const html = render({ value: "a".repeat(200), counters: [bluesky, x] })
        expect(html).toContain("counters-error")
    })
})
