// リッチな文言の描画（スロットの差し込み）を、移動の前の結果で固定する（要件 1.3）。
// 語順の違う日本語と英語が、同じ描画の規則で処理されることも確かめる。
import { createElement, Fragment, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { renderSlots } from "@/components/i18n/renderSlots"

const render = (template: string, slots: Record<string, ReactNode>) =>
  renderToStaticMarkup(
    createElement(Fragment, null, renderSlots(template, slots)),
  )

describe("renderSlots（リッチな文言の描画）", () => {
  it("プレースホルダを、対応するスロットの要素へ置き換える", () => {
    expect(
      render("{share}にクロスポスト", {
        share: createElement("span", null, "S"),
      }),
    ).toBe("<span>S</span>にクロスポスト")
  })

  it("スロットに無い名前は、{name} の文字列のまま残す", () => {
    expect(
      render("前{other}後{share}", {
        share: createElement("b", null, "S"),
      }),
    ).toBe("前{other}後<b>S</b>")
  })

  it("語順の違う日本語と英語を、同じ規則で描画する", () => {
    const icon = createElement("i", null, "I")
    expect(render("{share}の代わりに開く", { share: icon })).toBe(
      "<i>I</i>の代わりに開く",
    )
    expect(render("Open a popup instead of {share}", { share: icon })).toBe(
      "Open a popup instead of <i>I</i>",
    )
  })

  it("プレースホルダが無い文言は、そのまま文字列として返す", () => {
    expect(render("スロットなし", {})).toBe("スロットなし")
  })
})
