import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import SettingList, {
    type SettingListItem,
} from "@/components/settings/SettingList"

const render = (items: SettingListItem[]) =>
    renderToStaticMarkup(createElement(SettingList, { items }))

describe("SettingList", () => {
    it("[app-settings/2.1] ラベルとスイッチを描画し、スイッチの状態が反映される", () => {
        const html = render([
            { key: "a", label: "設定A", checked: true },
            { key: "b", label: "設定B", checked: false, disabled: true },
        ])
        expect(html).toContain("設定A")
        expect(html).toContain("設定B")
        expect(html).toContain('id="setting-a"')
        // 項目ごとの状態を区別して確認する（オンの項目だけが checked、無効の項目だけが disabled）
        expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
        expect(html.match(/aria-checked="false"/g)).toHaveLength(1)
        expect(html.match(/ checked=""/g)).toHaveLength(1)
        expect(html.match(/ disabled=""/g)).toHaveLength(1)
        expect(html).toMatch(/id="setting-b"[^>]*disabled=""/)
    })

    it("[app-settings/2.2] 説明が指定された行にだけ、説明文が描画される", () => {
        const html = render([
            { key: "a", label: "設定A", description: "Aの説明" },
            { key: "b", label: "設定B" },
        ])
        expect(html).toContain("Aの説明")
        expect(html.match(/<span class="[^"]*description/g)).toHaveLength(1)
    })

    it("[app-settings/2.3] 独自のコントロールが指定された行は、スイッチの代わりに独自のコントロールを描画する", () => {
        const html = render([
            {
                key: "c",
                label: "設定C",
                renderControl: ({ id }) =>
                    createElement("select", { id, "data-custom": "1" }),
            },
        ])
        expect(html).toContain('data-custom="1"')
        expect(html).toContain('id="setting-c"')
        expect(html).not.toContain('role="switch"')
    })

    it("[app-settings/2.4] 文字入力の値が検証を通ると、確認の印が描画される", () => {
        const html = render([
            {
                key: "d",
                label: "設定D",
                textInput: true,
                textInputValue: "example.social",
                textInputValidate: () => true,
            },
        ])
        expect(html).toContain("✓")
    })

    it("[app-settings/2.5] 文字入力の値が検証を通らないと、エラー文が描画される", () => {
        const html = render([
            {
                key: "e",
                label: "設定E",
                textInput: true,
                textInputValue: "bad value",
                textInputValidate: () => false,
                textInputErrorMessage: "形式が正しくありません",
            },
        ])
        expect(html).toContain("形式が正しくありません")
        expect(html).not.toContain("✓")
    })

    it("[app-settings/2.6] 文字入力の値が空のとき、確認の印もエラー文も描画されない", () => {
        const html = render([
            {
                key: "f",
                label: "設定F",
                textInput: true,
                textInputValue: "",
                textInputValidate: () => false,
                textInputErrorMessage: "形式が正しくありません",
            },
        ])
        expect(html).not.toContain("✓")
        expect(html).not.toContain("形式が正しくありません")
    })
})
