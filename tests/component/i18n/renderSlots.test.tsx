/**
 * Verifies rich text slot replacement, including templates with different word orders.
 */
import { createElement, Fragment, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { renderSlots } from "@/components/i18n/renderSlots"

const render = (template: string, slots: Record<string, ReactNode>) =>
  renderToStaticMarkup(
    createElement(Fragment, null, renderSlots(template, slots)),
  )

describe("renderSlots rich text rendering", () => {
  it("replaces a placeholder with its slot element", () => {
    expect(
      render("{share}にクロスポスト", {
        share: createElement("span", null, "S"),
      }),
    ).toBe("<span>S</span>にクロスポスト")
  })

  it("preserves placeholders without a matching slot", () => {
    expect(
      render("前{other}後{share}", {
        share: createElement("b", null, "S"),
      }),
    ).toBe("前{other}後<b>S</b>")
  })

  it("renders templates with different word orders using the same rules", () => {
    const icon = createElement("i", null, "I")
    expect(render("{share}の代わりに開く", { share: icon })).toBe(
      "<i>I</i>の代わりに開く",
    )
    expect(render("Open a popup instead of {share}", { share: icon })).toBe(
      "Open a popup instead of <i>I</i>",
    )
  })

  it("returns text without placeholders unchanged", () => {
    expect(render("スロットなし", {})).toBe("スロットなし")
  })
})
