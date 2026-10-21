/**
 * 選択肢1行（`ListboxOption`）のテスト。
 */
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import ListboxOption from "@/components/common/ListboxOption"

const baseProps = {
    id: "opt-0",
    isActive: false,
    onHover: () => {},
    onSelect: () => {},
    children: "項目",
}

/** 関数コンポーネント（フック無し）を直接呼び、最外要素の props を取り出す。 */
const outerProps = (props: Parameters<typeof ListboxOption>[0]) =>
    (ListboxOption(props) as ReactElement<Record<string, any>>).props

describe("ListboxOption", () => {
    it("[listbox-option/AC-3] 無効な選択肢を押しても確定せず、有効な選択肢は確定する", () => {
        const preventDefault = vi.fn()

        const onSelectDisabled = vi.fn()
        const onHoverDisabled = vi.fn()
        const disabled = outerProps({
            ...baseProps,
            disabled: true,
            onSelect: onSelectDisabled,
            onHover: onHoverDisabled,
        })
        disabled.onMouseDown({ preventDefault })
        expect(onSelectDisabled).not.toHaveBeenCalled()
        // 無効でも、押したことでフォーカスを失わない
        expect(preventDefault).toHaveBeenCalledTimes(1)
        expect(disabled.onMouseEnter).toBeUndefined()

        const onSelect = vi.fn()
        const enabled = outerProps({ ...baseProps, onSelect })
        enabled.onMouseDown({ preventDefault })
        expect(onSelect).toHaveBeenCalledTimes(1)
    })

    it("[listbox-option/AC-4] アクティブ項目と選択中の項目に、選択状態の属性が付く", () => {
        const html = (props: { isActive?: boolean; isSelected?: boolean }) =>
            renderToStaticMarkup(
                createElement(ListboxOption, { ...baseProps, ...props }),
            )
        // 選択中を指定しない候補一覧では、アクティブ項目が選択状態になる
        expect(html({ isActive: true })).toContain('aria-selected="true"')
        expect(html({ isActive: false })).toContain('aria-selected="false"')
        // 選択中を指定するプルダウンでは、アクティブかどうかによらず選択中が選択状態になる
        expect(html({ isActive: false, isSelected: true })).toContain(
            'aria-selected="true"',
        )
        expect(html({ isActive: true, isSelected: false })).toContain(
            'aria-selected="false"',
        )
    })

    it("[listbox-option/AC-5] 選択中の項目にだけ、太字にするクラスが付く", () => {
        const classOf = (isSelected: boolean) =>
            renderToStaticMarkup(
                createElement(ListboxOption, { ...baseProps, isSelected }),
            )
        expect(classOf(true)).toMatch(/class="[^"]*option-selected/)
        expect(classOf(false)).not.toMatch(/option-selected/)
    })
})
